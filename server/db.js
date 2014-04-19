var crypto = require('crypto');
var sql = require('sql');
var schema = require('./schema');
var pg = require('pg');
var conString = "postgres://bkase@localhost/cloasis";

function DB(){

}

DB.prototype = {
  constructor: DB,

  createUser: function(username, password, done){
    // TODO: MAKE SURE USER EXISTS
    pg.connect(conString, function(err, client, freeClient) {
      if (err) {
        done(err);
        return;
      }

      var query = schema.users.insert({'username':username, 'passhash':this._passwordToHash(username, password)}).toQuery();
      console.log(query.text, query.values);
      client.query(query.text, query.values, function(err, result) {
        freeClient();

        if (err) {
          done(err);
          return;
        }

        done(null, true);
      }.bind(this));
    }.bind(this));
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
