;(function(exports, module) {
  if (module) {
    var Utils = require('./utils').Utils;
  } else {
    Utils = exports.Utils;
  }

  function SIOSocket(socket){
    Utils.makeEventable(this);

    this.socket = socket;

    this.socket.on('disconnect', function () {
      this.emit('close');
    }.bind(this));

    setTimeout(function(){
      this.emit('open');
    }.bind(this), 0);

    this.socket.on('msg', function (bytes) {
      this.emit('message', bytes);
    }.bind(this));
  }

  SIOSocket.prototype = {
    constructor: SIOSocket,

    send: function(bytes){
      this.socket.emit('msg', bytes);
    }

  }

  exports.SIOSocket = SIOSocket;

}).apply(null, [typeof exports !== 'undefined' ? exports : this,
                typeof module !== 'undefined' ? module : null]);

