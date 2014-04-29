var Connection = require('../common/connection').Connection;
var RPC = require('../common/rpc').RPC;
var DB = require('./db').DB;
var Utils = require('../common/utils').Utils;
var ServerPaxos = require('./serverPaxos');
var APIs = require('./apis').APIs;

var WebSocketServer = require('ws').Server;
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
    initClientRPC(paxos);
  });

function onCommit(V, done){
  if (V.name.indexOf('db::') === 0){
    V.name = V.name.slice(4);
    db.commit(V, done);
  } else if (V.name.indexOf('apis::') == 0){
    V.name = V.name.slice(6);
    apis.commit(V, done);
  } else {
    console.log('dropped ' + V);
  }

  done();
}

function onReceiveMsg(name, msg, done){
  if (name.indexOf('apis::') == 0){
    name = name.slice(6);
    apis.receiveMsg(name, msg, done);
  } else {
    console.log('dropped ' + V);
  }
}

var db = null;
var apis = null;

function initClientRPC(paxos){
  var wss = new WebSocketServer({port: clientPort});
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

    wss.on('connection', function(ws) {
      var conn = new Connection(ws);
      conn.id = nextConnId++;
      var rpc = new RPC(conn, true);
      rpc.on('close', close);

      rpc.on('registerUser', registerUser);
      rpc.on('loginUser', loginUser);
      rpc.on('search', search);
      rpc.on('register', register);
      rpc.on('info', info);

      rpc.on('call', apis.call.bind(apis));
      rpc.on('activate', apis.activate.bind(apis));
      rpc.on('deactivate', apis.deactivate.bind(apis));
    });
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
