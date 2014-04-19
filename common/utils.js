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
    whoami: function(done){
      var spawn = require('child_process').spawn;
      var whoami = spawn('whoami');
      var whoiam = '';
      whoami.stdout.on('data', function(data){
        whoiam += data.toString();
      });
      whoami.on('close', function(){
        done(whoiam.replace('\n', ''));
      });
    },
    waterfall: function(fns, done, args){
      args = args || [];
      if (fns.length === 0){
        done.apply(null, [null].concat(args));
      }
      else {
        fns.shift().apply(null, args.concat([function(err){
          if (err)
            done(err);
          else 
            Utils.waterfall(fns, done, Array.prototype.slice.call(arguments, 1));
        }]));
      }
    },
  }

  exports.Utils = Utils;

}).apply(null, [typeof exports !== 'undefined' ? exports : this,
                typeof module !== 'undefined' ? module : null]);

