;(function(exports, module) {

  if (module) {
    var WebSocket = require('ws');
    var Connection = require('../common/connection').Connection;
    var RPC = require('../common/rpc').RPC;
    var Utils = require('../common/utils').Utils;
  } else {
    Connection = exports.Connection;
    WebSocket = exports.WebSocket;
    Utils = exports.Utils;
    RPC = exports.RPC;
  }

  //======================
  //  Cloasis
  //======================

  function initConn(hostport){
    if (typeof WebSocket === 'undefined' || WebSocket == null){
      return conn = new Connection(new SIOSocket(io.connect('http://' + hostport[0] + ':' + (hostport[1]+1))));
      console.log("!");
    } else {
      return conn = new Connection(new WebSocket('ws://' + hostport[0] + ':' + hostport[1]));
    }
  }

  var Cloasis = {
    hostport: ['localhost',32200],
    loginUser: function(username, password, done, hostport){
      var conn = initConn(Cloasis.hostport);
      var session = null;
      conn.on('open', function() {
        session = new Session(conn);
        session.loginUser(username, password, function(err){
          done(err, session);
        });
      });
      conn.on('close', function(){
        if (session)
          session.emit('close');
      });
    },

    registerUser: function(username, password, done, hostport){
      var conn = initConn(Cloasis.hostport);
      var session = null;
      conn.on('open', function() {
        session = new Session(conn);
        session.registerUser(username, password, function(err){
          done(err, session);
        });
      });
      conn.on('close', function(){
        if (session)
          session.emit('close');
      });
    }
  }

  //======================
  //  Session
  //======================

  function Session(conn){
    Utils.makeEventable(this);
    this.conn = conn;
    this.fnTable = {};
    this.rpc = new RPC(this.conn);
    this.rpc.TIMEOUT = 10000000;
    this.rpc.on('call', this.parseCall.bind(this));
  }

  Session.prototype = {
    constructor: Session,

    loginUser: function(username, password, done){
      this.rpc.call('loginUser', {
        username: username,
        password: password
      }, function(err, result){
        done(err || result.err);
      });
    },
    registerUser: function(username, password, done){
      this.rpc.call('registerUser', {
        username: username,
        password: password
      }, function(err, result){
        done(err || result.err);
      });
    },
    call: function(apiIdentifier, input, done){
      this.rpc.call('call', {
        apiIdentifier: apiIdentifier,
        input: input
      }, function(err, result){
        done(err || result.err, result.output);
      });
    },
    search: function(query, done){
      this.rpc.call('search', {
        query: query,
      }, function(err, result){
        done(err || result.err, result.apis);
      });
    },
    register: function(){
      var apiSpecs = Array.prototype.slice.call(arguments, 0);
      var done = apiSpecs.pop();

      this.rpc.call('register', {
        apiSpecs: apiSpecs,
      }, function(err, result){
        done(err || result.err);
      });
    },
    info: function(){
      var apiIds = Array.prototype.slice.call(arguments, 0);
      var done = apiIds.pop();

      this.rpc.call('info', {
        apiIdentifiers: apiIds,
      }, function(err, result){
        done(err || result.err, result.apis);
      });
    },
    activate: function(){
      var apis = Array.prototype.slice.call(arguments, 0);
      var done = apis.pop();

      var apiIds = [];
      apis.forEach(function(api){
        var apiStr = Utils.stringifyAPIIdentifier(api.apiIdentifier);
        this.fnTable[apiStr] = api.fn;
        apiIds.push(api.apiIdentifier);
      }.bind(this));

      this.rpc.call('activate', {
        apiIdentifiers: apiIds,
      }, function(err, result){
        done(err || result.err);
      });
    },
    parseCall: function(data, done){
      var apiStr = Utils.stringifyAPIIdentifier(data.apiIdentifier);
      if (apiStr in this.fnTable){
        this.fnTable[apiStr](data.input, function(output){
          done({ err: null, output: output });
        });
      }
      else {
        done({ err: 'api not found' });
      }
    },
    deactivate: function(){
      var apiIds = Array.prototype.slice.call(arguments, 0);
      var done = apiSpecs.pop();
      apiIds.forEach(function(api){
        delete this.fnTable[Utils.stringifyAPIIdentifier(api.apiIdentifier)];
      }.bind(this));

      this.rpc.call('deactivate', {
        apiIdentifiers: apiIds,
      }, function(err, result){
        done(err || result.err);
      });
    }
  }

  //======================
  //  export
  //======================

  exports.Cloasis = Cloasis;

}).apply(null, [typeof exports !== 'undefined' ? exports : this,
                typeof module !== 'undefined' ? module : null]);
