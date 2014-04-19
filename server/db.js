var crypto = require('crypto');


function DB(){

}

DB.prototype = {
  constructor: DB,

  createUser: function(username, password, done){

  },

  validateUser: function(username, password, done){

  },

  registerAPIs: function(apiSpecs, done){

  },

  searchAPIs: function(query, done){

  },

  infoAPIs: function(apiIds, done){

  },

  //should activate/deactive be in memory or in the db?

  _passwordToHash: function(username, password){
    var shasum = crypto.createHash('sha256');
    shasum.update(username);
    shasum.update(password);
    var hash = shasum.digest('hex');
    return hash;
  },
}

exports.DB = DB;
