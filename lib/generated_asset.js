/**
 * @module generated_asset
 * @copyright 2012 Charles Jolley
 * 
 * Base class for generated assets built from other assets.
 * 
 * How an asset is generated:
 * 
 *  1.  `prepare()` - `include` assets are prepared. Then look at
 *      `dependencies` on each asset. This becomes the `expandedAssets` array. 
 *      If there are `exclude` assets, they will be removed from the array. 
 *      If an excluded asset is another GeneratedAsset, then any expanded assets
 *      from that asset will be removed. 
 *      
 *  2.  `merge()` is called. This will yield a combined string that can be 
 *      processed further. A ModuleLoaderPlugin could be used here to wrap each
 *      asset module. It should also include any bootstrap logic at the top.
 *      
 *  3.  `postprocess()` is called. Works through the array of postprocessors.
 *      Usually this contains the MinifierPlugin among other things.
 *  
 *  The last two steps are only called when you 'build' the asset.
 */

var async = require('async');

function _reset(asset) {

}


function GeneratedAsset(pipeline, config) {
  this.postprocessors = [];
  _reset(this);
}


GeneratedAsset.prototype.prepare = function(done) {
  if (!this._prepare) {
    var self = this;
    this._prepare = async.memoize(function(done) {
      async.waterfall([
        _prepareAllAssets,
        _collectDependencies,
        _removeDuplicates
      ], done);
    });
  }
  this._prepare(done);
};


GeneratedAsset.prototype.invalidate = function() {
  if (!this._build && !this._prepare) return ;

  var self = this;
  (this._build || this._prepare)(function() {
    _reset(self);
  });
};

GeneratedAsset.prototype.build = function(done) {
  if (!this._build) {
    var self = this;
    this._build = async.memoize(function(done) {
      async.waterfall([
        self._prepare.bind(self),
        self._merge.bind(self),
        self._postprocess.bind(self)
      ], done);
    });
  }
  this._build(done);
};

GeneratedAsset.prototype.merge = function(assets, done) {
  done(null, 'BODY');
};

GeneratedAsset.prototype.postprocess = function(body, done) {
  var tasks = this.postprocessors.slice();
  tasks.unshift(function(done) { done(null, body); });
  async.waterfall(tasks, done);
};


