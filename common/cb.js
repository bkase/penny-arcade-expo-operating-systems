

function CB(uid){
  this.nextCbId = 0;
  this.cbById = {};
  this.uid = uid;
}

CB.prototype = {
  constructor: CB,

  lazyCallCallback: function(V){
    return function(){
      if (V.uid === this.uid){
        if (V.cbId in this.cbById){
          this.cbById[V.cbId].apply(null, arguments);
          delete this.cbById[V.cbId];
        } else {
          console.log(this.uid, 'dropped', V.cbId);
        }
      }
    }.bind(this);
  },

  addCallback: function(V, done){
    V.cbId = this.nextCbId++;
    this.cbById[V.cbId] = done;
  },

}

exports.CB = CB;
