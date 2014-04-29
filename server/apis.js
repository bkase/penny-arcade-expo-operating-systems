var Utils = require('../common/utils').Utils;

function APIs(uid){
  Utils.makeEventable(this);
  this.apisByUID = {};
  this.activeAPIs = {};
  this.activeAPIsByConnId = {};
  this.uid = uid;

  this.nextCbId = 0;
  this.cbById = {};
}

APIs.prototype = {

  commit: function(V, done){
    if (V.name === 'activate'){
      this.activeAPIs[Utils.stringifyAPIIdentifier(V.api)] = true;
      this._lazyAddUIDToAPIs(V.uid);
      this.apisByUID[V.uid][Utils.stringifyAPIIdentifier(V.api)] = V.api;
      this._lazyCallCallback(V)(null);
      if (V.uid === this.uid){
        
      }
    } else {
      console.log('apis dropped', V);
    }
  },

  call: function(rpc, data, done){
    //TODO check user logged in
    //Var apiStr = Utils.stringifyAPIIdentifier(data.apiIdentifier);
    //If (!(apiStr in fnTable)){
    //  done({ err: 'api not active' });
    //  return;
    //}
    //FnTable[apiStr].call('call', data, function(err, output){
    //  if (err)
    //    throw err;
    //  done(output);
    //});
  },

  activate: function(rpc, data, done){
    //TODO check user logged in + api registered + owned by user
    var err = { errs: {} };
    var wasErr = false;
    var countActivates = Utils.count(Utils.size(data.apiIdentifiers), next.bind(this));
    data.apiIdentifiers.forEach(function(apiIdentifier, i){
      this._activateAPI(apiIdentifier, function(err){
        if (err){
          err.errs[i] = 'api already activated';
          wasErr = true;
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
    //delete fnTable[Utils.stringifyAPIIdentifier(apiIdentifier)];
    //if (rpc.conn.id in activeAPIsByConnId){
    //  delete activeAPIsByConnId[rpc.conn.id][apiStr];
    //}
    //done({ err: null });
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

  _lazyCallCallback: function(V){
    return function(){
      if (V.uid === this.uid){
        if (V.cbId in this.cbById){
          this.cbById[V.cbId].apply(null, arguments);
        } else {
          console.log(this.uid, 'dropped', V.cbId);
        }
      }
    }.bind(this);
  },

  _addCallback: function(V, done){
    V.cbId = this.nextCbId++;
    this.cbById[V.cbId] = done;
  },

  _lazyAddUIDToAPIs: function(uid){
    if (!(uid in this.apisByUID)){
      this.apisByUID[uid] = {}
    }
  },

  _activateAPI: function(api, done){
    var V = {
      name: 'activate',
      uid: this.uid,
      api: api
    };
    this._addCallback(V, done);
    this.emit('request', V, function(done){
      var valid = !(Utils.stringifyAPIIdentifier(api) in this.activeAPIs);
      if (!valid){
        this._lazyCallCallback(V)('api activated');
      }
      done(valid);
    }.bind(this));
  }

}

exports.APIs = APIs;
