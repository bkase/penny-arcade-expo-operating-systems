var Utils = require('../common/utils').Utils;
var RPC = require('../common/rpc').RPC;
var colors = require('colors');

//TODO ensure periodically getting info from some quorum
function Paxos(uid, serverRPCPool){
  Utils.makeEventable(this);
  this.uid = uid;
  this.serverRPCPool = serverRPCPool;
  serverRPCPool.forEach(this._addServerRPC.bind(this));

  this.rpc = new RPC(Utils.makeEventable({}));
  this.rpc.name = uid;

  this._addServerRPC(this.rpc);

  this.DEBUG = true;

  this.commitLog = [];
  this.oldestMissedI = 0;

  this.Na = null;
  this.Va = null;

  this.N = 0;

  this.numServers = this.serverRPCPool.length + 1;
  this.numQuorum = Math.ceil(this.numServers/2.0);

  this.CANCEL = 'cancel';
  this.OK = 'ok';

  this.paxosInProgress = false;

  this.requestQueue = [];
}

Paxos.prototype = {
  constructor: Paxos,

  //=========== API ===========

  I: function(){
    return this.commitLog.length-1;
  },

  request: function(v, isValid, Iopt, retryOpt){
    var request = {
      value: v,
      I: Iopt,
      retry: (retryOpt == null) ? true : false,
      isValid: isValid
    };
    this.requestQueue.push(request);
    this._debug('enqueue request', request);

    if (!this.paxosInProgress){
      this._processQueue();
    }
  },

  _processQueue: function(){
    var request = this.requestQueue.shift();
    this._debug('s', request);
    if (request == null){
      this.paxosInProgress = false;
      return;
    }
    this.paxosInProgress = true;
    //TODO CONFLICT? isValid?
    var N = this.N+1;
    var I = (request.I == null) ? (this.I()+1) : request.I;

    this._debug('process request', request, N, I);
    this.doPaxos(request, N, I, function(err){
      if (err){
        this._debug(err);
        if (!request.retry && err === 'prepare failed, missed I, got I'){
          this._debug('no retry');
        } else {
          this.requestQueue.unshift(request);
          this.Va = null;
          this.Na = null;
          this._debug('retry');
        }
      }
      process.nextTick(function(){
        this._processQueue();
      }.bind(this));
    }.bind(this));
  },

  doPaxos: function(request, N, I, done){
    Utils.waterfall([
      this._sendPrepare.bind(this),
      function(outputs, next){
        var numOK = 0;
        var biggestNa = null;
        var biggestN = null;
        var biggestNaVa = null
        var biggestI = null;
        var reqIV = null;
        var bailEarly = false;
        outputs.forEach(function(data){
          if (bailEarly)
            return;
          if (data.err){
            next(data.err)
            bailEarly = true;
          } else {
            var output = data.output;
            //this._debug('resPrep', output);
            if ('reqIV' in output){
              if (reqIV == null){
                reqIV = output.reqIV;
              }
              //TODO rm this
              else if (JSON.stringify(reqIV) !== JSON.stringify(output.reqIV)){
                throw new Error('wtf they aren\'t the same');
              }
            }
            if (output.status === this.OK){
              if (biggestNa == null || output.Na > biggestNa){
                biggestNa = output.Na;
                biggestNaVa = output.Va;
              }
              if (biggestI == null || output.I > biggestI){
                biggestI = output.I;
              }
              numOK += 1;
            } else {
              if (
                output.N != null &&
                (biggestN == null || output.N > biggestN)
              ){
                biggestN = output.N;
              }
            }
          }
        }.bind(this));
        if (bailEarly)
          return;
        if (biggestN != null){
          this.N = biggestN;
        }
        if (I <= biggestI){
          if (reqIV != null){
            this._commit({ V: reqIV, I: I, uid: this.uid }, function(){ });
            this._checkAndReq(this.oldestMissedI);
            next('prepare failed, missed I, got I');
          } else {
            this._checkAndReq(this.oldestMissedI);
            next('prepare failed, missed I, missed I');
          }
          return;
        }
        else if (biggestNaVa != null){
          this._debug("bnava", request);
          this.request(request.value, request.isValid);
          request.value = biggestNaVa;
          request.isValid = function(){ return true; };
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
        var biggestN = null;
        var bailEarly = false;
        outputs.forEach(function(data){
          if (bailEarly)
            return;
          if (data.err){
            next(data.err);
            bailEarly = true;
          } else {
            var output = data.output;
            if (output.status === this.OK){
              numOK += 1;
            } else {
              if (
                output.N != null &&
                (biggestN == null || output.N > biggestN)
              ){
                biggestN = output.N;
              }
            }
          }
        }.bind(this));
        if (bailEarly)
          return;
        if (biggestN != null){
          this.N = biggestN;
        }
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

  _uidToColor: function(){
    var colors = [
      "cyan",
      "blue",
      "green",
      "magenta",
      "red",
      "yellow",
    ];
    return colors[this.uid%colors.length];

  },

  _debug: function(){
    if (this.ison(arguments[0])){
      this.emit.apply(this, arguments);
    }
    if (this.DEBUG){
      var args = Utils.arrayify(arguments)
      args.unshift(this.uid);
      str = args.map(function(arg){
        return JSON.stringify(arg);
      }.bind(this)).reduce(function(a,b){
        return a + ', ' + b;
      });
      var str = str[this._uidToColor()];
      console.log(str);
    }
  },

  _sendPrepare: function(N, I, done){
    this._debug('sendPrepare', N, I);
    var outputs = [];
    var count = Utils.count(this.numQuorum, function(){
      done(null, outputs);
    }.bind(this));
    this._broadcast('paxos.prepare', { N: N, I: I, uid: this.uid }, function(err, output){
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
    this._broadcast('paxos.accept', { N: N, V: V, I: I, uid: this.uid }, function(err, output){
      outputs.push({ err: err, output: output });
      count.sub()
    }.bind(this))
  },

  _sendCommit: function(V, I, done){
    this._debug('sendCommit');
    if (!this.die){
      this._broadcast('paxos.commit', { V: V, I: I, uid: this.uid }, function(err){ });
      done(null);
    }
    else {
      this.die = false;
      done('i died');
    }
  },

  _prepare: function(data, done){
    this._debug('gotPrepare', data);
    var N = data.N;
    var I = data.I;
    var res = {
      uid: this.uid
    }
    if (I in this.commitLog){
      res.reqIV = this.commitLog[I];
    }
    if (this.Na >= N){
      res.N = this.Na;
      res.status = this.CANCEL;
    } else {
      res.status = this.OK;
      res.Va = this.Va;
      res.Na = this.Na;
      res.I = this.I();
    }
    done(res);
  },
  _checkAndReq: function(I){
    if (this.oldestMissedI < I){
      this.request('nop', function(){ return true; }, this.oldestMissedI, false);
      this._debug('we need an i!', this.oldestMissedI, I);
    }
  },
  _accept: function(data, done){
    var N = data.N;
    var V = data.V;
    var I = data.I;
    this._debug('gotAccept', data);
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
      res.N = this.Na;
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
    if (I in this.commitLog){
      this._debug("WTF", I, this.commitLog);
      throw new Error('now we\'re done');
    }
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
