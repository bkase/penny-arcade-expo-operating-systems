var cloasis = require('../cloasis').Cloasis;

cloasis.hostport = ['localhost', 32200];

cloasis.registerUser('evan', 'arst', function(err, session){
  if (err)
    throwErr('user not registered');
  cloasis.registerUser('evan', 'arst', function(err, session){
    if (err)
      process.exit(0);
    else
      throwErr('user registered twice');
  });
});

function throwErr(err){
  console.warn(err);
  process.exit(1);
}

