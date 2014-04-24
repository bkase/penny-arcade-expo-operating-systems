;(function(exports, module) {

  if (module) {
    var Utils = require('./utils').Utils;
  } else {
    Utils = exports.Utils;
  }

  function RPC(conn, prependConn){
    this.conn = conn;
    this.prependConn = !!prependConn;
    Utils.makeEventable(this);
    this.nextRequestId = 0;
    this.gotCallByRequestId = {};
    this.fnTable = [];
    this.TIMEOUT = 2000;
    this.conn.on('msg', this.parseMsg.bind(this));
    this.conn.on('close', function(){
      this.emit('close', this);
    }.bind(this));
  }

  RPC.prototype = {
    constructor: RPC,
    call: function(name, input, done){
      var requestId = this.nextRequestId++
      this.conn.send(Utils.jsonToBytes({
        requestId: requestId,
        name: name,
        input: input
      }));
      setTimeout(function(){
        if (!this.gotCallByRequestId[requestId]){
          this.gotCallByRequestId[requestId] = true;
          this.fnTable[requestId](new Error('timeout'));
          delete this.fnTable[requestId];
        }
      }.bind(this), this.TIMEOUT);
      this.fnTable[requestId] = done;
    },
    parseMsg: function(bytes){
      var json = Utils.bytesToJSON(bytes);
      if (json.resultId != null){
        var id = json.resultId;
        if (id in this.fnTable && !this.gotCallByRequestId[id]){
          this.gotCallByRequestId[id] = true;
          this.fnTable[id](null, json.input);
          delete this.fnTable[id];
        } else {
          throw new Error('cb not in table!');
        }
      } else {
        var args =[
          json.name, 
          json.input, 
          function(output){
            this.conn.send(Utils.jsonToBytes({
              resultId: json.requestId,
              input: output
            }));
          }.bind(this)
        ];
        if (this.prependConn)
          args.splice(1,0,this);
        this.emit.apply(this, args);
      }
    }
  }

  exports.RPC = RPC;

}).apply(null, [typeof exports !== 'undefined' ? exports : this,
                typeof module !== 'undefined' ? module : null]);


