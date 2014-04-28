var Connection = require('../common/shittyConnection').Connection;
var WebSocketServer = require('ws').Server;
var RPC = require('../common/rpc').RPC;
var WebSocket = require('ws');
var Paxos = require('./paxos').Paxos;

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
                paxoss[k] = new Paxos(k, rpcs[k]);
              }
              next(paxoss, kill);
            }
          });
        });
      }
    }
  }

  function kill(){
    for (var i = 0; i < paxoss.length; i++){
      paxoss[i].stop();
    }
    for (var i = 0; i < rpcs.length; i++){
      for (var j = 0; j < rpcs[i].length; j++){
        rpcs[i][j].conn.close();
      }
    }
    for (var i = 0; i < servers.length; i++){
      servers[i].close();
    }
  }
}

exports.Test = Test;
exports.doTests = doTests;
