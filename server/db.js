var crypto = require('crypto');
var sql = require('sql');
var schema = require('./schema');
var pg = require('pg');
var Utils = require('../common/utils').Utils;
var CB = require('../common/cb').CB;

function DB(conString, uid){
  this.conString = conString;
  Utils.makeEventable(this);
  this.uid = uid;
  this.cb = new CB(uid);
}

DB.prototype = {
  constructor: DB,

  commit: function(V, done){
    switch (V.name) {
      case 'createUser': 
        this._doCreateUser(V, V.username, V.passhash);
        break;
      case 'registerAPI':
        this._doRegisterAPI(V, V.apiSpec);
        break;
      default:
        console.log('db, dropped ', V);
    }
    done();
  },

  freeAndDone: function(free, done) {
    return function() {
      free();
      done.apply(done, arguments);
    };
  },
  
  _select: function(query, done) {
    pg.connect(this.conString, function(err, client, freeClient) {
      if (err) {
        done(err);
        return;
      }

      client.query(query.text, query.values, function(err, res) {
        freeClient()
        if (err) {
          done(err);
        } else {
          done(null, res);
        }
      });
    });
  },

  _selectNonEmpty: function(query, done) {
    this._select(query, function(err, res) {
      if (err) {
        done(err);
      } else {
        done(null, res.rows.length > 0);
      }
    });
  },

  _insertQuery: function(query, done) {
    pg.connect(this.conString, function(err, client, freeClient) {
      if (err) {
        done(err);
        return;
      }
      client.query(query.text, query.values, function(err, res) {
        freeClient();
        if (err) {
          done(err);
        } else {
          done(null);
        }
      });
    });
  },

  _doCreateUser: function(V, username, passhash) {
    var query = schema.users.insert({'username':username, 'passhash':passhash}).toQuery();
    this._insertQuery(query, function(err) {
      if (err) {
        console.log("error creating user");
        this.cb.lazyCallCallback(V)("error creating user, even though it doesn't exist");
      }
      this.cb.lazyCallCallback(V)(null, false);
    }.bind(this));
  },

  createUser: function(username, password, done){
    var V = { name: 'createUser', 
              username: username, 
              passhash: this._passwordToHash(username, password) };
    this.cb.addCallback(V, done);
    this.emit('request', V, 
              function isValid(isValidDone, v) { 
                var users = schema.users;
                var query = users.select(users.star()).from(users).where(users.username.equals(username)).toQuery();
                this._selectNonEmpty(query, function(err, exists) {
                  if (err) {
                    isValidDone(false);
                    this.cb.lazyCallCallback(V)('error querying username');
                    return;
                  }

                  if (exists) {
                    isValidDone(false);
                    this.cb.lazyCallCallback(V)(null, true);
                    return;
                  }

                  isValidDone(true);
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
    var users = schema.users;
    var query = users.select(users.passhash).from(users).where(users.username.equals(username)).toQuery();
    var passhash = this._passwordToHash(username, password);
    this._select(query, function(err, res) {
      if (err) {
        done('error querying user/pass');
      } else if (res.rows.length != 1) {
        console.log(res.rows);
        done(null, false);
      } else if (res.rows[0].passhash !== passhash) {
        console.log(res.rows[0], passhash, username);
        done(null, false);
      } else {
        done(null, true);
      }
    });
  },

  _doRegisterAPI: function(V, apiSpec) {
    pg.connect(this.conString, function(err, client, freeClient) {
      if (err) {
        console.log("ERROR: didn't register the API successfully");
        return;
      }

      this.transaction(client, this.freeAndDone(freeClient, function(){}), function(revert, finish) {
        return function() {
            Utils.waterfall([
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
            ], function (err) {
              if (err) {
                console.log(err);
                this.cb.lazyCallCallback(V)(err);
                revert(finish, err);
                return;
              }
              
              finish();
              this.cb.lazyCallCallback(V)(null);
            }.bind(this));
          }.bind(this);
      }.bind(this));
    }.bind(this));
  },

  _registerAPI: function(apiSpec, done) {
    var V = { name: 'registerAPI', 
              apiSpec: apiSpec };
    this.cb.addCallback(V, done);
    this.emit('request', V, 
              function isValid(isValidDone, v) { 
                if (apiSpec.namespace.indexOf(apiSpec.username) != 0) {
                  return this.cb.lazyCallCallback(V)({ err: "namespace must start with username" });
                }
                var specs = schema.apispecs;
                var query = specs.select(specs.star()).from(specs).where(specs.username.equals(apiSpec.username)).and(specs.namespace.equals(apiSpec.namespace)).toQuery();
                this._selectNonEmpty(query, function(err, exists) {
                  if (err) {
                    isValidDone(false);
                    this.cb.lazyCallCallback(V)({ err: 'error querying for apis' });
                    console.log(err);
                    return;
                  }

                  if (exists) {
                    isValidDone(false);
                    this.cb.lazyCallCallback(V)({ err: "api exists with that namespace" });
                    return;
                  }

                  isValidDone(true);
                }.bind(this));

              }.bind(this));
  },

  registerAPIs: function(apiSpecs, done){

    var errs = []
    var cnt = Utils.count(apiSpecs.length, function() {
      if (errs.length > 0) {
        done({ errs: errs });
      } else {
        done();
      }
    });
    for (var i = 0; i < apiSpecs.length; i++) {
      this._registerAPI(apiSpecs[i], function(err) {
        if (err) {
          errs.push(err);
        }
        cnt.sub();
      });
    }
  },

  searchAPIs: function(needle, done){
    var specs = schema.apispecs;
    var query = { text: "SELECT * FROM apispecs WHERE apispecs.namespace LIKE '%' || $1 || '%'", values: [ needle ] };
    this._select(query, function(err, res) {
      if (err) {
        console.log(err);
        done(err);
        return;
      }
      var apiIds = res.rows.map(function(row) {
        return { name: row.name, namespace: row.namespace, version: row.version };
      });

      done(null, apiIds);
    }.bind(this))
  },

  infoAPIs: function(apiIds, done){
    pg.connect(this.conString, function(err, client, freeClient) {
      if (err) {
        done(err);
        return;
      }


      var specs = schema.apispecs;
      var spectypes = schema.spectypes;
      //var query = specs.select(specs.star()).from(specs).from(spectypes).where(specs.inputspectype.equals(spectypes.id)).or(specs.outputspectype.equals(spectypes.id));
      var queryText = "SELECT * FROM apispecs, spectypes WHERE (apispecs.inputspectype = spectypes.id OR apispecs.outputspectype = spectypes.id) AND " + this.constraintsForApiIds(apiIds);
      // map + flatten
      var queryValues = apiIds.map(function(id) { return [ id.namespace, id.name, id.version ]; }).reduce(function(a, b) { return a.concat(b); });
      client.query(queryText, queryValues, function(err, results) {
        freeClient();

        if (err) {
          return done(err);
        } else if (results.rows.length < 2) {
          return done({ err: "Couldn't find info for this apiId" });
        } else {
          var apis = [];
          for (var i = 0; i < results.rows.length; i+=2) {
            var row1 = results.rows[i];
            var row2 = results.rows[i+1];
            this.swapIn(row1, row2, "inputspectype");
            this.swapIn(row1, row2, "outputspectype");

            row1.examplesjson = JSON.parse(row1.examplesjson);
            delete row1.id;
            delete row1.json;
            apis.push(row1)
          }
          done(null, { apis: apis, err: null });
        }
      }.bind(this));
    }.bind(this));
  },

  constraintsForApiIds: function(apiIds) {
    var components = []
    var dollarCount = 1;
    for (var i = 0; i < apiIds.length; i++) {
      components.push("(apispecs.namespace = $" + dollarCount++ + 
        " AND apispecs.name = $" + dollarCount++ +
        " AND apispecs.version = $" + dollarCount++ + ")");
    }
    return "(" + components.join(" OR ") + ")";
  },

  swapIn: function(row1, row2, key) {
    if (row1.id == row1[key]) {
      row1[key] = JSON.parse(row1.json);
    } else if (row2.id == row1[key]) {
      row1[key] = JSON.parse(row2.json);
    } else {
      throw "bad results";
    }
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
