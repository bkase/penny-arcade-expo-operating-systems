var Paxos = require('./paxos').Paxos;
var Utils = require('../common/utils').Utils;

function RecoveryPaxos(){
  var args = Utils.arrayify(arguments);
  this.maxIgnoreI = args.pop();
  this.connect = args.pop();
  this.revive = args.pop();
  Paxos.apply(this, args);

  this.RECO_DEBUG = false;

  this.deadTable = {};

  this.revivingByUID = {};
  this.beingRevived = {};

  this.serverRPCPool.forEach(function(rpc){
    rpc.on('close', function(){
      var numConn = 1;
      for (var i = 0; i < this.serverRPCPool.length; i++){
        if (!this.serverRPCPool[i].conn.closed)
          numConn += 1;
      }
      if (numConn < this.numQuorum){
        this.stop();
      }
      this._sendDeadUID(rpc.targetName);
      delete this.beingRevived[rpc.targetName];
      if (rpc.targetName in this.revivingByUID){
        this.revivingByUID[rpc.targetName].forEach(this._sendDeadUID.bind(this));
        this.revivingByUID[rpc.targetName].forEach(function(beingRevivedUID){
          delete this.beingRevived[beingRevivedUID];
        }.bind(this));
        this.revivingByUID[rpc.targetName] = [];
      }
    }.bind(this));
  }.bind(this));
  
  this.toSend = [];
}

RecoveryPaxos.setRNGSeed = function(seed){
  Paxos.setRNGSeed(seed);
}

RecoveryPaxos.prototype = Object.create(Paxos.prototype);
RecoveryPaxos.prototype.constructor = RecoveryPaxos;

RecoveryPaxos.prototype.request = function(v, isValid, Iopt, retryOpt, isHiPri){
  arguments[0] = {
    userMsg: v,
  }

  if (this.maxIgnoreI != null && this.I() <= this.maxIgnoreI){
    this.toSend.push(arguments);
  } else {
    Paxos.prototype.request.apply(this, arguments);
  }
}
RecoveryPaxos.prototype._processCommit = function(done, V, I){
  if (this.maxIgnoreI === I){
    this.maxIgnoreI = null;
    this.toSend.forEach(function(args){
      Paxos.prototype.request.apply(this, args);
    }.bind(this));
  }
  if (this.uid === V.uid){
    this.seq = Math.max(V.seq, this.seq)+1;
  }
  if ('userMsg' in V.v){
    if (this.ison('commit'))
      this.emit('commit', V.v.userMsg, done);
    else
      done();
  } else if (this.maxIgnoreI == null || I > this.maxIgnoreI) {
    this.emit('recoveryCommit', V.v);
    if (V.v.type === 'dead'){
      if (this.RECO_DEBUG)
        console.log('dead', this.uid, V.v);
      this.deadTable[V.v.deadUID] = true;
      this._killConnectionsTo(V.v.deadUID);
      this._sendReviveUID(V.v.deadUID);
    } else if (V.v.type === 'revive'){
      if (this.RECO_DEBUG)
        console.log('revive', this.uid, V.v);
      if (!(V.v.reviverUID in this.revivingByUID)){
        this.revivingByUID[V.v.reviverUID] = [];
      }
      this.revivingByUID[V.v.reviverUID].push(V.v.deadUID);
      this.beingRevived[V.v.deadUID] = true;
      delete this.deadTable[V.v.deadUID];
      if (V.v.reviverUID === this.uid){
        this.emit('reviving', V.v.deadUID);
        this.revive(this.numServers, V.v.deadUID, function(err, hostport){
          if (err){
            //TODO
            throw new Error('bad revive');
          }
          this._sendReconnectUID(V.v.deadUID, hostport);
        }.bind(this));
      }
    } else if (V.v.type === 'reconnect'){
      if (this.RECO_DEBUG)
        console.log('reconnect', V.v);
      if (this.reviverUID in this.revivingByUID){
        var rbu = this.revivingByUID[this.reviverUID];
        var revivedIdx = rbu.indexOf(V.v.revivedUID);
        rbu.splice(revivedIdx, 1);
      }
      delete this.beingRevived[V.v.deadUID];
      this.connect(this, I, V.v.hostport, V.v.revivedUID, function(err){
          if (err){
            //TODO if can't reconnect, timeout, send deaduid again
            throw new Error('bad connect');
          }
          this.emit('recovered', V.v.revivedUID);
      }.bind(this));
    } else {
      if (this.RECO_DEBUG)
        console.log('dropped type', V.v.type);
    }
    done();
  }
}

RecoveryPaxos.prototype._killConnectionsTo = function(uid){
  for (var i = 0; i < this.serverRPCPool.length; i++){
    if (this.serverRPCPool[i].targetName === uid){
      this.serverRPCPool[i].conn.close();
    }
  }
}

RecoveryPaxos.prototype._sendReconnectUID = function(revivedUID, hostport){
  Paxos.prototype.request.apply(this, [
    {
      type: 'reconnect',
      revivedUID: revivedUID,
      hostport: hostport,
      reviverUID: this.uid,
    },
    function (done, v, V){
      done(true);
    }.bind(this)
  ]);
}

RecoveryPaxos.prototype._sendReviveUID = function(deadUID){
  Paxos.prototype.request.apply(this, [
    {
      type: 'revive',
      deadUID: deadUID,
      reviverUID: this.uid
    },
    function (done, v, V){
      done(V.v.deadUID in this.deadTable);
    }.bind(this)
  ]);
}

RecoveryPaxos.prototype._sendDeadUID = function(deadUID){
  Paxos.prototype.request.apply(this, [
    {
      type: 'dead',
      deadUID: deadUID,
    },
    function (done, v, V){
      done(!(V.v.deadUID in this.deadTable) &&
           !(V.v.deadUID in this.beingRevived));
    }.bind(this)
  ]);
}

RecoveryPaxos.prototype._extractUserData = function(V){
  return Paxos.prototype._extractUserData.apply(this, [V]).userMsg;
}

exports.RecoveryPaxos = RecoveryPaxos;
