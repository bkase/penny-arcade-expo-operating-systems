var fs = require('fs');
var express = require('express');
var server = express();

fs.readFile('./cloasisLib.js', function(err, file){
  if (err)
    throw err;
  var lib = file.toString();
 
  server.get('/cloasisLib.js', function(request, response){
    response.setHeader('content-type', 'text/javascript');
    response.send(lib);
  });
 
  server.listen(20400);
});
