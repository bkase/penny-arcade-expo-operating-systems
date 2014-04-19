;(function(exports, module) {
  if (module) {
    var Utils = require('./utils').Utils;
  } else {
    Utils = exports.Utils;
  }

  function Connection(socket){
    Utils.makeEventable(this);
    this.socket = socket;

    this.socket.on('open', function() {
      this.emit('open');
    }.bind(this));
    this.socket.on('message', function(buf){
      var bytes = Utils.arrayify(buf);
      this.emit('msg', bytes);
    }.bind(this));

    this.socket.on('close', function(){
      this.emit('close');
    }.bind(this));
  }

  Connection.prototype = {
    constructor: Connection,
    send: function(bytes){
      this.socket.send(bytes, {binary: true, mask: false});
    }
  };

  exports.Connection = Connection;

}).apply(null, [typeof exports !== 'undefined' ? exports : this,
                typeof module !== 'undefined' ? module : null]);

