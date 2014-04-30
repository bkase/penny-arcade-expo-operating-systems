var cloasis = require('../cloasis').Cloasis;

cloasis.hostport = ['localhost', 32200];

cloasis.registerUser('evan', 'arst', function(err, session){
  if (err)
    throwErr('user not registered');

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

  session.register(isPrimeSpec, function(err){
    if (err)
      throwErr('could not register');
    session.register(isNotPrimeSpec, isPrimeSpec, function(err){
      if (!err)
        throwErr('no errs');
      process.exit(0)
    });
  });
});

function throwErr(err){
  console.warn(err);
  process.exit(1);
}

