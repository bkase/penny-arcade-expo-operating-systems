var Connection = require('../common/connection').Connection;
var SIOSocket = require('../common/sioSocket').SIOSocket;
var RPC = require('../common/rpc').RPC;
var DB = require('./db').DB;
var Utils = require('../common/utils').Utils;
var ServerPaxos = require('./serverPaxos');
var APIs = require('./apis').APIs;
var WebSocketServer = require('ws').Server;
var socketio = require('socket.io');

var paxosUID = Number(process.argv[2]);
var paxosPortByUID = JSON.parse(process.argv[3]);
var paxosHostportByUID = JSON.parse(process.argv[4]);
var clientPortByUID = JSON.parse(process.argv[5]);
var paxosIsRevive = Boolean(Number(process.argv[6]));
var clientPort = clientPortByUID[paxosUID];

var nextConnId = 0;

ServerPaxos.init(
  paxosUID, 
  paxosPortByUID,
  paxosHostportByUID, 
  clientPortByUID,
  paxosIsRevive,

  function(err, paxos){
    if (err)
      throw err;
    console.log('init', paxos.uid);
    paxos.on('commit', onCommit);
    paxos.on('receiveMsg', onReceiveMsg);
    paxos.on('dead', onDead);
    initClientRPC(paxos);
  });

function onCommit(V, done, old){
  if (V.name.indexOf('db::') === 0){
    V.name = V.name.slice(4);
    db.commit(V, done, old);
  } else if (V.name.indexOf('apis::') == 0){
    V.name = V.name.slice(6);
    apis.commit(V, done, old);
  } else {
    console.log('commit, dropped ', V);
  }
}

function onDead(uid){
  apis.died(uid);
}

function onReceiveMsg(name, msg, done){
  if (name.indexOf('apis::') == 0){
    name = name.slice(6);
    apis.receiveMsg(name, msg, done);
  } else {
    console.log('rm, dropped ' + V);
  }
}

var db = null;
var apis = null;

function initClientRPC(paxos){
  var wss = new WebSocketServer({port: clientPort});
  var sios = socketio.listen(clientPort+1, { log: false });
  //sios.set('close timeout', 10);
  //sios.set('heartbeat interval', 5);

  Utils.whoami(function(whoiam){
    var conString = 'postgres://' + whoiam + '@localhost/cloasis' + paxos.uid;
    db = new DB(conString, paxosUID);
    apis = new APIs(paxosUID);

    apis.on('request', function(V, isValid){
      V.name = 'apis::' + V.name;
      paxos.request(V, isValid);
    });
    
    apis.on('sendMsg', function(targetUID, name, msg, done){
      paxos.sendMsg(targetUID, 'apis::' + name, msg, done);
    });

    db.on('request', function(V, isValid) {
      V.name = 'db::' + V.name;
      paxos.request(V, isValid);
    });
  
    sios.sockets.on('connection', function (socket){
      connectConn(new Connection(new SIOSocket(socket)));
    });

    wss.on('connection', function(ws) {
      connectConn(new Connection(ws));
    });

    function connectConn(conn){
      conn.id = nextConnId++;
      conn.arst = true;
      var rpc = new RPC(conn, true);
      rpc.TIMEOUT = 1000000000;
      rpc.on('close', close);

      rpc.on('registerUser', registerUser);
      rpc.on('loginUser', loginUser);
      rpc.on('search', search);
      rpc.on('register', register);
      rpc.on('info', info);

      rpc.on('call', apis.call.bind(apis));
      rpc.on('activate', apis.activate.bind(apis));
      rpc.on('deactivate', apis.deactivate.bind(apis));
    }
  });
}

function close(rpc){
  apis.close(rpc);
}

//==========================
//    DB
//==========================

function registerUser(rpc, data, done){
  db.createUser(data.username, data.password, function(err, exists){
    if (err)
      done({ err: err });
    else if (exists)
      done({ err: 'user exists' });
    else
      done({ err: null });
  });
}

function loginUser(rpc, data, done){
  db.validateUser(data.username, data.password, function(err, valid){
    if (err)
      done({ err: err });
    else if (!valid)
      done({ err: 'invalid user' });
    else
      done({ err: null});
  });
}

function search(rpc, data, done){
  //TODO check user logged in
  db.searchAPIs(data.query, function(err, apis){
    if (err)
      done({ err: err });
    else
      done({ err: null, apis: apis });
  });
}

function info(rpc, data, done){
  //TODO check user logged in
  db.infoAPIs(data.apiIdentifiers, function(err, apis){
    if (err)
      done({ err: err });
    else
      done({ err: null, apis: apis });
  });
}

function register(rpc, data, done){
  //TODO ensure namespace has username + user logged in
  db.registerAPIs(data.apiSpecs, function(err){
    if (err)
      done({ err: err });
    else
      done({ err: null });
  });
}
