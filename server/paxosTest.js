var Connection = require('../common/shittyConnection').Connection;
var RPC = require('../common/rpc').RPC;
var WebSocketServer = require('ws').Server;
var WebSocket = require('ws');
var Paxos = require('./paxos').Paxos;


var N = 5;

var successRate = .8;

var rpcs = [];

var startPort = 12000;
for (var i = 0; i < N; i++){
  rpcs[i] = [];
  with ({i: i}){
    var wss = new WebSocketServer({port: startPort+i});
    wss.on('connection', function(ws) {
      var conn = new Connection(ws, successRate);
      var rpc = new RPC(conn);
      rpc.name = i;
      rpc.on('setFrom', function(from, done){
        rpc.id = i + ',' + from;
        rpcs[i].push(rpc);
        done();
      });
    });
  }
}


var toConn = (N*(N-1))/2;

for (var i = 0; i < N; i++){
  for (var j = i+1; j < N; j++){
    var conn = new Connection(new WebSocket('ws://localhost:' + (startPort + j)), successRate);
    var rpc = new RPC(conn);
    rpc.name = i;
    with ({i: i, j: j, conn: conn, rpc: rpc }){
      conn.on('open', function() {
        rpc.call('setFrom', i, function(){
          //console.log('c', i,j);
          rpc.id = i + ',' + j;
          rpcs[i].push(rpc);
          toConn--;
          if (toConn === 0)
            next();
        });
      });
    }
  }

}

function next(){
  var paxoss = [];
  for (var i = 0; i < N; i++){
    rpcs[i].forEach(function(rpc){
      rpc.conn.startBeingShitty();
    });
    paxoss[i] = new Paxos(i, rpcs[i]);
    with ({i: i}){
      paxoss[i].on('commit', function(v){
        console.log(i, 'got', 'commit', v)
        if (i == 0 && j < 3){
          j += 1;
          paxoss[0].request({ d: j }, function(){ return true; });
        }
      });
    }
  }
  var j = 0;
  paxoss[0].request({ d: j }, function(){ return true; });
}
