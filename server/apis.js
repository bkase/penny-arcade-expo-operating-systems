var Utils = require('../common/utils').Utils;
var CB = require('../common/cb').CB;

function APIs(uid){
  Utils.makeEventable(this);
  this.apisByUID = {};
  this.activeAPIs = {};
  this.activeAPIsByConnId = {};
  this.localRPCByAPIId = {};
  this.uid = uid;
  this.cb = new CB(this.uid);
}

APIs.prototype = {

  commit: function(V, done){
    if (V.name === 'activate'){
      var apiStr = Utils.stringifyAPIIdentifier(V.apiId);
      this.activeAPIs[apiStr] = V.uid;
      this._lazyAddUIDToAPIs(V.uid);
      this.apisByUID[V.uid][apiStr] = V.apiId;
      this.cb.lazyCallCallback(V)(null);
    } else if (V.name === 'deactivate'){
      var apiStr = Utils.stringifyAPIIdentifier(V.apiId);
      delete this.activeAPIs[apiStr];
      this._lazyAddUIDToAPIs(V.uid);
      delete this.apisByUID[V.uid][apiStr];
      this.cb.lazyCallCallback(V)(null);
    } else {
      console.log('apis dropped paxos', V);
    }
  },

  receiveMsg: function(name, msg, done){
    if (name === 'call'){
      var apiId = msg.apiId;
      var apiStr = Utils.stringifyAPIIdentifier(msg.apiId);
      if (apiStr in this.localRPCByAPIId){
        this.localRPCByAPIId[apiStr].call('call', msg.input, function(err, output){
          if (err)
            done({ err: err })
          else
            done({ output: output });
        });
      } else {
        done('api not found');
      }
    } else {
      console.log('apis dropped msg', name, msg);
    }
  },

  call: function(rpc, data, done){
    //TODO check user logged in
    var apiStr = Utils.stringifyAPIIdentifier(data.apiIdentifier);
    if (!(apiStr in this.activeAPIs)){
      done({ err: 'api not active' });
      return;
    }
    this.emit('sendMsg', 
              this.activeAPIs[apiStr],
              'call', 
              { 
                apiId: data.apiIdentifier,
                input: data
              },
              function(err, data){
                if (err)
                  throw err;
                if (data.err)
                  done(data);
                else
                  done(data.output);
              }.bind(this));
  },

  activate: function(rpc, data, done){
    //TODO check user logged in + api registered + owned by user
    var err = { errs: {} };
    var wasErr = false;
    var countActivates = Utils.count(Utils.size(data.apiIdentifiers), next.bind(this));
    data.apiIdentifiers.forEach(function(apiIdentifier, i){
      var apiStr = Utils.stringifyAPIIdentifier(apiIdentifier);
      this._activateAPI(apiIdentifier, function(err){
        if (err){
          err.errs[i] = 'api already activated';
          wasErr = true;
        } else {
          this.localRPCByAPIId[apiStr] = rpc;
        }
        countActivates.sub();
      }.bind(this));
    }.bind(this));

    function next(){
      if (wasErr)
        done({ err: err });
      else
        done({ err: null });
    }
  },

  deactivate: function(rpc, data, done) {
    //TODO check user logged in + api owned by user
    var err = { errs: {} };
    var wasErr = false;
    var countDeactivates = Utils.count(Utils.size(data.apiIdentifiers), next.bind(this));
    data.apiIdentifiers.forEach(function(apiIdentifier, i){
      var apiStr = Utils.stringifyAPIIdentifier(apiIdentifier);
      this._deactivateAPI(apiIdentifier, function(err){
        if (err){
          err.errs[i] = 'api not active';
          wasErr = true;
        } else {
          delete this.localRPCByAPIId[apiStr];
        }
        countDeactivates.sub();
      }.bind(this));
    }.bind(this));

    function next(){
      if (wasErr)
        done({ err: err });
      else
        done({ err: null });
    }
  },
  close: function(rpc){
    //if (rpc.conn.id in activeAPIsByConnId){
    //  for (var apiStr in activeAPIsByConnId[rpc.conn.id]){
    //    delete fnTable[apiStr];
    //  }
    //}
    //delete activeAPIsByConnId[rpc.conn.id];
  },

  //=================
  //  HELPERS
  //=================

  _lazyAddUIDToAPIs: function(uid){
    if (!(uid in this.apisByUID)){
      this.apisByUID[uid] = {}
    }
  },

  _deactivateAPI: function(api, done){
    var V = {
      name: 'deactivate',
      uid: this.uid,
      api: api
    };
    this.cb.addCallback(V, done);
    this.emit('request', V, function(done){
      var valid = Utils.stringifyAPIIdentifier(api) in this.activeAPIs;
      if (!valid){
        this.cb.lazyCallCallback(V)('api not active');
      }
      done(valid);
    }.bind(this));
  },

  _activateAPI: function(apiId, done){
    var V = {
      name: 'activate',
      uid: this.uid,
      apiId: apiId
    };
    this.cb.addCallback(V, done);
    this.emit('request', V, function(done){
      var valid = !(Utils.stringifyAPIIdentifier(apiId) in this.activeAPIs);
      if (!valid){
        this.cb.lazyCallCallback(V)('api activated');
      }
      done(valid);
    }.bind(this));
  }

}

exports.APIs = APIs;
