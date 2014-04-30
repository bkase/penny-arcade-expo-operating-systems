var spawn = require('child_process').spawn;
var colors = require('colors');
var fs = require('fs');



var Utils = require('./common/utils').Utils;
var servers = null;

function clearDB(done){
  Utils.waterfall([
    function(next){
      startProcess('./killTables.sh', [], true).on('close', function(){ next(); });
    },
    function(next){
      startProcess('./makeTables.sh', [], true).on('close', function(){ next(); });
    },
  ], done);
}

Utils.waterfall([
  function(next){
    servers = startProcess('node', ['startServer.js']);
    setTimeout(next, 2000);
  },
  function(next){
    var tests = fs.readdirSync('./client/tests');
    tests = tests.filter(function(test){ return test.indexOf('.') != 0; });
    (function loop(){
      clearDB(function(){
        var test = tests.shift();
        var process = startProcess('node', ['./client/tests/' + test]);
        process.on('close', function(code){
          if (code === 0){
            if (tests.length === 0)
              next();
            else {
              console.log('passed ' + test);
              loop();
            }
          } else {
            next('err in ' + test);
          }
        });
      });
    })();
  }
], function(err){
  if (servers)
    servers.kill('SIGINT');
  if (err)
    throw err;
});


function startProcess(cmd, args, noLog){
  var process = spawn(cmd, args);

  if (!noLog){
    process.stdout.on('data', function(data){
      console.log((cmd + ' ' + args + ' stdout: ' + data).blue);
    });

    process.stderr.on('data', function(data){
      console.log((cmd + ' ' + args +  ' stderr: ' + data).red);
    });
  }

  return process;
}
