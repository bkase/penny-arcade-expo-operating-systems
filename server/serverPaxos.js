var Connection = require('../common/connection').Connection;
var RPC = require('../common/rpc').RPC;
var DB = require('./db').DB;
var Utils = require('../common/utils').Utils;
var Paxos = require('./recoveryPaxos').RecoveryPaxos;
var WebSocket = require('ws');
var WebSocketServer = require('ws').Server;

var startServer = require('../startServer').startServer;

function init(
  paxosUID, 
  paxosPortByUID,
  paxosAllHostportByUID, 
  paxosClientPortByUID,
  paxosIsRevive,
  done
){

  var paxosHostportByUID = JSON.parse(JSON.stringify(paxosAllHostportByUID));
  delete paxosHostportByUID[paxosUID];

  var paxosPort = paxosPortByUID[paxosUID];

  var rpcs = [];
  var wss = null;
  var paxos = null;
  var I = null;
  (function loop(){
    Utils.isPortTaken(paxosPort, function(err, portIsTaken){
      if (err || portIsTaken){
        console.log('could not start server, retrying');
        setTimeout(loop, 500);
      } else {
        console.log("starting server");
        wss = new WebSocketServer({port: paxosPort});
        Paxos.setRNGSeed(440+paxosUID);

        if (paxosIsRevive)
          connRevive();
        else
          connNormal();
      }
    });
  })();


  function connRevive(){
    var toConn = Utils.size(paxosHostportByUID);
    var connCount = Utils.count(toConn, onConn);
    wss.on('connection', function(ws) {
      var conn = new Connection(ws);
      var rpc = new RPC(conn);
      rpc.name = paxosUID;
      rpc.on('setFrom', function(data, done){
        var from = data.from;
        I = data.I;
        rpc.targetName = from;
        rpc.id = paxosUID + ',' + from;
        rpcs.push(rpc);
        connCount.sub();
      });
    });
  }

  function connNormal(){
    var toConn = Utils.size(paxosHostportByUID);
    var connCount = Utils.count(toConn, onConn);

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
  }

  function onConn(){
    paxos = new Paxos(paxosUID, rpcs, 
                      killPaxos, revive, connect, 
                      I);
    done(null, paxos);
  }

  function revive(numServers, uid, done){
    var hostport = paxosHostportByUID[uid];
    var tries = 0;
    var wait = 50;

    startServer(uid, paxosPortByUID, paxosAllHostportByUID, paxosClientPortByUID, true)

    setTimeout(function(){
      done(null, paxosAllHostportByUID[uid]);
    }, 1000);
  }

  function connect(paxos, I, hostport, uid, done){
    var conn = new Connection(new WebSocket(hostport));
    var rpc = new RPC(conn);
    rpc.name = paxos.uid;
    rpc.targetName = uid;
    conn.on('open', function() {
      rpc.call('setFrom', { from: paxos.uid, I: I }, function(){
        rpc.id = paxos.uid + ',' + uid;
        paxos.setRPC(uid, rpc);
        done(null);
      });
    });
  }

  function killPaxos(){
    try {
      wss.close()
    } catch (e) { }
    process.exit(0);
  }

  process.on('SIGINT', function(){
    try {
      wss.close()
    } catch (e) { }
    if (paxos)
      paxos.stop();
  });
}


exports.init = init
