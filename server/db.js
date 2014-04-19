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
        console.log("in this.trnasatction");
        return function() {
          Utils.waterfall([
            function(next) {
              console.log("in first waterfall", next);
              var users = schema.users;
              var query = users.select(users.star()).from(users).where(users.username.equals(username)).toQuery();
              console.log("doing query", query);
              client.query(query.text, query.values, next); 
            },

            function(result, next) {
              console.log("in second waterfall");
              if (result.rows.length > 0) {
                revert(function() {
                  next(null, true);
                });
              } else {
                next(null, false);
              }
            },

            function(isExist, next) {
              if (isExist) {
                next(null, true);
              } else {
                var query = schema.users.insert({'username':username, 'passhash':this._passwordToHash(username, password)}).toQuery();
                client.query(query.text, query.values, function(err, res) {
                  if (err) {
                    next(err);
                  } else {
                    next(null, false);
                  }
                });
              }
            }.bind(this)

          ], function done(err, isExist) {
            if (err) {
              console.log(err);
              revert(finish);
              return;
            } else {
              finish(null, isExist);
            }
          });
        }.bind(this);
      }.bind(this));
    }.bind(this));
  },

  transaction: function(client, done, andThen) {
    client.query('BEGIN', function(err) {
      console.log("begin transaction");
      var revert = this.rollback(client)
      if (err) return revert(done);
      process.nextTick(andThen(revert, function andThenFinished() {
        console.log("end transaction");
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
        console.log("Rolling back", err);
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
