var cloasis = require('./cloasis').Cloasis;

var WebSocketServer = require('ws').Client;

// cloasis.hostport = 'ws://localhost:32202'
cloasis.registerUser('evan', 'arst', function(err, session){
  if (err) {
    console.log(err);
    cloasis.loginUser('evan', 'arst', onLogin)
  } else {
    onLogin(err, session);
  }
});


function onLogin(err, session) {
    console.log(err);
  if (err){
    console.log(err);
    throw err;
  }

  var isPrimeSpec = { 
    username: 'evan', 
    namespace: "evan.test.isPrime", 
    name: "isPrime", 
    version: 0.1,
    description: "Tests for not not a prime number",
    examples: [ { "some": "json" } ],
    inputSpec: { "a": "json" },
    outputSpec: { "b": "json" }
  };

  var isNotPrimeSpec = { 
    username: 'evan', 
    namespace: "evan.test.isNotPrime", 
    name: "isNotPrime", 
    version: 0.1,
    description: "Tests for not a prime number",
    examples: [ { "some": "json" } ],
    inputSpec: { "a": "json" },
    outputSpec: { "b": "json" }
  };

  var apiId2 = {
    name: "isNotPrime", 
    namespace: "evan.test.isNotPrime", 
    version: 0.1
  };

  var apiId1 = {
    name: "isPrime", 
    namespace: "evan.test.isPrime",
    version: 0.1
  };

  session.register(isPrimeSpec, isNotPrimeSpec, function(err){
    session.activate({ fn: isPrime, apiIdentifier: apiId1 }, function(err){
      if (err){
        console.log(err);
        throw err;
      }
      session.info(apiId1, apiId2, function(err, output){
        if (err){
          console.log(err);
          throw err;
        }
        console.log(output);
        //session.call(apiId1, { n: 7 }, function(err, output){
        //  if (err)
        //    throw err;
        //  console.log(output);
        //});
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
