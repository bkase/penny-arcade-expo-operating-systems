var cloasis = require('./cloasis').Cloasis;

var WebSocketServer = require('ws').Client;

cloasis.register('evan', 'arst', function(err, session){
  if (err)
    throw err;
  session.call('34234', { '34234': 3 }, function(err, output){
    if (err)
      throw err;
    console.log(output);
  });
});
