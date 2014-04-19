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
      done.apply(done, arguments);
    };
  },

  createUser: function(username, password, done){
    pg.connect(this.conString, function(err, client, freeClient) {
      if (err) {
        done(err);
        return;
      }

      this.transaction(client, this.freeAndDone(freeClient, done), function(revert, finish) {
        return function() {
          Utils.waterfall([
            function(next) {
              var users = schema.users;
              var query = users.select(users.star()).from(users).where(users.username.equals(username)).toQuery();
              client.query(query.text, query.values, next); 
            },

            function(result, next) {
              if (result.rows.length > 0) {
                next(null, true);
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
              revert(finish, err);
              return;
            } else {
              if (isExist) {
                revert(finish, null, true);
                return;
              } else {
                finish(null, false);
              }
            }
          });
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
        client.query('COMMIT', done.bind.apply(done, args));
      }));
    }.bind(this));
  },

  rollback: function(client) {
    return function(done, err) {
      var args = Utils.arrayify(arguments);
      args.shift();
      args.shift();
      client.query('ROLLBACK', function(rollErr) {
        if (err) {
          args.unshift(err);
        } else if (rollErr) {
          args.unshift(rollErr);
        } else {
          args.unshift(null);
        }
        return done.apply(done, args);
      });
    }.bind(this);
  }.bind(this),

  validateUser: function(username, password, done){
    pg.connect(this.conString, function(err, client, freeClient) {
      if (err) {
        done(err);
        return;
      }

      var users = schema.users;
      var query = users.select(users.passhash).from(users).where(users.username.equals(username)).toQuery();
      client.query(query.text, query.values, function(err, result){
        freeClient();
        if (err) {
          done(err);
        }
        else if (result.rows.length != 1){
          done(null, false);
        }
        else if (result.rows[0].passhash !== this._passwordToHash(username, password)){
          done(null, false);
        }
        else {
          done(null, true);
        }
      }.bind(this)); 
    }.bind(this));
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
