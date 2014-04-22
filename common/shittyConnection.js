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
    Connection.apply(this, args);
  }

  ShittyConnection.prototype = Object.create(Connection.prototype);
  ShittyConnection.prototype.constructor = ShittyConnection;

  ShittyConnection.prototype.send = function(){
    if (rng.nextFloat() < this.successRate){
      return Connection.prototype.send.apply(this, arguments);
    }
  }

  exports.Connection = ShittyConnection;

}).apply(null, [typeof exports !== 'undefined' ? exports : this,
                typeof module !== 'undefined' ? module : null]);


