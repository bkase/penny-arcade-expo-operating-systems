;(function(exports, module) {
  if (module) {
    var Utils = require('./utils').Utils;
  } else {
    Utils = exports.Utils;
  }

  function Connection(socket){
    Utils.makeEventable(this);
    this.socket = socket;

    if ('on' in this.socket){
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
    else {
      this.socket.binaryType = 'arraybuffer';
      this.socket.onopen = function() {
        this.emit('open');
      }.bind(this);
      this.socket.onmessage = function(buf){
        var bytes = Utils.arrayify(new Uint8Array(buf.data));
        this.emit('msg', bytes);
      }.bind(this);

      this.socket.onclose = function(){
        this.emit('close');
      }.bind(this);
    }
  }

  Connection.prototype = {
    constructor: Connection,
    send: function(bytes){
      if ('on' in this.socket)
        this.socket.send(bytes, {binary: true, mask: false});
      else {
        var array = new Uint8Array(bytes);
        this.socket.send(array.buffer);
      }

    }
  };

  exports.Connection = Connection;

}).apply(null, [typeof exports !== 'undefined' ? exports : this,
                typeof module !== 'undefined' ? module : null]);

