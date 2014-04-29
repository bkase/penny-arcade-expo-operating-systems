var Utils = require('../common/utils').Utils;
var doTests = require('./paxosTestUtils').doTests;

var tests = [
  [3, 1, testNodeFailure],
  [3, 1, testMultiNodeFailure],
  [3, 1, testConnFailure],
  [5, 1, testNodeFailureChain],
  [7, 1, testNodeFailureChain],
  [9, 1, testNodeFailureChain],
  [11, 1, testNodeFailureChain],
  [13, 1, testNodeFailureChain],
  [3, 1, testNodeFailSend],

  [3, 1, testHeartbeat],

  [3, 1, testWhenLeaderDies2],
  [3, 1, testWhenAcceptFails],
  [3, 1, testWhenAcceptFails2],
  [3, 1, testWhenNonLeaderDies],
  [3, 1, testWhenLeaderDies0],
  [3, 1, testWhenLeaderDies1],

  [3,  .8, testWhenShitty.bind(null, 100)],
  [3,  .8, testMultiSend.bind(null, 100)],
  [3,  .8, testWhenShittyTakeTurns.bind(null, 100)],
  [5,  .8, testWhenShitty.bind(null, 100)],
  [5,  .8, testMultiSend.bind(null, 100)],
  [5,  .8, testWhenShittyTakeTurns.bind(null, 100)],
  [7,  .8, testWhenShitty.bind(null, 100)],
  [7,  .8, testMultiSend.bind(null, 100)],
  [7,  .8, testWhenShittyTakeTurns.bind(null, 100)],
  [11, .8, testWhenShitty.bind(null, 100)],
  [11, .8, testMultiSend.bind(null, 100)],
  [11, .8, testWhenShittyTakeTurns.bind(null, 100)],

  //[3, .8, testWhenShitty.bind(null, 1000)],
  //[3, .8, testMultiSend.bind(null, 1000)],
  //[3, .8, testWhenShittyTakeTurns.bind(null, 1000)],
  //[5, .8, testWhenShitty.bind(null, 1000)],
  //[5, .8, testMultiSend.bind(null, 1000)],
  //[5, .8, testWhenShittyTakeTurns.bind(null, 1000)],
  //[7, .8, testWhenShitty.bind(null, 1000)],
  //[7, .8, testMultiSend.bind(null, 1000)],
  //[7, .8, testWhenShittyTakeTurns.bind(null, 1000)],
  //[11, .9, testWhenShitty.bind(null, 1000)],
  //[11, .9, testMultiSend.bind(null, 1000)],
  //[11, .9, testWhenShittyTakeTurns.bind(null, 1000)],
];

var t0 = Date.now();
doTests(tests, function(err){
  if (err)
    throw err;
  console.log(Date.now() - t0);
  process.exit(0);
});

function testNodeFailure(paxoss, done){
  var recoverCount = 0;
  var isDone = false;
  paxoss.forEach(function(paxos){
    paxos.on('recovered', function(uid){
      recoverCount += 1;
      if (recoverCount == 2){
        paxoss[1].on('commit', function(v, commitDone){
          if (!isDone)
            done(null);
          isDone = true;
          commitDone();
        });
      }
    });
  });
  setTimeout(function(){
    if (!isDone)
      done(new Error('timed out'));
    isDone = true;
  }, 3000);
  paxoss[1].stop();
  paxoss[0].request('someval', function(done){ done(true); });
}

function testMultiNodeFailure(paxoss, done){
  var recoverCount = 0;
  var timesToFail = 3;
  var isDone = false;
  paxoss.forEach(function(paxos){
    paxos.on('recovered', function(uid){
      recoverCount += 1;
      if (recoverCount %2 === 0){
        if (recoverCount/2 == timesToFail){
          paxoss[1].on('commit', function(v, commitDone){
            if (!isDone)
              done(null);
            isDone = true;
            commitDone();
          });
        }
        else {
          paxoss[1].on('commit', function(v, commitDone){
            paxoss[1].stop();
          });
        }
      }
    });
  });
  setTimeout(function(){
    if (!isDone)
      done(new Error('timed out'));
    isDone = true;
  }, 3000*timesToFail);
  paxoss[1].stop();
  paxoss[0].request('someval', function(done){ done(true); });
}

function testConnFailure(paxoss, done){
  var isDone = false;
  var recoverCount = 0;
  paxoss.forEach(function(paxos){
    paxos.on('recovered', function(uid){
      recoverCount++;
      if (recoverCount == 2){
        paxoss[uid].on('commit', function(v, commitDone){
          if (!isDone)
            done(null);
          isDone = true;
          commitDone();
        });
      }
    });
  });
  setTimeout(function(){
    if (!isDone)
      done(new Error('timed out'));
    isDone = true;
  }, 4000);
  paxoss[1].serverRPCPool[0].conn.close();
  paxoss[2].request('someval', function(done){ done(true); });
}

function testNodeFailureChain(paxoss, done){
  var isDone = false;
  var recoverCount = 0;
  var killed = 1;
  var numRecovered = 0;
  var N = paxoss.length;
  paxoss.forEach(function(paxos){
    paxos.on('reviving', function(uid){
      if (killed < Math.floor(N/2)){
        killed += 1;
        paxos.stop();
      }
    });
    paxos.on('recovered', function(uid){
      numRecovered += 1;
      if (numRecovered == killed*(N-killed)){
        if (!isDone)
          done(null);
        isDone = true;
      }
    });
  });
  setTimeout(function(){
    if (!isDone)
      done(new Error('timed out'));
    isDone = true;
  }, 5000);
  paxoss[1].serverRPCPool[0].conn.close();
}

function testNodeFailSend(paxoss, done){
  var recoverCount = 0;
  var isDone = false;
  paxoss.forEach(function(paxos){
    paxos.on('recovered', function(uid){
      recoverCount += 1;
      if (recoverCount == 2){
        paxoss[1].request('someval2', function(done){ done(true); });
        paxoss[0].on('commit', function(v, commitDone){
          if (v === 'someval2'){
            if (!isDone)
              done(null);
            isDone = true;
            commitDone();
          }
        });
      }
    });
  });
  setTimeout(function(){
    if (!isDone)
      done(new Error('timed out'));
    isDone = true;
  }, 5000);
  paxoss[1].request('someval', function(done){ done(true); });
  setTimeout(function(){
    paxoss[1].stop();
  }, 100);
}

function testHeartbeat(paxoss, done){
  var bail = false;
  paxoss.forEach(function(paxos){
    var commits = {};
    paxos.on('commit', function(v, commitDone){
      var err = checkCommits(paxos.uid, commits, v);
      if (err){
        done(err);
        bail = true;
        return;
      }
      if (paxos.uid === 0 && v.d === '0' && !bail){
        paxoss[0].serverRPCPool.forEach(function(rpc){
          if (rpc.targetName == 2)
            rpc.conn.dropAll();
        });
        paxoss[1].serverRPCPool.forEach(function(rpc){
          if (rpc.targetName == 2)
            rpc.conn.dropAll();
        });
        paxoss[0].request({ d: '1' }, function(done){ done(true); });
      }
      if (paxos.uid === 0 && v.d === '1' && !bail){
        paxoss[0].serverRPCPool.forEach(function(rpc){
          if (rpc.targetName == 2)
            rpc.conn.dropNone();
        });
        paxoss[1].serverRPCPool.forEach(function(rpc){
          if (rpc.targetName == 2)
            rpc.conn.dropNone();
        });
      }
      if (paxos.uid === 2 && v.d === '1' && !bail){
        done(null);
        return;
      }
      commitDone();
    });
  });
  if (!bail)
    paxoss[0].request({ d: '0' }, function(done){ done(true); });
}

function testMultiSend(requests, paxoss, done){
  var is = {};
  var iToUID = {};
  var rng = new Utils.RNG(440);
  var bail = false;
  paxoss.forEach(function(paxos){
    is[paxos.uid] = 0;
    paxos.on('commit', function(v, commitDone){
      //console.log(paxos.uid, v.d);
      if (v.d in iToUID && iToUID[v.d] !== v.uid){
        bail = true;
        done(new Error('bad commit'));
        return;
      }
      iToUID[v.d] = v.uid;
      is[paxos.uid] = v.d+1;
      if (!bail){
        paxos.request({ d: is[paxos.uid], uid: paxos.uid }, function(done, v){
          //console.log(v.v.d, paxos.uid, iToUID[v.v.d], is[paxos.uid], v)
          return done(!(v.d in iToUID));
        });
      }
      if (is[paxos.uid] > requests){
        bail = true;
        done(null);
      }
      commitDone();
    });
  });
  paxoss[0].once('sendAccept', function(){
    paxoss[0].serverRPCPool.forEach(function(rpc){
      if (rpc.targetName == 2)
        rpc.conn.dropAll();
    });
  });
  paxoss[0].request({ d: is[0], uid: 0 }, function(done, v){ done(!(v.d in iToUID)); });
  paxoss[1].request({ d: is[1], uid: 1 }, function(done, v){ done(!(v.d in iToUID)); });
  paxoss[2].request({ d: is[2], uid: 2 }, function(done, v){ done(!(v.d in iToUID)); });
}

function testWhenAcceptFails2(paxoss, done){
  var send = true;
  var bail = false;
  paxoss.forEach(function(paxos){
    var commits = {};
    paxos.on('commit', function(v, commitDone){
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
          paxoss[0].request({ d: '1' }, function(done){ done(true); });
        send = false;
      }
      commitDone();
    });
  });
  paxoss[0].once('sendAccept', function(){
    paxoss[0].serverRPCPool.forEach(function(rpc){
      if (rpc.targetName == 2)
        rpc.conn.dropAll();
    });
  });
  paxoss[0].request({ d: '0' }, function(done){ done(true); });
}

function testWhenAcceptFails(paxoss, done){
  var bail = false;
  paxoss.forEach(function(paxos){
    var commits = {};
    paxos.on('commit', function(v, commitDone){
      var err = checkCommits(paxos.uid, commits, v);
      if (err){
        done(err);
        bail = true;
        return;
      }
      if (v.d === '0'){
        done(null);
      }
      commitDone();
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
    paxoss[0].request({ d: '0' }, function(done){ done(true); });
}

function testWhenLeaderDies2(paxoss, done){
  var bail = false;
  paxoss.forEach(function(paxos){
    var commits = {};
    paxos.on('commit', function(v, commitDone){
      var err = checkCommits(paxos.uid, commits, v);
      if (err){
        done(err);
        bail = true;
        return;
      }
      if (v.d === '1'){
        done(null);
      }
      commitDone();
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
      paxoss[1].request({ d: '1' }, function(done){ done(true); });
  });
  if (!bail)
    paxoss[0].request({ d: '0' }, function(done){ done(true); });
}

function testWhenLeaderDies1(paxoss, done){
  var bail = false;
  paxoss.forEach(function(paxos){
    var commits = {};
    paxos.on('commit', function(v, commitDone){
      var err = checkCommits(paxos.uid, commits, v);
      if (err){
        done(err);
        bail = true;
        return;
      }
      if (v.d === '1'){
        done(null);
      }
      commitDone();
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
      paxoss[1].request({ d: '1' }, function(done){ done(true); });
  });
  if (!bail)
    paxoss[0].request({ d: '0' }, function(done){ done(true); });
}

function testWhenLeaderDies0(paxoss, done){
  var bail = false;
  paxoss.forEach(function(paxos){
    var commits = {};
    paxos.on('commit', function(v, commitDone){
      var err = checkCommits(paxos.uid, commits, v);
      if (err){
        done(err);
        bail = true;
        return;
      }
      if (v.d === '1'){
        done(null);
      }
      commitDone();
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
      paxoss[1].request({ d: '1' }, function(done){ done(true); });
  });
  if (!bail)
    paxoss[0].request({ d: '0' }, function(done){ done(true); });
}

function testWhenNonLeaderDies(paxoss, done){
  var bail = false;
  paxoss.forEach(function(paxos){
    var commits = {};
    paxos.on('commit', function(v, commitDone){
      var err = checkCommits(paxos.uid, commits, v);
      if (err){
        done(err);
        bail = true;
        return;
      }
      if (paxos.uid == 0 && v.d === '0'){
        paxos.serverRPCPool[0].conn.dropAll();
        if (!bail)
          paxos.request({ d: '1' }, function(done){ done(true); });
      } else if (v.d === '1'){
        done(null);
      }
      commitDone();
    });
  });
  paxoss[0].request({ d: '0' }, function(done){ done(true); });
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
    paxos.on('commit', function(v, commitDone){
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
                        function(done, v){ 
                          done(maxIByUID[paxos.uid] < v.d);
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
      commitDone();
    });
  });
  paxoss[0].request({ d: maxIByUID[0]+1 }, function(done){ done(true); });
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
    paxos.on('commit', function(v, commitDone){
      //console.log(paxos.uid, v.d);
      var err = checkCommits(paxos.uid, commits, v);
      if (err){
        done(err);
        bail = true;
        return;
      }
      if (paxos.uid == 0 && i < requests){
        i += 1;
        if (!bail)
          paxos.request({ d: i }, function(done){ done(true); });
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
      commitDone();
    });
  });
  var i = 0;
  paxoss[0].request({ d: i }, function(done){ done(true); });
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
