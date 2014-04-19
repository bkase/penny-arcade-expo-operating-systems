var cloasis = require('./cloasis').Cloasis;

var WebSocketServer = require('ws').Client;

cloasis.registerUser('evan', 'arst', function(err, session){
  if (err)
    throw err;
  console.log("#");

  session.register({ }, function(err){
    if (err)
      throw err;
    console.log(output);
  });
});
