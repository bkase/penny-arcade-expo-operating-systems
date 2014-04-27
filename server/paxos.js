var Utils = require('../common/utils').Utils;
var RPC = require('../common/rpc').RPC;
var colors = require('colors');

//TODO ensure periodically getting info from some quorum

var rng = new Utils.RNG(440);

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
  this.Ia = null;
  this.Va = null;

  this.seqLogs = {}
  this.serverRPCPool.forEach(function(rpc){
    this.seqLogs[rpc.targetName] = {
      log: [],
      oldestMissed: 0
    }
  }.bind(this));
  this.seqLogs[this.uid] = {
    log: [],
    oldestMissed: 0
  }

  this.N = 0;

  this.expBackoff = 5;

  this.numServers = this.serverRPCPool.length + 1;
  this.numQuorum = Math.ceil(this.numServers/2.0);

  //TODO functionize, log -> object
  this.seqLog = [];
  this.seq = 0;

  this.CANCEL = 'cancel';
  this.OK = 'ok';

  this.heartbeatTimeoutId = null;

  this.paxosInProgress = false;
  this.stopped = false;

  this.requestQueue = [];

  this._processQueue();
}

Paxos.prototype = {
  constructor: Paxos,

  //=========== API ===========

  I: function(){
    return this.commitLog.length-1;
  },

  stop: function(){
    clearTimeout(this.heartbeatTimeoutId);
    this.stopped = true;
  },

  requestHiPri: function(v, isValid, Iopt, retryOpt){
    this._request(v, isValid, Iopt, retryOpt, true);
  },

  request: function(v, isValid, Iopt, retryOpt, isHiPri){
    this._request({
        uid: this.uid,
        seq: this.seq++,
        v: v,
      }, isValid, Iopt, retryOpt, isHiPri);
  },

  _request: function(v, isValid, Iopt, retryOpt, isHiPri){
    var request = {
      value: v,
      I: Iopt,
      retry: (retryOpt == null) ? true : false,
      isValid: isValid,
    };
    if (isHiPri){
      this.requestQueue.unshift(request);
      this._debug('hipri enqueue request', request);
    } else {
      this.requestQueue.push(request);
      this._debug('lowpri enqueue request', request);
    }

    if (!this.paxosInProgress){
      this._processQueue();
    }
  },

  _reset: function(){
    this.Va = null;
    this.Na = null;
    this.Ia = null;
  },

  _processQueue: function(){
    if (this.stopped)
      return;
    var request = this.requestQueue.shift();
    clearTimeout(this.heartbeatTimeoutId);
    if (request == null){
      this.paxosInProgress = false;
      this.heartbeatTimeoutId = setTimeout(function(){
        console.log('hb');
        var I = this.I()+1;
        this.requestHiPri('nop', function(){ 
          return !(I in this.commitLog);
        }.bind(this), I, false);
      }.bind(this), 1000);
      return;
    }
    this.paxosInProgress = true;
    //console.log(this.uid, this.expBackoff);
    setTimeout(function(){
      if (request.isValid(request.value)){
        var N = this.N+1;
        if (request.I == null && this.oldestMissedI < this.I()+1){
          this.requestQueue.unshift(request);
          this._checkAndReq(this.I()+1);
          process.nextTick(function(){
            this._processQueue();
          }.bind(this));
          return;
        }
        var I = (request.I == null) ? (this.I()+1) : request.I;

        this._debug('process request', request, "N", N, "I", I);
        this.doPaxos(request, N, I, function(err){
          if (err){
            this._debug(err);
            if (!request.retry && err === 'prepare failed, missed I, got I'){
              this._debug('no retry', request);
            } else {
              this.requestQueue.unshift(request);
              this._debug('retry', request);
            }
            this.expBackoff *= 2+ -.5 + rng.nextFloat();
          } else {
            this.expBackoff = 5;
          }
          this._reset();
          process.nextTick(function(){
            this._processQueue();
          }.bind(this));
        }.bind(this));
      } else {
        process.nextTick(function(){
          this._processQueue();
        }.bind(this));
      }
    }.bind(this), this.expBackoff);
  },

  doPaxos: function(request, N, I, done){
    Utils.waterfall([
      this._sendPrepare.bind(this),
      function(outputs, next){
        var numOK = 0;
        var biggestNa = null;
        var biggestN = null;
        var biggestNaVa = null;
        var biggestNaIa = null;
        var IV = null;
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
            if (output.IV != null)
              IV = output.IV;
            if (output.status === this.OK){
              if (biggestNa == null || output.Na > biggestNa){
                biggestNa = output.Na;
                biggestNaIa = output.Ia;
                biggestNaVa = output.Va;
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
        if (IV != null){
          if (request.value !== "nop")
            this.requestHiPri(request.value, request.isValid);
          request.value = IV;
          request.isValid = function(){ return false; };
          this._debug("iv", request);
          //this._commit({
          //  V: IV,
          //  I: request.I
          //}, function(){ });
        }
        else if (
          biggestNaVa != null
        ){
          this.requestHiPri(request.value, request.isValid);
          request.value = biggestNaVa;
          I = biggestNaIa;
          request.isValid = function(){ return false; };
          this._debug("bnava", request);
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
      if (err){
        done(err);
      } else {
        done(null)
      }
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
    this._debug('sendAccept', N, V, I);
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
    this._debug('sendCommit', V, I);
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
    var N = data.N;
    var I = data.I;
    if (N == null || I == null)
      throw new Error('null check failed');
    var res = {
      uid: this.uid
    }
    if (N > this.N){
      this.N = N;
    }
    if (this.Na >= N){
      res.N = this.Na;
      res.status = this.CANCEL;
    } else {
      res.status = this.OK;
      res.Va = this.Va;
      res.Ia = this.Ia;
      res.Na = this.Na;
    }
    if (I in this.commitLog){
      res.IV = this.commitLog[I];
    }
    this._debug('gotPrepare', data, res);
    done(res);
  },
  _checkAndReq: function(I){
    if (this.oldestMissedI < I && !(I in this.commitLog)){
      this._debug('we need an i!', this.oldestMissedI, I);
      this.requestHiPri('nop', function(){ 
        return !(I in this.commitLog);
      }.bind(this), this.oldestMissedI, false);
    }
  },
  _accept: function(data, done){
    var N = data.N;
    var V = data.V;
    var I = data.I;
    if (N == null || I == null || V == null)
      throw new Error('null check failed');
    if (N > this.N){
      this.N = N;
    }
    var res = {
      uid: this.uid
    }
    if (
      (I in this.commitLog && 
      JSON.stringify(this.commitLog[I]) !== JSON.stringify(V)) ||
      V === 'nop' ||
      (this.Ia === I &&
       (this.Va.uid !== V.uid ||
        this.Va.seq !== V.seq))
    ){
      res.status = this.CANCEL;
    }
    else if (N > this.Na){
      this.Va = V;
      this.Ia = I;
      this.Na = N;
      this._checkAndReq(I);
      res.status = this.OK;
    } else {
      res.N = this.Na;
      res.status = this.CANCEL;
    }
    this._debug('gotAccept', data, res);
    done(res);
  },
  _commit: function(data, done){
    this._debug('gotCommit', data);
    this._reset();
    var V = data.V;
    var I = data.I;
    if (I == null || V == null)
      throw new Error('null check failed');
    this._checkAndReq(I);
    if (I in this.commitLog){
      this._debug("duplicat", I, data);
      //throw new Error('duplicat bad');
      done();
      return;
    }
    this.commitLog[I] = V;
    if (V === 'nop')
      throw new Error('3');
    while (this.commitLog[this.oldestMissedI] != null){
      V = this.commitLog[this.oldestMissedI];
      if (
        V.seq >= this.seqLogs[V.uid].oldestMissed && 
        !(V.seq in this.seqLogs[V.uid].log)
      ){
        this.emit('commit', V.v);
      }
      this.seqLogs[V.uid].log[V.seq] = true;
      //increment oldestMissed
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
