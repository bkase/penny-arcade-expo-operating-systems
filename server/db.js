var crypto = require('crypto');
var sql = require('sql');
var schema = require('./schema');
var pg = require('pg');
var Utils = require('../common/utils').Utils;

function DB(conString){
  this.conString = conString;
}

DB.prototype = {
  constructor: DB,

  freeAndDone: function(free, done) {
    return function() {
      free();
      done();
    };
  },

  createUser: function(username, password, done){
    // TODO: MAKE SURE USER EXISTS
    pg.connect(this.conString, function(err, client, freeClient) {
      if (err) {
        done(err);
        return;
      }

      this.transaction(client, this.freeAndDone(freeClient, done), function(revert, finish) {
        return function() {
          
          var query = schema.users.insert({'username':username, 'passhash':this._passwordToHash(username, password)}).toQuery();
          client.query(query.text, query.values, function(err, result) {
            if (err) {
              finish(err);
              return;
            }

            finish(null, true);
          }.bind(this));
        }.bind(this);
      }.bind(this));
    }.bind(this));
  },

  transaction: function(client, done, andThen) {
    client.query('BEGIN', function(err) {
      var revert = this.rollback(client)
      if (err) return revert(done);
      process.nextTick(andThen(revert, function andThenFinished() {
        var args = Utils.arrayify(arguments);
        args.unshift(null);
        console.log("committing transaction");
        client.query('COMMIT', done.bind.apply(done, args));
      }));
    }.bind(this));
  },

  rollback: function(client) {
    return function(done) {
      client.query('ROLLBACK', function(err) {
        return done(err);
      });
    }.bind(this);
  }.bind(this),

  validateUser: function(username, password, done){

  },

  registerAPIs: function(apiSpecs, done){
    done(null);
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
