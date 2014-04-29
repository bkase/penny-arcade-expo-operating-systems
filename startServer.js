
var colors = require('colors');
var spawn = require('child_process').spawn;
var extend = require('util')._extend;

if (require.main === module){
  var portsByUID = {}
  var hostportByUID = {};
  var clientPortByUID = {};
  var N = 3;
  var startPort = 31200;
  var startClientPort = startPort+1000;
  for (var uid = 0; uid < N; uid++){
    var port = startPort + uid;
    portsByUID[uid] = port;
    hostportByUID[uid] = 'ws://localhost:' + port;
    clientPortByUID[uid] = startClientPort + uid;
  }

  var processByUID = {};

  for (var uid = 0; uid < N; uid++){
    processByUID[uid] = startServer(uid, portsByUID, hostportByUID, clientPortByUID, false);
  }
}

function startServer(uid, portsByUID, hostportByUID, clientPortByUID, isRevive){
  var reviveArg = 0;
  if (isRevive)
    isRevive = 1;
  var process = spawn('node', ['server/server.js', uid, JSON.stringify(portsByUID), JSON.stringify(hostportByUID), JSON.stringify(clientPortByUID), isRevive]);

  process.stdout.on('data', function(data){
    console.log((uid + 'stdout: ' + data).blue);
  });

  process.stderr.on('data', function(data){
    console.log((uid + 'stderr: ' + data).red);
  });

  process.on('close', function(code){
    console.log('child process exited with code ' + code);
  });

  return process;
}

exports.startServer = startServer;
