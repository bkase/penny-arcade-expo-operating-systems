var colors = require('colors');
var spawn = require('child_process').spawn;
var extend = require('util')._extend;

var portsByUID = {}
var hostportByUID = {};
var N = 3;
var startPort = 15000;
var startClientPort = 13000;
for (var uid = 0; uid < N; uid++){
  var port = startPort + uid;
  portsByUID[uid] = port;
  hostportByUID[uid] = 'ws://localhost:' + port;
}

var processByUID = {};

for (var uid = 0; uid < N; uid++){
  processByUID[uid] = startServer(startClientPort+uid, uid, portsByUID[uid], hostportByUID);
}

setTimeout(function(){
  processByUID[0].kill();
}, 2000);

function startServer(clientPort, uid, port, hostportByUID){
  var hostportByUID = JSON.parse(JSON.stringify(hostportByUID));
  delete hostportByUID[uid];
  var process = spawn('node', ['server/server.js', clientPort, uid, port, JSON.stringify(hostportByUID)]);

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
