;(function(exports, module) {
  if (module) {
    var Utils = require('./utils').Utils;
    var Connection = require('./connection').Connection;
  } else {
    Utils = exports.Utils;
  }

  var rng = new Utils.RNG(440);

  function ShittyConnection(){
    var args = Utils.arrayify(arguments);
    this.successRate = args.pop();
    this.active = false;
    Connection.apply(this, args);
  }

  ShittyConnection.prototype = Object.create(Connection.prototype);
  ShittyConnection.prototype.constructor = ShittyConnection;

  ShittyConnection.prototype.startBeingShitty = function(){
    this.active = true;
  }

  ShittyConnection.prototype.stopBeingShitty = function(){
    this.active = false;
  }

  ShittyConnection.prototype.send = function(){
    if (!this.active || rng.nextFloat() < this.successRate){
      return Connection.prototype.send.apply(this, arguments);
    }
  }

  ShittyConnection.prototype.dropAll = function(){
    this.successRate = 0;
    this.startBeingShitty();
  }

  ShittyConnection.prototype.dropNone = function(){
    this.successRate = 1;
    this.stopBeingShitty();
  }

  exports.Connection = ShittyConnection;

}).apply(null, [typeof exports !== 'undefined' ? exports : this,
                typeof module !== 'undefined' ? module : null]);


