/**
 * @module default packagers
 * @copyright 2012 Charles Jolley
 */

var AssetPackager = require('./asset_packager').AssetPackager;
var AssetCopier   = require('./asset_copier').AssetCopier;
var UTILS   = require('./utils');
var plugins = require('../pipeline_plugins');

// generates a new packager subclass with default config
function packager() {
  function Packager() {
    AssetPackager.apply(this, arguments);
  }

  Packager.prototype = UTILS.merge(Object.create(AssetPackager.prototype), 
                                   Array.prototype.slice.call(arguments));

  return Packager;
}

exports.javascript = packager({
  type: 'application/javascript',
  compilers: {
    '.js':     plugins.GenericCompiler,
    '.coffee': plugins.CoffeeScriptCompiler
  },

  analyzer: plugins.CommonJSAnalyzer,
  linker:   plugins.CommonJSLinker,
  minifier: plugins.UglifyMinifier
});


exports.legacy_javascript = packager({
  type: 'application/javascript',
  compilers: {
    '.js': plugins.GenericCompiler,
    '.coffee': plugins.CoffeeScriptCompiler
  },

  analyzer: plugins.GenericAnalyzer,
  linker:   plugins.SimpleMergeLinker,
  minifier: plugins.UglifyMinifier
});

exports.css = packager({
  type: 'text/css',
  
  compilers: {
    '.css': plugins.GenericCompiler
  },

  analyzer: plugins.GenericAnalyzer,
  linker:   plugins.SimpleMergeLinker,
  minifier: null // none yet defined for CSS
});

exports.copy = AssetCopier;

exports.packager = packager;
