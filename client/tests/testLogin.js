var cloasis = require('../cloasis').Cloasis;

cloasis.hostport = ['localhost', 32200];

cloasis.loginUser('evan', 'arst', function(err, session){
  if (!err)
    throwErr('user logged in too early');
  cloasis.registerUser('evan', 'arst', function(err, session){
    if (err)
      throwErr('user not registered');
    cloasis.loginUser('evan', 'arst', function(err, session){
      if (err)
        throwErr('user couldn\'t log in');
      else
        process.exit(0);
    });
  });
});

function throwErr(err){
  console.warn(err);
  process.exit(1);
}

