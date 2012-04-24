/**
 * @module context
 * @copyright 2012 Charles Jolley
 * 
 * Defines a context for processing source assets. Configure root path and 
 * plugins to determine how processing is handled.
 */

var path = require('path');
var SourceAsset = require('./source_asset').SourceAsset;
var DefaultCompiler = require('./default_compiler').DefaultCompiler;

/**
 * Constructor for a new context. rootPath should be the package root, if 
 * defined. This will be used to automatically load plugins.
 * 
 * @param {String} rootPath
 */
function Context(rootPath) {
  this.sourceAssets = {};
  this.rootPath = rootPath || process.cwd();
}

var Cp = Context.prototype;

/**
 * Returns an asset object for the specified path. Calling this more than once
 * will return the same asset object instance unless the context has been
 * reset.
 * @param  {String} fromPath Path to a file. Will be normalized.
 * @param  {String} rootPath Optional - used to resolve fromPath.
 * @return {Asset}           Asset instance.
 */
Cp.getSourceAsset = function(fromPath, rootPath) {
  fromPath = path.resolve(rootPath || this.rootPath, fromPath);
  var asset = this.sourceAssets[fromPath];
  if (!asset) {
    asset = this.sourceAssets[fromPath] = new SourceAsset(fromPath, this);
  }
  return asset;
};

/**
 * Resets the context caches. This will cause assets to rebuild from source
 * the next time you try to access them.
 * 
 * @param  {Function} done Callback to be invoked when reset is complete.
 * @return {void}        
 */
Cp.reset = function(done) {
  this.sourceAssets = {};
  if (done) done();
};

/**
 * Selects the most appropriate compiler plugin for the given asset.
 * @param  {Asset} asset Asset to process
 * @return {Plugin} Plugin with compile method.
 */
Cp.compilerForAsset = function(asset) {
  return new DefaultCompiler(this);
};

/**
 * Selects an array of postprocessors for the given asset.
 * @param  {Asset} asset Asset to process
 * @return {Array}       Array of plugins
 */
Cp.postprocessorsForAsset = function(asset) {
  return [];
};

exports.Context = Context;
