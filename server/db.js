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
    //return done(null);

    var apiSpec = apiSpecs[0];
    pg.connect(this.conString, function(err, client, freeClient) {
      // TODO: make sure no DUPEs in specs
      if (err) {
        done(err);
        return;
      }


      this.transaction(client, this.freeAndDone(freeClient, done), function(revert, finish) {
        return function() {
          (function loop(apiSpecs, finish) {
            if (apiSpecs.length == 0) {
              return finish(null);
            }

            var apiSpec = apiSpecs.shift();

            if (apiSpec.namespace.indexOf(apiSpec.username) != 0) {
              return finish({ err: "namespace must start with username" });
            }

            Utils.waterfall([
              function(next) {
                var specs = schema.apispecs;
                var query = specs.select(specs.star()).from(specs).where(specs.username.equals(apiSpec.username)).and(specs.namespace.equals(apiSpec.namespace)).toQuery();
                client.query(query.text, query.values, next);
              },

              function(results, next) {
                if (results.rows.length > 0) {
                  next({ err: "api exists with that namespace" });
                } else {
                  next(null);
                }
              },

              function(next) {
                var str = JSON.stringify(apiSpec.inputSpec);
                client.query("INSERT INTO spectypes (json) VALUES ($1) RETURNING id", [str], next);
              },

              function(results, next) {
                var inId = results.rows[0].id;
                var str = JSON.stringify(apiSpec.outputSpec);
                client.query("INSERT INTO spectypes (json) VALUES ($1) RETURNING id", [str], function(err, resultsOut) {
                  next(err, resultsOut, inId);
                });
              },

              function(resultsOut, inId, next) {
                var outId = resultsOut.rows[0].id;
                var specs = schema.apispecs;
                var query = specs.insert({ 
                    username: apiSpec.username,
                    namespace: apiSpec.namespace,
                    version: apiSpec.version,
                    name: apiSpec.name,
                    description: apiSpec.description,
                    examplesjson: JSON.stringify(apiSpec.examples),
                    inputspectype: inId,
                    outputspectype: outId
                }).toQuery();

                client.query(query.text, query.values, next);
              },
            ], function done(err) {
              if (err) {
                console.log(err);
                revert(finish, err);
                return;
              }

              loop(apiSpecs, finish);
            });
          }.bind(this))(
              apiSpecs,
              finish
            );
        }.bind(this);
      }.bind(this));
    }.bind(this));
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
