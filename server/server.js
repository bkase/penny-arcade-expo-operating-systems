
var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({port: 14222});

var Connection = require('../common/connection').Connection;
var RPC = require('../common/rpc').RPC;
var DB = require('./db').DB;
var Utils = require('../common/utils').Utils;

var db = null;

Utils.whoami(function(whoiam){
  var conString = 'postgres://' + whoiam + '@localhost/cloasis';
  db = new DB(conString);

  wss.on('connection', function(ws) {
    var conn = new Connection(ws);
    var rpc = new RPC(conn, true);
    rpc.on('registerUser', registerUser);
    rpc.on('loginUser', loginUser);
    rpc.on('search', search);
    rpc.on('call', call);
    rpc.on('register', register);
    rpc.on('info', info);
    rpc.on('activate', activate);
    rpc.on('deactivate', deactivate);
  });
});

var fnTable = {};

//PAXOS will go in the middle of these functions later
function registerUser(conn, data, done){
  db.createUser(data.username, data.password, function(err, exists){
    console.log(err);
    if (err)
      done({ err: err });
    else if (exists)
      done({ err: 'user exists' });
    else
      done({ err: null });
  });
}

function loginUser(conn, data, done){
  db.validateUser(data.username, data.password, function(err, valid){
    if (err)
      done({ err: err });
    else if (!valid)
      done({ err: 'invalid user' });
    else
      done({ err: null});
  });
}

function search(conn, data, done){
  db.searchAPIs(data.query, function(err, apis){
    if (err)
      done({ err: err });
    else
      done({ err: null, apis: apis });
  });
}

function info(conn, data, done){
  db.infoAPIs(data.apiIdentifiers, function(err, apis){
    if (err)
      done({ err: err });
    else
      done({ err: null, apis: apis });
  });
}

function register(conn, data, done){
  db.registerAPIs(data.apiSpecs, function(err){
    if (err)
      done({ err: err });
    else
      done({ err: null });
  });
}

function call(conn, data, done){

}

function activate(conn, data, done){
  data.apiIdentifiers.forEach(function(apiIdentifier){
    fnTables[stringifyAPIIdentifier(apiIdentifier)] = conn;
  });
}

function deactivate(conn, data, done){
  delete fnTables[stringifyAPIIdentifier(apiIdentifier)];
}

function stringifyAPIIdentifier(apiIdentifier){
  return apiIdentifier.namespace + '.' + apiIdentifier.name + '.' + apiIdentifier.version;
}
