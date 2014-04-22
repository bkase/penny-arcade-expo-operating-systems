var Utils = require('../common/utils').Utils;
var RPC = require('../common/rpc').RPC;

function Paxos(uid, serverRPCPool){
  Utils.makeEventable(this);
  this.uid = uid;
  this.serverRPCPool = serverRPCPool;
  serverRPCPool.forEach(this._addServerRPC.bind(this));

  this.rpc = new RPC(Utils.makeEventable({}));
  this.rpc.name = uid;

  this._addServerRPC(this.rpc);

  this.DEBUG = false;

  this.commitLog = [];
  this.oldestMissedI = 0;

  this.Na = 0;
  this.Va = null;

  this.numServers = this.serverRPCPool.length + 1;
  this.numQuorum = Math.ceil(this.numServers/2.0);

  this.CANCEL = 'cancel';
  this.OK = 'ok';

  this.requestQueue = [];
}

Paxos.prototype = {
  constructor: Paxos,

  //=========== API ===========

  I: function(){
    return this.commitLog.length-1;
  },

  request: function(v, isValid, Iopt){
    this.requestQueue.push({
      value: v,
      I: Iopt,
      isValid: isValid
    });
    this._processQueue();
  },

  _processQueue: function(){
    var request = this.requestQueue.shift();
    //TODO CONFLICT? isValid?
    var N = this.Na+1;
    var I = (request.I == null) ? (this.I()+1) : request.I;

    this.doPaxos(request, N, I, function(err){
      if (err)
        console.log(err);
    });
  },

  doPaxos: function(request, N, I, done){
    Utils.waterfall([
      this._sendPrepare.bind(this),
      function(outputs, next){
        var numOK = 0;
        var biggestNa = null;
        var biggestNaVa = null
        var biggestI = null;
        var reqIV = null;
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
              if (biggestI == null || output.I > biggestI){
                biggestI = output.I;
              }
              if ('reqIV' in output){
                if (reqIV == null){
                  reqIV = output.reqIV;
                }
                //TODO rm this
                else if (JSON.stringify(reqIV) !== JSON.stringify(output.reqIV)){
                  throw new Error('wtf they aren\'t the same');
                }
              }
              numOK += 1;
            }
          }
        }.bind(this));
        if (I <= biggestI){
          if (reqIV != null){
            this._commit({ V: reqIV, I: I }, function(){ });
          }
          this._checkAndReq(this.oldestMissedI);
          next('prepare failed, missed iter :(');
          return;
        }
        else if (biggestNaVa != null){
          console.log("bnava");
          this.emit('commit', biggestNaVa);
          //TODO check isValid
        }
        if (numOK < this.numQuorum){
          next('prepare failed, no quorum :(');
        }
        else {
          next(null, N, request.value, I);
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
          next(null, request.value, I);
        }
        else {
          next('accept failed, no quorum :(');
        }
      }.bind(this),
      this._sendCommit.bind(this)
    ], function(err){
      if (err)
        done(err);
      else
        done(null)
    }, [N, I]);
  },

  //=========== Helpers ===========

  _debug: function(){
    if (this.DEBUG){
      var args = Utils.arrayify(arguments)
      args.unshift(this.uid);
      console.log.apply(console.log, args);
    }
  },

  _sendPrepare: function(N, I, done){
    this._debug('sendPrepare', N, I);
    var outputs = [];
    var count = Utils.count(this.numQuorum, function(){
      done(null, outputs);
    }.bind(this))
    this._broadcast('paxos.prepare', { N: N, I: I }, function(err, output){
      outputs.push({ err: err, output: output });
      count.sub()
    }.bind(this));
  },
  
  _sendAccept: function(N, V, I, done){
    this._debug('sendAccept');
    var outputs = [];
    var count = Utils.count(this.numQuorum, function(){
      done(null, outputs);
    }.bind(this));
    this._broadcast('paxos.accept', { N: N, V: V, I: I }, function(err, output){
      outputs.push({ err: err, output: output });
      count.sub()
    }.bind(this))
  },

  _sendCommit: function(V, I, done){
    this._debug('sendCommit');
    this._broadcast('paxos.commit', { V: V, I: I }, function(err){ });
    done(null);
  },

  _prepare: function(data, done){
    this._debug('gotPrepare');
    var N = data.N;
    var I = data.I;
    var res = {
      uid: this.uid
    }
    if (this.Na >= N){
      res.status = this.CANCEL;
    } else {
      res.status = this.OK;
      res.Va = this.Va;
      res.Na = this.Na;
      res.I = this.I();
      if (I in this.commitLog){
        res.reqIV = this.commitLog[I];
      }
    }
    done(res);
  },
  _checkAndReq: function(I){
    if (this.oldestMissedI < I){
      this.request('nop', function(){ return true; }, this.oldestMissedI);
      this._debug('we need an i!', this.oldestMissedI, I);
    }
  },
  _accept: function(data, done){
    var N = data.N;
    var V = data.V;
    var I = data.I;
    this._debug('gotAccept', this.I(), I);
    var res = {
      uid: this.uid
    }
    if (this.I() >= I){
      //send val if have it?
      res.status = this.CANCEL;
    } else if (N > this.Na){
      this.Va = V;
      this.Na = N;
      this._checkAndReq(I);
      res.status = this.OK;
    } else {
      res.status = this.CANCEL;
    }
    done(res);
  },
  _commit: function(data, done){
    this._debug('gotCommit', data);
    this.Va = null;
    this.Na = null;
    var V = data.V;
    var I = data.I;
    this.commitLog[I] = V;
    while (this.commitLog[this.oldestMissedI] != null){
      this.emit('commit', this.commitLog[this.oldestMissedI]);
      this.oldestMissedI++;
    }
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
