var Connection = require('../common/connection').Connection;
var RPC = require('../common/rpc').RPC;
var DB = require('./db').DB;
var Utils = require('../common/utils').Utils;
var ServerPaxos = require('./serverPaxos');

var WebSocketServer = require('ws').Server;
var paxosUID = Number(process.argv[2]);
var paxosPortByUID = JSON.parse(process.argv[3]);
var paxosHostportByUID = JSON.parse(process.argv[4]);
var clientPortByUID = JSON.parse(process.argv[5]);
var paxosIsRevive = Boolean(Number(process.argv[6]));
var clientPort = clientPortByUID[paxosUID];

var db = null;

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
    console.log('gp', paxos.uid);
    paxos.on('commit', function(v, done){
      console.log(v);
      done();
    });
    if (paxos.uid === 0){
      console.log("SEND");
      paxos.request({ msg: 'hi', uid: paxos.uid, '3': paxosIsRevive }, function(done, v){ done(true); });
    }
    initClientRPC();
  });

function initClientRPC(){
  var wss = new WebSocketServer({port: clientPort});
  Utils.whoami(function(whoiam){
    var conString = 'postgres://' + whoiam + '@localhost/cloasis';
    db = new DB(conString);

    wss.on('connection', function(ws) {
      var conn = new Connection(ws);
      conn.id = nextConnId++;
      var rpc = new RPC(conn, true);
      rpc.on('registerUser', registerUser);
      rpc.on('loginUser', loginUser);
      rpc.on('search', search);
      rpc.on('call', call);
      rpc.on('register', register);
      rpc.on('info', info);
      rpc.on('activate', activate);
      rpc.on('deactivate', deactivate);
      rpc.on('close', close);
    });
  });
}

var fnTable = {};
var activeAPIsByConnId = {};

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

function call(rpc, data, done){
  //TODO check user logged in
  var apiStr = Utils.stringifyAPIIdentifier(data.apiIdentifier);
  if (!(apiStr in fnTable)){
    done({ err: 'api not active' });
    return;
  }
  fnTable[apiStr].call('call', data, function(err, output){
    if (err)
      throw err;
    done(output);
  });

}

function activate(rpc, data, done){
  //TODO check user logged in + api registered + owned by user
  var err = { errs: [] };
  var wasErr = false;
  data.apiIdentifiers.forEach(function(apiIdentifier){
    var apiStr = Utils.stringifyAPIIdentifier(apiIdentifier);
    if (apiStr in fnTable){
      err.errs.push('api already activated');
      wasErr = true;
    }
    else {
      fnTable[apiStr] = rpc;
      if (!(rpc.conn.id in activeAPIsByConnId)){
        activeAPIsByConnId[rpc.conn.id] = {};
      }
      activeAPIsByConnId[rpc.conn.id][apiStr] = true;
    }
    err.errs.push(null);
  });
  if (wasErr)
    done({ err: err });
  else
    done({ err: null });
}

function deactivate(rpc, data, done){
  //TODO check user logged in + api owned by user
  delete fnTable[Utils.stringifyAPIIdentifier(apiIdentifier)];
  if (rpc.conn.id in activeAPIsByConnId){
    delete activeAPIsByConnId[rpc.conn.id][apiStr];
  }
  done({ err: null });
}

function close(rpc){
  if (rpc.conn.id in activeAPIsByConnId){
    for (var apiStr in activeAPIsByConnId[rpc.conn.id]){
      delete fnTable[apiStr];
    }
  }
  delete activeAPIsByConnId[rpc.conn.id];
}
