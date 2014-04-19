var cloasis = require('./cloasis').Cloasis;

var WebSocketServer = require('ws').Client;

cloasis.registerUser('evan', 'arst', function(err, session){
  //if (err)
  //  throw err;

  var apiId = { namespace: "#", name: "3", version: "!" };

  session.register(apiId, function(err){
    session.activate({ fn: myfn, apiIdentifier: apiId }, function(err){
      if (err)
        throw err;
      session.call(apiId, { data: 'i am input' }, function(err, output){
        if (err)
          throw err;
        console.log(output);
      });
    });
  });
});

function myfn(input, done){
  done({ a: 'aintiaerst', input: input });
}
