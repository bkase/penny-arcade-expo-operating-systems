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

  var apiId1 = {
    name: "isPrime", 
    namespace: "evan.test.isPrime",
    version: 0.1
  };

  session.register(isPrimeSpec, function(err){
    if (err)
      throwErr('could not register');
    session.register(isPrimeSpec, isNotPrimeSpec, function(err){
      if (!err)
        throwErr('no errs');
      session.search("Prime", function(err, output){
        if (err)
          throwErr('could not search');
        if (output.length !== 2)
          throwErr('wrong results');
        session.search("NotPrime", function(err, output){
          if (err)
            throwErr('could not search');
          if (output.length !== 1)
            throwErr('wrong results');
          session.info(output[0], function(err, output){
            if (err)
              throwErr('could not get info');
            if (output.apis[0].username !== isNotPrimeSpec.username ||
                output.apis[0].name !== isNotPrimeSpec.name ||
                output.apis[0].namespace !== isNotPrimeSpec.namespace ||
                output.apis[0].description !== isNotPrimeSpec.description){
              throwErr('wrong api info');
            }
            process.exit(0);
          });
        });
      });
    });
  });
});

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

function throwErr(err){
  console.warn(err);
  process.exit(1);
}

