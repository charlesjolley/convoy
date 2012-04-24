/**
 * @module pipeline
 * @copyright 2012 Charles Jolley
 * 
 */

var async       = require('async');
var SourceAsset = require('./source_asset').SourceAsset;
var Builder     = require('./builder').Builder;

function _normalizedConfig(config) {
  return config || {};
}

function _addConfigAssets(pipeline, config) {

}

function _resetAssets(pipeline) {
  pipeline.preparableAssets = {}; // assets used to prepared.
  pipeline.sourceAssets     = {}; // cached source assets
  pipeline.publicPaths      = []; // array of public assets to build
}

function _values(hash) {
  Object.keys(hash).map(function(key) { return hash[key]; });
}

/**
 * Pipeline instance retrieves built assets exposed via the API.
 * 
 * @constructor
 */
function Pipeline(config) {
  this.middleware       = this.middleware.bind(this); 
  this.publicAssets     = {};

  if (config && config.assets) _addConfigAssets(this, config.assets);
  this.config = _normalizedConfig(config);
}

/**
 * Returns an Asset for a source file on disk. Also makes the file a 
 * dependency in the pipeline for caching purposes.
 *
 * SourceAssets know how to load themselves and normalize to a particular
 * type based on extension using registered compilers.
 * 
 * @param  {String}      path Path to search for
 * @return {SourceAsset}      source asset.
 * @memberOf Pipeline.prototype
 */
Pipeline.prototype.getSourceAsset = function(path) {
  if (!this.sourceAssets[path]) {
    this.sourceAssets[path] = new SourceAsset(this, path);
    // TODO: start watching asset to invalidate cache..
  }
  return this.sourceAssets[path];
};

// add an asset to the list. invalidate the pipeline.
Pipeline.prototype.add = function(publicPath, options) {
  var asset;
  if (options instanceof SourceAsset) {
    asset = options;
  } else {
    // TODO: make asset...
  }

  this.preparableAssets[publicPath] = asset;
  this.invalidate();
  return true;
};

Pipeline.prototype.remove = function(publicPath) {
  if (this.preparableAssets[publicPath]) {
    delete this.preparableAssets[publicPath];
    this.invalidate();
    return true;
  }

  return false;
};

Pipeline.prototype.prepare = function(done) {
  if (!done) done = K;
  if (!this._prepare) {
    var self = this;
    this._prepare = async.memoize(function(done) {
      async.forEach(_values(self.preparableAsset), function(item, next) {
        item.prepare(self, next);
      }, done);
    });
  }

  this._prepare(done);
};

Pipeline.prototype.invalidate = function() {
  if (this._prepare) {
    var self = this;
    self._prepare(function() {
      _values(self.preparableAssets).forEach(function(asset) {
        asset.invalidate();
      });
      _resetAssets(self);
    });
  }
};

/**
 * Build an asset at the named public path. Invoke the passed callback
 * when done with the contents of the asset.
 * 
 * @param  {String}   publicPaths Path or array of paths to build.
 * @param  {Function} done        Callback on complete
 * @return {Builder}  builder instance (use for logging, etc.)              
 */
Pipeline.prototype.build = function(publicPaths, done) {
  if ('string' === typeof publicPaths) publicPaths = [publicPaths];
  return new Builder(this, publicPaths, done);
};

/**
 * Middleware you can use in a connect application.
 * @type {Function}
 */
Pipeline.prototype.middleware = function() {
  throw new Error('middleware unimplemented');
};

exports.Pipeline = Pipeline;

/**
 * Returns a new pipeline that can be used as middleware for connect.
 * @param  {Hash}   config      Options to pass to new instance.
 * @return {Pipeline}         Pipeline instance
 */
exports.pipeline = function(config) {
  return new Pipeline(config);
};



