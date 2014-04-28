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
      if (rpc.targetName in this.revivingByUID){
        this.revivingByUID.forEach(this._sendDeadUID.bind(this));
        this.revivingByUID[rpc.targetName] = [];
      }
    }.bind(this));
  }.bind(this));
}

RecoveryPaxos.prototype = Object.create(Paxos.prototype);
RecoveryPaxos.prototype.constructor = RecoveryPaxos;

RecoveryPaxos.prototype.request = function(v, isValid, Iopt, retryOpt, isHiPri){
  arguments[0] = {
    userMsg: v,
  }
  Paxos.prototype.request.apply(this, arguments);
}

RecoveryPaxos.prototype._processCommit = function(V, I){
  if ('userMsg' in V.v){
    this.emit('commit', V.v.userMsg);
  } else if (this.maxIgnoreI == null || I > this.maxIgnoreI) {
    this.emit('recoveryCommit', V.v);
    if (V.v.type === 'dead'){
      this.deadTable[V.v.deadUID] = true;
      this._killConnectionsTo(V.v.deadUID);
      this._sendReviveUID(V.v.deadUID);
    } else if (V.v.type === 'revive'){
      if (!(V.v.deadUID in this.revivingByUID)){
        this.revivingByUID[V.v.deadUID] = [];
      }
      this.revivingByUID[V.v.deadUID].push(V.v.reviverUID);
      delete this.deadTable[V.v.deadUID];
      if (V.v.reviverUID === this.uid){
        this.revive(this.numServers, V.v.deadUID, function(err, hostport){
          if (err){
            //TODO
            throw new Error('bad revive');
          }
          this._sendReconnectUID(V.v.deadUID, hostport);
        }.bind(this));
      }
    } else if (V.v.type === 'reconnect'){
      if (this.reviverUID in this.revivingByUID){
        var rbu = this.revivingByUID[this.reviverUID];
        var revivedIdx = rbu.indexOf(V.v.revivedUID);
        rbu.splice(revivedIdx, 1);
      }
      this.connect(this, I, V.v.hostport, V.v.revivedUID, function(err){
          if (err){
            //TODO if can't reconnect, timeout, send deaduid again
            throw new Error('bad connect');
          }
          this.emit('recovered', V.v.revivedUID);
      }.bind(this));
      if (this.RECO_DEBUG)
        console.log('reconnect', V.v);
    } else {
      if (this.RECO_DEBUG)
        console.log('dropped type', V.v.type);
    }
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
    function (v, V){
      return true;
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
    function (v, V){
      return V.v.deadUID in this.deadTable;
    }.bind(this)
  ]);
}

RecoveryPaxos.prototype._sendDeadUID = function(deadUID){
  Paxos.prototype.request.apply(this, [
    {
      type: 'dead',
      deadUID: deadUID,
    },
    function (v, V){
      return !(V.v.deadUID in this.deadTable);
    }.bind(this)
  ]);
}

RecoveryPaxos.prototype._extractUserData = function(V){
  return Paxos.prototype._extractUserData.apply(this, [V]).userMsg;
}

exports.RecoveryPaxos = RecoveryPaxos;
