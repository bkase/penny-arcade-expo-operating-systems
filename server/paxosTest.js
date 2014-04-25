var Connection = require('../common/shittyConnection').Connection;
var RPC = require('../common/rpc').RPC;
var WebSocketServer = require('ws').Server;
var WebSocket = require('ws');
var Paxos = require('./paxos').Paxos;


var N = 7;

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
        rpc.targetName = from;
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
    rpc.targetName = j;
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
  testWhenShitty(paxoss, 100);
  //testWhenNonLeaderDies(paxoss);
  //testWhenLeaderDies0(paxoss);
  //testWhenLeaderDies1(paxoss);
  //testWhenLeaderDies2(paxoss);
  //testWhenAcceptFails(paxoss);
}

function testWhenAcceptFails(paxoss){
  paxoss.forEach(function(paxos){
    var commits = {};
    paxos.on('commit', function(v){
      checkCommits(paxos.uid, commits, v);
    });
  });
  paxoss[0].once('sendAccept', function(){
    paxoss[1].serverRPCPool.forEach(function(rpc){
      if (rpc.targetName == 0)
        rpc.conn.dropAll();
    });
    paxoss[2].serverRPCPool.forEach(function(rpc){
      if (rpc.targetName == 0)
        rpc.conn.dropAll();
    });
  });
  paxoss[0].once('retry', function(){
    paxoss[1].serverRPCPool.forEach(function(rpc){
      if (rpc.targetName == 0)
        rpc.conn.dropNone();
    });
    paxoss[2].serverRPCPool.forEach(function(rpc){
      if (rpc.targetName == 0)
        rpc.conn.dropNone();
    });
  });
  paxoss[0].request({ d: '0' }, function(){ return true; });
}

function testWhenLeaderDies2(paxoss){
  paxoss.forEach(function(paxos){
    var commits = {};
    paxos.on('commit', function(v){
      checkCommits(paxos.uid, commits, v);
    });
  });
  paxoss[0].on('sendAccept', function(){
    paxoss[0].serverRPCPool.forEach(function(rpc){
      if (rpc.targetName == 1)
        rpc.conn.dropAll();
    });
  });
  paxoss[0].on('sendCommit', function(){
    paxoss[0].serverRPCPool.forEach(function(rpc){
      if (rpc.targetName == 1)
        rpc.conn.dropAll();
    });
    paxoss[1].request({ d: '1' }, function(){ return true; });
  });
  paxoss[0].request({ d: '0' }, function(){ return true; });
}

function testWhenLeaderDies1(paxoss){
  paxoss.forEach(function(paxos){
    var commits = {};
    paxos.on('commit', function(v){
      checkCommits(paxos.uid, commits, v);
    });
  });
  paxoss[0].on('sendAccept', function(){
    paxoss[0].serverRPCPool.forEach(function(rpc){
      if (rpc.targetName == 1)
        rpc.conn.dropAll();
    });
  });
  paxoss[0].on('sendCommit', function(){
    paxoss[0].serverRPCPool.forEach(function(rpc){
      rpc.conn.dropAll();
    });
    paxoss[1].request({ d: '1' }, function(){ return true; });
  });
  paxoss[0].request({ d: '0' }, function(){ return true; });
}

function testWhenLeaderDies0(paxoss){
  paxoss.forEach(function(paxos){
    var commits = {};
    paxos.on('commit', function(v){
      checkCommits(paxos.uid, commits, v);
    });
  });
  paxoss[0].on('sendAccept', function(){
    paxoss[0].serverRPCPool.forEach(function(rpc){
      if (rpc.targetName == 1)
        rpc.conn.dropAll();
    });
  });
  paxoss[0].on('sendCommit', function(){
    paxoss[0].die = true;
    paxoss[0].serverRPCPool.forEach(function(rpc){
      rpc.conn.dropAll();
    });
    paxoss[1].request({ d: '1' }, function(){ return true; });
  });
  paxoss[0].request({ d: '0' }, function(){ return true; });
}

function testWhenNonLeaderDies(paxoss){
  paxoss.forEach(function(paxos){
    var commits = {};
    paxos.on('commit', function(v){
      checkCommits(paxos.uid, commits, v);
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
      checkCommits(paxos.uid, commits, v);
      if (paxos.uid == 0 && requests > 0){
        requests -= 1;
        paxos.request({ d: requests }, function(){ return true; });
      }
    });
  });
  requests -= 1;
  paxoss[0].request({ d: requests }, function(){ return true; });
}

function checkCommits(uid, commits, v){
  console.log(uid, 'got', 'commit', v)
  if (commits[v.d]){
    throw new Error(uid + ' duplicate v.d! ' + v.d);
  }
  commits[v.d] = true;
  //TODO might be broken
  for (var i = 0; i < v.d; i++){
    if (!(v.d in commits)){
      throw new Error(uid + ' missing v.d! ' + v.d);
    }
  }
}
