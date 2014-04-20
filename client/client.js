var cloasis = require('./cloasis').Cloasis;

var WebSocketServer = require('ws').Client;

cloasis.registerUser('evan', 'arst', function(err, session){
  if (err) {
    cloasis.loginUser('evan', 'arst', onLogin)
  } else {
    onLogin(err, session);
  }
});


function onLogin(err, session) {
  if (err) throw err;

  var apiSpec = { 
    username: 'evan', 
    namespace: "evan.test", 
    name: "isPrime", 
    version: 0.1,
    description: "Tests for a prime number",
    examples: [ { "some": "json" } ],
    inputSpec: { "more": "json" },
    outputSpec: { "much": "more" }
  };

  var apiId = {
    name: "isPrime", 
    namespace: "evan.test", 
    version: 0.1
  };

  session.register(apiSpec, function(err){
    session.activate({ fn: isPrime, apiIdentifier: apiId }, function(err){
      if (err)
        throw err;
      session.info(apiId, function(err, output){
        console.log(output);
        session.call(apiId, { n: 7 }, function(err, output){
          if (err)
            throw err;
          console.log(output);
        });
      });
    });
  });
}

function isPrime(input, done){
  var n = input.n;
  if (n == 2)
    done({ isPrime: true });
  for (var i = 2; i < Math.sqrt(n)+1; i++){
    if (n%i == 0){
      done({ isPrime: false });
      return;
    }
  }
  done({ isPrime: true });
}
