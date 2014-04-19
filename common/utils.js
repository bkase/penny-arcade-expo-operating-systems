;(function(exports, module) {

  var Utils = {
    makeEventable: function(module){
      module.on = function(event, fn){
        if (!this['on' + event])
          this['on' + event] = [];
        else if (!Array.isArray(this['on' + event]))
          this['on' + event] = [this['on' + event]];
        this['on' + event].push(fn);
      }.bind(module);
      module.emit = function(event){
        var args = Array.prototype.slice.call(arguments, 0);
        args.shift();
        var fn = this['on' + event];
        if (fn != null){
          if (!Array.isArray(fn)){
            fn.apply(null, args);
          }
          else {
            var fns = fn;
            fns.map(function(fn){ fn.apply(null, args); });
          }
        }
        else {
          console.log('dropped', event);
        }
      }.bind(module);
    },
    bytesToString: function(bytes){
      return bytes.map(function(c){ return String.fromCharCode(c); }).join('')
    },
    bytesToJSON: function(bytes){
      return JSON.parse(Utils.bytesToString(bytes));
    },
    jsonToBytes: function(json){
      if (json == null)
        return null;
      return Utils.stringToBytes(JSON.stringify(json));
    },
    bufferToBytes: function(buffer){
      return Array.prototype.slice.call(buffer, 0);
    },
    stringToBytes: function(str){
      var bytes = new Array(str.length);
      for (var i = 0; i < str.length; i++){
        bytes[i] = str.charCodeAt(i);
      }
      return bytes;
    },
    arrayify: function(arrayish){
      return Array.prototype.slice.call(arrayish, 0);
    },
    multiline: function(fn) {
      return fn.toString().replace(/^[^\/]+\/\*!?/, '').replace(/\*\/[^\/]+$/, '');
    },
  }

  exports.Utils = Utils;

}).apply(null, [typeof exports !== 'undefined' ? exports : this,
                typeof module !== 'undefined' ? module : null]);
