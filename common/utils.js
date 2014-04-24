;(function(exports, module) {

  function Count(num, fn){
    this.num = num;
    this.fn = fn;
  }

  Count.prototype = {
    constructor: Count,

    sub: function(){
      this.num -= 1;
      if (this.num == 0)
        this.fn();
    }

  }

  //http://stackoverflow.com/questions/424292/seedable-javascript-random-number-generator
  function RNG(seed){
    //from GCC
    this.m = 0x100000000;
    this.a = 1103515245;
    this.c = 12345;
    
    this.state = seed
  }

  RNG.prototype = {
    constructor: RNG,
    nextInt: function(){
      this.state = (this.a*this.state+this.c)%this.m;
      return this.state;
    },
    nextFloat: function(){
      return this.nextInt() / (this.m-1);
    }
  }

  var Utils = {
    count: function(){
      var count = Object.create(Count.prototype);
      Count.apply(count, arguments);
      return count;
    },
    Count: Count,
    RNG: RNG,
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
          console.log(module.name, 'dropped', event);
        }
      }.bind(module);
      module.ison = function(event){
        return module['on' + event] != null;
      }.bind(module);
      module.off = function(event){
        delete module['on' + event];
      }.bind(module);
      return module;
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
      if (done.__beenCalled == null)
        done.__beenCalled = false;
      args = args || [];
      if (fns.length === 0){
        done.apply(null, [null].concat(args));
      }
      else {
        fns.shift().apply(null, args.concat([function(err){
          if (done.__beenCalled){
            throw new Error('its been called what are you doing!');
          }
          else if (err){
            done.__beenCalled = true;
            done(err);
          }
          else 
            Utils.waterfall(fns, done, Array.prototype.slice.call(arguments, 1));
        }]));
      }
    },
    stringifyAPIIdentifier: function(apiIdentifier){
      return apiIdentifier.namespace + '.' + apiIdentifier.name + '.' + apiIdentifier.version;
    }
  }

  exports.Utils = Utils;

}).apply(null, [typeof exports !== 'undefined' ? exports : this,
                typeof module !== 'undefined' ? module : null]);

