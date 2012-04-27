/**
 * @module convoy
 * @copyright 2012 Charles Jolley
 * 
 * Main entry point for library.
 */

var Pipeline = require('./pipeline').Pipeline;
var AssetPackager = require('./asset_packager').AssetPackager;

/**
 * Returns a new pipeline instance with the passed config. This is the same
 * as creating a new pipeline from an instance. Takes optional hashes of 
 * configs.
 * 
 * @return {Pipeline} pipeline instance
 */
module.exports = exports = function() {
  return new Pipeline()._config(arguments);
};

exports.AssetPackager = AssetPackager;
exports.Pipeline      = Pipeline;
exports.plugins       = require('../pipeline_plugins');
exports.configs       = require('../pipeline_configs');

