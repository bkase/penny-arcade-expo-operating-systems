
var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({port: 14222});

var Connection = require('../common/connection').Connection;
var RPC = require('../common/rpc').RPC;
var DB = require('./db').DB;

var db = new DB();

wss.on('connection', function(ws) {
  var conn = new Connection(ws);
  var rpc = new RPC(conn);
  rpc.on('registerUser', registerUser);
  rpc.on('loginUser', loginUser);
  rpc.on('search', search);
  rpc.on('call', call);
  rpc.on('register', register);
  rpc.on('info', info);
  rpc.on('activate', activate);
  rpc.on('deactivate', deactivate);
});

//PAXOS will go in the middle of these functions later
function registerUser(data, done){
  db.createUser(data.username, data.password, function(err, exists){
    if (err)
      done({ err: err });
    else if (exists)
      done({ err: 'user exists' });
    else
      done({ err: null });
  });
}

function loginUser(data, done){
  db.validateUser(data.username, data.password, function(err, valid){
    if (err)
      done({ err: err });
    else if (!valid)
      done({ err: 'invalid user' });
    else
      done({ err: null});
  });
}

function search(data, done){
  db.searchAPIs(data.query, function(err, apis){
    if (err)
      done({ err: err });
    else
      done({ err: null, apis: apis });
  });
}

function info(data, done){
  db.infoAPIs(data.apiIdentifiers, function(err, apis){
    if (err)
      done({ err: err });
    else
      done({ err: null, apis: apis });
  });
}

function register(data, done){
  db.registerAPIs(data.apiSpecs, function(err){
    if (err)
      done({ err: err });
    else
      done({ err: null });
  });
}

function call(data, done){

}

function activate(data, done){

}

function deactivate(data, done){

}

