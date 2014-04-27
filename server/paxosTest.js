var Utils = require('../common/utils').Utils;
var doTests = require('./paxosTestUtils').doTests;

var tests = [
  [7, .8, testWhenLeaderDies2],
  [7, .8, testWhenAcceptFails],
  [7, .8, testWhenAcceptFails2],
  [7, .8, testWhenShitty.bind(null, 25)],
  [7, .8, testWhenNonLeaderDies],
  [7, .8, testWhenLeaderDies0],
  [7, .8, testWhenLeaderDies1],
  [7, .8, testMultiSend.bind(null, 25)],
  [7, .8, testWhenShittyTakeTurns.bind(null, 25)],
  [7, .8, testWhenShittyTakeTurns.bind(null, 25)],
];

doTests(tests, function(err){
  if (err)
    throw err;
  process.exit(0);
});

function testMultiSend(requests, paxoss, done){
  var is = {};
  var iToUID = {};
  var rng = new Utils.RNG(440);
  var bail = false;
  paxoss.forEach(function(paxos){
    is[paxos.uid] = 0;
    paxos.on('commit', function(v){
      if (v.d in iToUID && iToUID[v.d] !== v.uid){
        bail = true;
        done(new Error('bad commit'));
        return;
      }
      iToUID[v.d] = v.uid;
      is[paxos.uid] = v.d+1;
      setTimeout(function(){
        if (!bail){
          paxos.request({ d: is[paxos.uid], uid: paxos.uid }, function(v){
            return !(v.v.d in iToUID);
          });
        }
      }, 50+rng.nextInt() % 100);
      if (is[paxos.uid] > requests){
        bail = true;
        done(null);
      }
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

function testWhenAcceptFails2(paxoss, done){
  var send = true;
  var bail = false;
  paxoss.forEach(function(paxos){
    var commits = {};
    paxos.on('commit', function(v){
      var err = checkCommits(paxos.uid, commits, v);
      if (err){
        done(err);
        bail = true;
        return;
      }
      if (v.d === '1'){
        done(null);
        return;
      }
      if (send && paxos.uid === 0){
        paxoss[0].serverRPCPool.forEach(function(rpc){
          if (rpc.targetName == 2)
            rpc.conn.dropNone();
        });
        if (!bail)
          paxoss[0].request({ d: '1' }, function(){ return true; });
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
  paxoss[0].request({ d: '0' }, function(){ return true; });
}

function testWhenAcceptFails(paxoss, done){
  var bail = false;
  paxoss.forEach(function(paxos){
    var commits = {};
    paxos.on('commit', function(v){
      var err = checkCommits(paxos.uid, commits, v);
      if (err){
        done(err);
        bail = true;
        return;
      }
      if (v.d === '0'){
        done(null);
      }
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
  if (!bail)
    paxoss[0].request({ d: '0' }, function(){ return true; });
}

function testWhenLeaderDies2(paxoss, done){
  var bail = false;
  paxoss.forEach(function(paxos){
    var commits = {};
    paxos.on('commit', function(v){
      var err = checkCommits(paxos.uid, commits, v);
      if (err){
        done(err);
        bail = true;
        return;
      }
      if (v.d === '1'){
        done(null);
      }
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
    if (!bail)
      paxoss[1].request({ d: '1' }, function(){ return true; });
  });
  if (!bail)
    paxoss[0].request({ d: '0' }, function(){ return true; });
}

function testWhenLeaderDies1(paxoss, done){
  var bail = false;
  paxoss.forEach(function(paxos){
    var commits = {};
    paxos.on('commit', function(v){
      var err = checkCommits(paxos.uid, commits, v);
      if (err){
        done(err);
        bail = true;
        return;
      }
      if (v.d === '1'){
        done(null);
      }
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
    if (!bail)
      paxoss[1].request({ d: '1' }, function(){ return true; });
  });
  if (!bail)
    paxoss[0].request({ d: '0' }, function(){ return true; });
}

function testWhenLeaderDies0(paxoss, done){
  var bail = false;
  paxoss.forEach(function(paxos){
    var commits = {};
    paxos.on('commit', function(v){
      var err = checkCommits(paxos.uid, commits, v);
      if (err){
        done(err);
        bail = true;
        return;
      }
      if (v.d === '1'){
        done(null);
      }
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
    if (!bail)
      paxoss[1].request({ d: '1' }, function(){ return true; });
  });
  if (!bail)
    paxoss[0].request({ d: '0' }, function(){ return true; });
}

function testWhenNonLeaderDies(paxoss, done){
  var bail = false;
  paxoss.forEach(function(paxos){
    var commits = {};
    paxos.on('commit', function(v){
      var err = checkCommits(paxos.uid, commits, v);
      if (err){
        done(err);
        bail = true;
        return;
      }
      if (paxos.uid == 0 && v.d === '0'){
        paxos.serverRPCPool[0].conn.dropAll();
        if (!bail)
          paxos.request({ d: '1' }, function(){ return true; });
      } else if (v.d === '1'){
        done(null);
      }
    });
  });
  paxoss[0].request({ d: '0' }, function(){ return true; });
}

function testWhenShittyTakeTurns(requests, paxoss, done){
  var rng = new Utils.RNG(440);
  var maxIByUID = {};
  var doneByUID = {};
  var bail = false;
  paxoss.forEach(function(paxos){
    doneByUID[paxos.uid] = false;
    maxIByUID[paxos.uid] = 0;
    paxos.serverRPCPool.forEach(function(rpc){
      rpc.conn.startBeingShitty();
    });
    var commits = {};
    paxos.on('commit', function(v){
      //console.log(paxos.uid, 'got', 'commit', v)
      if (maxIByUID[paxos.uid] >= v.d){
        done(new Error('was less than!', paxos.uid, v.d, maxIByUID[paxos.uid]));
        bail = true;
        return;
      } 
      maxIByUID[paxos.uid] = v.d;

      if (maxIByUID[paxos.uid] < requests){
        if (!bail){
          paxos.request({ d: maxIByUID[paxos.uid]+1 }, 
                        function(v){ 
                          return maxIByUID[paxos.uid] < v.v.d;
                        });
        }
      } else {
        doneByUID[paxos.uid] = true;
        var allDone = true;
        for (var uid in doneByUID){
          allDone = allDone && doneByUID[uid]
        }
        if (allDone){
          done(null);
        }
      }
    });
  });
  paxoss[0].request({ d: maxIByUID[0]+1 }, function(){ return true; });
}

function testWhenShitty(requests, paxoss, done){
  var doneByUID = {};
  var bail = false;
  paxoss.forEach(function(paxos){
    doneByUID[paxos.uid] = false;
    paxos.serverRPCPool.forEach(function(rpc){
      rpc.conn.startBeingShitty();
    });
    var commits = {};
    paxos.on('commit', function(v){
      var err = checkCommits(paxos.uid, commits, v);
      if (err){
        done(err);
        bail = true;
        return;
      }
      if (paxos.uid == 0 && i < requests){
        i += 1;
        if (!bail)
          paxos.request({ d: i }, function(){ return true; });
      } else {
        doneByUID[paxos.uid] = true;
        var allDone = true;
        for (var uid in doneByUID){
          allDone = allDone && doneByUID[uid]
        }
        if (allDone){
          done(null);
        }
      }
    });
  });
  var i = 0;
  paxoss[0].request({ d: i }, function(){ return true; });
}

function checkCommits(uid, commits, v){
  if (commits[v.d]){
    return new Error(uid + ' duplicate v.d! ' + v.d);
  }
  commits[v.d] = true;
  for (var i = 0; i <= v.d; i++){
    if (!(i in commits)){
      return new Error(uid + ' missing v.d! ' + i);
    }
  }
}
