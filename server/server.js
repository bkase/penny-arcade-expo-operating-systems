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

var db = null;
var apis = null;

function initClientRPC(paxos){
  var wss = new WebSocketServer({port: clientPort});
  Utils.whoami(function(whoiam){
    var conString = 'postgres://' + whoiam + '@localhost/cloasis';
    db = new DB(conString);
    apis = new APIs(paxosUID);

    apis.on('request', function(V, isValid){
      V.name = 'apis::' + V.name;
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

      rpc.on('call', call);
      rpc.on('activate', activate);
      rpc.on('deactivate', deactivate);
    });
  });

  function close(rpc){
    apis.close(rpc);
  }
}

function call(rpc, data, done){
  //TODO check user logged in
  apis.call(rpc, data, done);
}

function activate(rpc, data, done){
  //TODO check user logged in + api registered + owned by user
  apis.activate(rpc, data, done);
}

function deactivate(rpc, data, done){
  //TODO check user logged in + api owned by user
  apis.deactivate(rpc, data, done);
}


//==========================
//    DB
//==========================

//PAXOS will go in the middle of these functions later
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
