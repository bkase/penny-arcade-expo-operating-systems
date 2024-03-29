;(function(exports, module) {
  if (module) {
    var Utils = require('./utils').Utils;
  } else {
    Utils = exports.Utils;
  }

  function Connection(socket){
    Utils.makeEventable(this);
    this.socket = socket;
    this.closed = false;

    if ('on' in this.socket){
      this.socket.on('open', function() {
        this.emit('open');
      }.bind(this));
      this.socket.on('message', function(buf){
        var bytes = Utils.arrayify(buf);
        this.emit('msg', bytes);
      }.bind(this));

      this.socket.on('close', function(){
        if (!this.closed){
          this.closed = true;
          this.emit('close');
        }
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
        if (!this.closed){
          this.closed = true;
          this.emit('close');
        }
      }.bind(this);
    }
  }

  Connection.prototype = {
    constructor: Connection,
    send: function(bytes){
      if (this.closed){
        //console.log('socket is closed');
        return;
      }
      try {
        if ('on' in this.socket)
          this.socket.send(bytes, {binary: true, mask: false});
        else {
          var array = new Uint8Array(bytes);
          this.socket.send(array.buffer);
        }
      } catch(e) {
        if (!this.closed){
          //console.log('c2', this.uid);
          this.closed = true;
          this.emit('close');
        }
      }
    },
    close: function(){
      //console.log('c1', this.uid);
      if (!this.closed){
        this.closed = true;
        this.socket.close();
        this.emit('close');
      }
    }
  };

  exports.Connection = Connection;

}).apply(null, [typeof exports !== 'undefined' ? exports : this,
                typeof module !== 'undefined' ? module : null]);

