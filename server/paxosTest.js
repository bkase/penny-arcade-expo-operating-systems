var Connection = require('../common/shittyConnection').Connection;
var RPC = require('../common/rpc').RPC;
var Utils = require('../common/utils').Utils;
var WebSocketServer = require('ws').Server;
var WebSocket = require('ws');
var Paxos = require('./paxos').Paxos;


var N = 3;

var successRate = .8

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
  //testWhenShitty(paxoss, 100);
  testWhenShittyTakeTurns(paxoss, 1000);
  //testWhenNonLeaderDies(paxoss);
  //testWhenLeaderDies0(paxoss);
  //testWhenLeaderDies1(paxoss);
  //testWhenLeaderDies2(paxoss);
  //testWhenAcceptFails(paxoss);
  //testWhenAcceptFails2(paxoss);
  //testMultiSend(paxoss);
}

function testMultiSend(paxoss){
  var is = {};
  var iToUID = {};
  var rng = new Utils.RNG(440);
  paxoss.forEach(function(paxos){
    is[paxos.uid] = 0;
    paxos.on('commit', function(v){
      console.log(paxos.uid, 'got', 'commit', v)
      if (v.d in iToUID && iToUID[v.d] !== v.uid){
        throw new Error('bad commit');
      }
      iToUID[v.d] = v.uid;
      is[paxos.uid] = v.d+1;
      setTimeout(function(){
        paxos.request({ d: is[paxos.uid], uid: paxos.uid }, function(v){
          return !(v.v.d in iToUID);
        });
      }, 50+rng.nextInt() % 100);
    });
  });
  paxoss[0].once('sendAccept', function(){
    paxoss[0].serverRPCPool.forEach(function(rpc){
      if (rpc.targetName == 2)
        rpc.conn.dropAll();
    });
  });
  paxoss[0].request({ d: is[0], uid: 0 }, function(v){ return !(v.v.d in iToUID); });
  paxoss[1].request({ d: is[1], uid: 1 }, function(v){ return !(v.v.d in iToUID); });
  paxoss[2].request({ d: is[2], uid: 2 }, function(v){ return !(v.v.d in iToUID); });
}

function testWhenAcceptFails2(paxoss){
  var send = true;
  paxoss.forEach(function(paxos){
    var commits = {};
    paxos.on('commit', function(v){
      checkCommits(paxos.uid, commits, v);
      if (send && paxos.uid === 0){
        paxoss[0].serverRPCPool.forEach(function(rpc){
          if (rpc.targetName == 2)
            rpc.conn.dropNone();
        });
        paxoss[0].request({ d: '0' }, function(){ return true; });
        send = false;
      }
    });
  });
  paxoss[0].once('sendAccept', function(){
    paxoss[0].serverRPCPool.forEach(function(rpc){
      if (rpc.targetName == 2)
        rpc.conn.dropAll();
    });
  });
  paxoss[0].request({ d: '1' }, function(){ return true; });
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

function testWhenShittyTakeTurns(paxoss, requests){
  var rng = new Utils.RNG(440);
  var maxIByUID = {};
  paxoss.forEach(function(paxos){
    maxIByUID[paxos.uid] = 0;
    paxos.serverRPCPool.forEach(function(rpc){
      rpc.conn.startBeingShitty();
    });
    var commits = {};
    paxos.on('commit', function(v){
      console.log(paxos.uid, 'got', 'commit', v)
      if (maxIByUID[paxos.uid] >= v.d){
        throw new Error('was less than!', paxos.uid, v.d, maxIByUID[paxos.uid]);
      } 
      maxIByUID[paxos.uid] = v.d;
      paxos.request({ d: maxIByUID[paxos.uid]+1 }, function(v){
        return maxIByUID[paxos.uid] < v.v.d;
      });
    });
  });
  paxoss[0].request({ d: maxIByUID[0]+1 }, function(){ return true; });
}

function testWhenShitty(paxoss, requests){
  paxoss.forEach(function(paxos){
    paxos.serverRPCPool.forEach(function(rpc){
      rpc.conn.startBeingShitty();
    });
    var commits = {};
    paxos.on('commit', function(v){
      checkCommits(paxos.uid, commits, v);
      if (paxos.uid == 0 && i < requests){
        i += 1;
        paxos.request({ d: i }, function(){ return true; });
      }
    });
  });
  var i = 0;
  paxoss[0].request({ d: i }, function(){ return true; });
}

function checkCommits(uid, commits, v){
  console.log(uid, 'got', 'commit', v)
  if (commits[v.d]){
    throw new Error(uid + ' duplicate v.d! ' + v.d);
  }
  commits[v.d] = true;
  //TODO might be broken
  for (var i = 0; i <= v.d; i++){
    if (!(i in commits)){
      throw new Error(uid + ' missing v.d! ' + i);
    }
  }
}
