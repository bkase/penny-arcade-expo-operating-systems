var Connection = require('../common/shittyConnection').Connection;
var WebSocketServer = require('ws').Server;
var RPC = require('../common/rpc').RPC;
var WebSocket = require('ws');
var Paxos = require('./recoveryPaxos').RecoveryPaxos;
//var Paxos = require('./paxos').Paxos;

function Test(N, successRate, fn, next){
  startPaxoss(N, successRate, function(paxoss, kill){
    fn(paxoss, function(err){
      kill();
      next(err);
    })
  });
}

var TIMEOUT = 100;

var log = console.log.bind(console);
var oldBind = Function.prototype.bind;
Function.prototype.bind = function(){
  var newfn = oldBind.apply(this, arguments);
  newfn.Name = this.name;
  return newfn;
}

function doTests(tests, done){
  var test = tests.shift();
  if (test == null){
    done(null);
    return;
  }
  test.push(function(err){
    if (err){
      done(err);
      return
    }
    console.log(test[0], test[1], test[2].name || test[2].Name, ' passed');
    doTests(tests, done);
  });
  Test.apply(null,test);
};

function startPaxoss(N, successRate, next){
  var rpcs = [];  
  var servers = [];
  var paxoss = [];
  var startPort = 12000;
  for (var i = 0; i < N; i++){
    rpcs[i] = [];
    with ({i: i}){
      var wss = new WebSocketServer({port: startPort+i});
      servers[i] = wss;
      wss.on('connection', function(ws) {
        var conn = new Connection(ws, successRate);
        var rpc = new RPC(conn);
        rpc.TIMEOUT = TIMEOUT;
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
      rpc.TIMEOUT = TIMEOUT;
      rpc.name = i;
      rpc.targetName = j;
      with ({i: i, j: j, conn: conn, rpc: rpc }){
        conn.on('open', function() {
          rpc.call('setFrom', i, function(){
            //console.log('c', i,j);
            rpc.id = i + ',' + j;
            rpcs[i].push(rpc);
            toConn--;
            if (toConn === 0){
              for (var k = 0; k < rpcs.length; k++){
                paxoss[k] = new Paxos(k, rpcs[k], 
                                      killPaxos.bind(null, k), 
                                      revive.bind(null, successRate), 
                                      connect.bind(null, successRate), null);
              }
              next(paxoss, kill);
            }
          });
        });
      }
    }
  }

  //https://gist.github.com/timoxley/1689041
  function portIsTaken(port, fn) {
    var net = require('net')
    var tester = net.createServer()
    .once('error', function (err) {
      if (err.code != 'EADDRINUSE') return fn(err)
      fn(null, true)
    })
    .once('listening', function() {
      tester.once('close', function() { fn(null, false) })
      .close()
    })
    .listen(port)
  }
  //https://gist.github.com/timoxley/1689041
  function isPortTaken(port, fn) {
    var net = require('net')
    var tester = net.createServer()
    .once('error', function (err) {
      if (err.code != 'EADDRINUSE') return fn(err)
      fn(null, true)
    })
    .once('listening', function() {
      tester.once('close', function() { fn(null, false) })
      .close()
    })
    .listen(port)
  }

  function revive(successRate, numServers, uid, done){
    var hostport = 'ws://localhost:' + (startPort+uid);
    var wss;
    var tries = 0;
    var wait = 50;
    setTimeout(function loop(){
      tries += 1;
      isPortTaken(startPort+uid, function(err, portIsTaken){
        if (!err && !portIsTaken){
          wss = new WebSocketServer({port: startPort+uid});
          next();
        } else {
          if (tries < 10){
            wait *= 2;
            if (wait > 1000)
              wait = 1000;
            setTimeout(loop, wait);
          } else {
            done('revive failed');
          }
        }
      })
    }, wait);

    function next(){
      servers[uid] = wss;
      rpcs[uid] = [];
      var toConnect = numServers-1;
      wss.on('connection', function(ws) {
        var conn = new Connection(ws, successRate);
        var rpc = new RPC(conn);
        rpc.TIMEOUT = TIMEOUT;
        rpc.name = uid;
        rpc.on('setFrom', function(data, done){
          var from = data.from;
          var I = data.I;
          rpc.targetName = from;
          rpc.id = uid + ',' + from;
          rpcs[uid].push(rpc);
          toConnect--;
          if (toConnect === 0){
            paxoss[uid] = new Paxos(uid, rpcs[uid], 
                                  killPaxos.bind(null, uid), 
                                  revive.bind(null, successRate), 
                                  connect.bind(null, successRate), I);
          }
        });
      });
      //TODO when all connect, make the paxos
      done(null, hostport);
    }
  }

  function connect(successRate, paxos, I, hostport, uid, done){
    var conn = new Connection(new WebSocket(hostport), successRate);
    var rpc = new RPC(conn);
    rpc.TIMEOUT = TIMEOUT;
    rpc.name = paxos.uid;
    rpc.targetName = uid;
    conn.on('open', function() {
      rpc.call('setFrom', { from: paxos.uid, I: I }, function(){
        //console.log('c', i,j);
        rpc.id = paxos.uid + ',' + uid;
        paxos.setRPC(uid, rpc);
        done(null);
      });
    });
    //console.log('connect', paxos.uid, uid, hostport);
  }

  function killPaxos(k){
    try {
      servers[k].close();
    } catch (e) { }
  }

  function kill(){
    for (var i = 0; i < paxoss.length; i++){
      paxoss[i].stop();
    }
  }
}

exports.Test = Test;
exports.doTests = doTests;
