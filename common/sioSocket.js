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
      console.log('close');
      this.emit('close');
    }.bind(this));

    setTimeout(function(){
      this.emit('open');
    }.bind(this), 0);

    this.socket.on('msg', function (str) {
      this.emit('message', unpack(str));
    }.bind(this));
  }

  SIOSocket.prototype = {
    constructor: SIOSocket,

    send: function(bytes){
      this.socket.emit('msg', pack(bytes));
    }
  }

  function pack(bytes){
    return Utils.bytesToString(bytes);
  }

  function unpack(string){
    return Utils.stringToBytes(string);
  }

  exports.SIOSocket = SIOSocket;

}).apply(null, [typeof exports !== 'undefined' ? exports : this,
                typeof module !== 'undefined' ? module : null]);

