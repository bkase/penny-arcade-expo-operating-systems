var Connection = require('../common/connection').Connection;
var RPC = require('../common/rpc').RPC;
var DB = require('./db').DB;
var Utils = require('../common/utils').Utils;
var Paxos = require('./recoveryPaxos').RecoveryPaxos;
var WebSocket = require('ws');
var WebSocketServer = require('ws').Server;

function init(
  paxosPort, 
  paxosUID, 
  paxosHostportByUID, 
  done
){

  var rpcs = [];

  Paxos.setRNGSeed(440+paxosUID);

  var toConn = Utils.size(paxosHostportByUID);
  var connCount = Utils.count(toConn, onConn);

  var wss = new WebSocketServer({port: paxosPort});
  wss.on('connection', function(ws){
    var conn = new Connection(ws);
    var rpc = new RPC(conn);
    rpc.name = paxosUID;
    rpc.on('setFrom', function(from, done){
      rpc.targetName = from;
      rpc.id = paxosUID + ',' + from;
      rpcs.push(rpc);
      connCount.sub();
      done();
    });
  });

  setTimeout(function(){
    for (var uid in paxosHostportByUID){
      if (uid > paxosUID){
        var conn = new Connection(new WebSocket(paxosHostportByUID[uid]));
        var rpc = new RPC(conn);
        rpcs.push(rpc);
        rpc.name = paxosUID;
        rpc.targetName = uid;
        with ({ uid: uid, conn: conn, rpc: rpc }){
          conn.on('open', function() {
            rpc.call('setFrom', paxosUID, function(){
              rpc.id = paxosUID + ',' + uid;
              connCount.sub();
            });
          });
        }
      }
    }
  }, 500);

  function onConn(){
    var paxos = new Paxos(paxosUID, rpcs, 
                          killPaxos, revive, connect, 
                          null);
    done(null, paxos);
  }
}

function revive(numServers, uid, done){
  throw new Error('nyi');
  var hostport = 'ws://localhost:' + (startPort+uid);
  var wss;
  var tries = 0;
  var wait = 50;
  setTimeout(function loop(){
    tries += 1;
    isPortTaken(startPort+uid, function(err, portIsTaken){
      if (err || portIsTaken){
        killPaxos(uid);
      }
      isPortTaken(startPort+uid, function(err, portIsTaken){
        if (!err && !portIsTaken){
          wss = new WebSocketServer({port: startPort+uid});
          next();
        } else {
          done('revive failed');
        }
      });
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

function connect(paxos, I, hostport, uid, done){
  throw new Error('nyi');
  var conn = new Connection(new WebSocket(hostport));
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
  throw new Error('nyi');
  try {
    servers[k].close();
  } catch (e) { }
}

exports.init = init
