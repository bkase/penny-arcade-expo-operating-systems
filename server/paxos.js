var Utils = require('../common/utils').Utils;
var RPC = require('../common/rpc').RPC;

function Paxos(uid, serverRPCPool){
  Utils.makeEventable(this);
  this.serverRPCPool = serverRPCPool;
  serverRPCPool.forEach(this._addServerRPC.bind(this));

  this.rpc = new RPC(Utils.makeEventable({}));
  this._addServerRPC(this.rpc);

  this.N = 0;
  this.V = null;
  this.uid = uid;

  this.numServers = this.serverRPCPool.length + 1;
  this.numQuorum = Math.ceil(this.numServers/2.0);

  this.CANCEL = 'cancel';
  this.OK = 'ok';

  this.requestQueue = [];
}

Paxos.prototype = {
  constructor: Paxos,

  //=========== API ===========

  request: function(v, isValid){
    this.requestQueue.push({
      value: v,
      isValid: isValid
    });
    this._processQueue();
  },

  _processQueue: function(){
    var request = this.requestQueue.shift();
    //TODO CONFLICT? isValid?
    var N = this.N+1;
    Utils.waterfall([
      this._sendPrepare.bind(this),
      function(outputs, next){
        var numOK = 0;
        var biggestNa = null;
        var biggestNaVa = null
        outputs.forEach(function(data){
          if (data.err){
            next(data.err)
          } else {
            var output = data.output;
            if (output.status === this.OK){
              if (biggestNa == null || output.Na > biggestNa){
                biggestNa = output.Na;
                biggestNaVa = output.Va;
              }
              numOK += 1;
            }
          }
        }.bind(this));
        if (biggestNaVa != null){
          this.emit('commit', biggestNaVa);
          //TODO check isValid
        }
        if (numOK >= this.numQuorum){
          next(null, N, request.value);
        }
        else {
          next('prepare failed, no quorum :(');
        }
      }.bind(this),
      this._sendAccept.bind(this),
      function(outputs, next){
        var numOK = 0;
        outputs.forEach(function(data){
          if (data.err){
            next(data.err)
          } else {
            var output = data.output;
            if (output.status === this.OK){
              numOK += 1;
            }
          }
        }.bind(this));
        if (numOK >= this.numQuorum){
          next(null, request.value);
        }
        else {
          next('accept failed, no quorum :(');
        }
      }.bind(this),
      this._sendCommit.bind(this)
    ], function(err){
      if (err)
        throw err;
      
    }, [N]);
  },

  //=========== Helpers ===========

  _sendPrepare: function(N, done){
    var outputs = [];
    var count = Utils.count(this.numQuorum, function(){
      done(null, outputs);
    }.bind(this))
    this._broadcast('paxos.prepare', { N: N }, function(err, output){
      outputs.push({ err: err, output: output });
      count.sub()
    }.bind(this));
  },
  
  _sendAccept: function(N, V, done){
    var outputs = [];
    var count = Utils.count(this.numQuorum, function(){
      done(null, outputs);
    }.bind(this));
    this._broadcast('paxos.accept', { N: N, V: V }, function(err, output){
      outputs.push({ err: err, output: output });
      count.sub()
    }.bind(this))
  },

  _sendCommit: function(V, done){
    this._broadcast('paxos.commit', { V: V }, function(err){ });
    done(null);
  },

  _prepare: function(data, done){
    var N = data.N;
    var res = {
      uid: this.uid
    }
    if (this.N >= N){
      res.status = this.CANCEL;
    } else {
      res.status = this.OK;
      res.Va = this.V;
      res.Na = this.N;
    }
    done(res);
  },
  _accept: function(data, done){
    var N = data.N;
    var V = data.V;
    var res = {
      uid: this.uid
    }
    if (N > this.N){
      this.N = N;
      this.V = V;
      res.status = this.OK;
    } else {
      res.status = this.CANCEL;
    }
    done(res);
  },
  _commit: function(data, done){
    var V = data.V;
    this.emit('commit', V);
    done();
  },

  _broadcast: function(name, input, onOneRPCDone){
    this.serverRPCPool.forEach(function(rpc){
      rpc.call(name, input, function(err, output){
        onOneRPCDone(err, output);
      });
    }.bind(this));
    process.nextTick(function(){
      this.rpc.emit(name, input, function(output){
        onOneRPCDone(null, output);
      });
    }.bind(this));
  },

  _addServerRPC: function(rpc){
    rpc.on('paxos.prepare', this._prepare.bind(this));
    rpc.on('paxos.accept', this._accept.bind(this));
    //rpc.on('paxos.accepted', this._accepted.bind(this));
    rpc.on('paxos.commit', this._commit.bind(this));
  },
}

exports.Paxos = Paxos;
