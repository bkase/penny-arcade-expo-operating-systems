var Connection = require('../common/shittyConnection').Connection;
var RPC = require('../common/rpc').RPC;
var WebSocketServer = require('ws').Server;
var WebSocket = require('ws');
var Paxos = require('./paxos').Paxos;


var N = 3;

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
    paxoss[i] = new Paxos(i, rpcs[i]);
  }
  //testWhenShitty(paxoss, 100);
  //testWhenNonLeaderDies(paxoss);
  testWhenLeaderDies(paxoss);
}

function testWhenLeaderDies(paxoss){
  paxoss.forEach(function(paxos){
    var commits = {};
    paxos.on('commit', function(v){
      if (commits[v.d]){
        throw new Error(paxos.uid + ' duplicate v.d! ' + v.d);
      }
      commits[v.d] = true;
      console.log(paxos.uid, 'got', 'commit', v)
    });
  });
  paxoss[0].on('sendAccept', function(){
    paxoss[0].serverRPCPool.forEach(function(rpc){
      rpc.conn.dropAll();
    });
  });
  paxoss[0].request({ d: '0' }, function(){ return true; });
}

function testWhenNonLeaderDies(paxoss){
  paxoss.forEach(function(paxos){
    var commits = {};
    paxos.on('commit', function(v){
      if (commits[v.d]){
        throw new Error(paxos.uid + ' duplicate v.d! ' + v.d);
      }
      commits[v.d] = true;
      console.log(paxos.uid, 'got', 'commit', v)
      if (paxos.uid == 0 && v.d === '0'){
        paxos.serverRPCPool[0].conn.dropAll();
        paxos.request({ d: '1' }, function(){ return true; });
      }
    });
  });
  paxoss[0].request({ d: '0' }, function(){ return true; });
}

function testWhenShitty(paxoss, requests){
  paxoss.forEach(function(paxos){
    paxos.serverRPCPool.forEach(function(rpc){
      rpc.conn.startBeingShitty();
    });
    var commits = {};
    paxos.on('commit', function(v){
      if (commits[v.d]){
        throw new Error(paxos.uid + ' duplicate v.d! ' + v.d);
      }
      commits[v.d] = true;
      console.log(i, 'got', 'commit', v)
      if (paxos.uid == 0 && requests > 0){
        requests -= 1;
        paxos.request({ d: requests }, function(){ return true; });
      }
    });
  });
  requests -= 1;
  paxoss[0].request({ d: requests }, function(){ return true; });
}
