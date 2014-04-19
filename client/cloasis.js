;(function(exports, module) {

  if (module) {
    var WebSocket = require('ws');
    var Connection = require('../common/connection').Connection;
    var RPC = require('../common/rpc').RPC;
    var Utils = require('../common/utils').Utils;
  } else {
    Connection = exports.Connection;
    Utils = exports.Utils;
    RPC = exports.RPC;
  }

  //======================
  //  Cloasis
  //======================

  var Cloasis = {
    login: function(username, password, done){
      var conn = new Connection(new WebSocket('ws://localhost:14222'));
      conn.on('open', function() {
        var session = new Session(conn);
        session.loginUser(username, password, function(err){
          done(err, session);
        });
      });
    },

    register: function(username, password, done){
      var conn = new Connection(new WebSocket('ws://localhost:14222'));
      conn.on('open', function() {
        var session = new Session(conn);
        session.registerUser(username, password, function(err){
          done(err, session);
        });
      });
    }
  }

  //======================
  //  Session
  //======================

  function Session(conn){
    this.conn = conn;
    this.rpc = new RPC(this.conn);
  }

  Session.prototype = {
    constructor: Session,

    loginUser: function(username, password, done){
      this.rpc.call('loginUser', {
        username: username,
        password: password
      }, function(err, success){
        done(err || success);
      });
    },
    registerUser: function(username, password, done){
      this.rpc.call('registerUser', {
        username: username,
        password: password
      }, function(err, success){
        done(err || success);
      });
    },
    call: function(apiIdentifier, input, done){
      done(null, { '3': 'sure it worked' });
    },
    search: function(query, done){
      done(null, [ '3', '3' ]);
    },
    register: function(){
      var apiSpecs = Array.prototype.slice.call(arguments, 0);
      var done = apiSpecs.pop();

      done(null);
    },
    info: function(){
      var apiIds = Array.prototype.slice.call(arguments, 0);
      var done = apiSpecs.pop();

      done(null, [ { 'namespace': 0 } ]);
    },
    activate: function(){
      var apiIds = Array.prototype.slice.call(arguments, 0);
      var done = apiSpecs.pop();

      done(null);
    },
    deactivate: function(){
      var apiIds = Array.prototype.slice.call(arguments, 0);
      var done = apiSpecs.pop();

      done(null);
    }
  }

  //======================
  //  export
  //======================

  exports.Cloasis = Cloasis;

}).apply(null, [typeof exports !== 'undefined' ? exports : this,
                typeof module !== 'undefined' ? module : null]);
