;(function(exports, module) {

  if (module) {
    var Utils = require('./utils').Utils;
  } else {
    Utils = exports.Utils;
  }

  function RPC(conn){
    this.conn = conn;
    Utils.makeEventable(this);
    this.nextRequestId = 0;
    this.fnTable = [];
    this.conn.on('msg', this.parseMsg.bind(this));
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
      this.fnTable[requestId] = done;
    },
    parseMsg: function(bytes){
      var json = Utils.bytesToJSON(bytes);
      if (json.resultId != null){
        var id = json.resultId;
        if (id in this.fnTable){
          this.fnTable[id](null, json.input);
          delete this.fnTable[id];
        } else {
          throw new Error('cb not in table!');
        }
      } else {
        this.emit(json.name, json.input, function(output){
          this.conn.send(Utils.jsonToBytes({
            resultId: json.requestId,
            input: output
          }));
        }.bind(this));
      }
    }
  }

  exports.RPC = RPC;

}).apply(null, [typeof exports !== 'undefined' ? exports : this,
                typeof module !== 'undefined' ? module : null]);


