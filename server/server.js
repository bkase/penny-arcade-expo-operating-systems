
var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({port: 14222});

var Connection = require('../common/connection').Connection;
var RPC = require('../common/rpc').RPC;

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

function registerUser(data, done){
  console.log(data);
}

function loginUser(data, done){

}

function search(data, done){

}

function call(data, done){

}

function register(data, done){

}

function info(data, done){

}

function activate(data, done){

}

function deactivate(data, done){

}

