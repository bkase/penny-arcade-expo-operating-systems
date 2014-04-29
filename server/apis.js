var Utils = require('../common/utils').Utils;

function APIs(uid){
  Utils.makeEventable(this);
  this.fnTableByUID = {};
  this.activeAPIsByConnId = {};
  this.uid = uid;
}

APIs.prototype = {

  commit: function(V, done){
    console.log(V);
    console.log(done);
  },

  call: function(rpc, data, done){
    //TODO check user logged in
    var apiStr = Utils.stringifyAPIIdentifier(data.apiIdentifier);
    if (!(apiStr in fnTable)){
      done({ err: 'api not active' });
      return;
    }
    fnTable[apiStr].call('call', data, function(err, output){
      if (err)
        throw err;
      done(output);
    });
  },

  activate: function(rpc, data, done){
    this.emit('request', { 'msg': 3, name: 'activate' }, function(done){ done(true); });
    return;
    //TODO check user logged in + api registered + owned by user
    var err = { errs: [] };
    var wasErr = false;
    data.apiIdentifiers.forEach(function(apiIdentifier){
      var apiStr = Utils.stringifyAPIIdentifier(apiIdentifier);
      if (apiStr in fnTable){
        err.errs.push('api already activated');
        wasErr = true;
      }
      else {
        fnTable[apiStr] = rpc;
        if (!(rpc.conn.id in activeAPIsByConnId)){
          activeAPIsByConnId[rpc.conn.id] = {};
        }
        activeAPIsByConnId[rpc.conn.id][apiStr] = true;
      }
      err.errs.push(null);
    });
    if (wasErr)
      done({ err: err });
    else
      done({ err: null });
  },

  deactivate: function(rpc, data, done){
    //TODO check user logged in + api owned by user
    delete fnTable[Utils.stringifyAPIIdentifier(apiIdentifier)];
    if (rpc.conn.id in activeAPIsByConnId){
      delete activeAPIsByConnId[rpc.conn.id][apiStr];
    }
    done({ err: null });
  },
  close: function(rpc){
    if (rpc.conn.id in activeAPIsByConnId){
      for (var apiStr in activeAPIsByConnId[rpc.conn.id]){
        delete fnTable[apiStr];
      }
    }
    delete activeAPIsByConnId[rpc.conn.id];
  }

}

exports.APIs = APIs;
