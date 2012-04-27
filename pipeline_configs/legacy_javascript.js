/**
 * @module legacy javascript config
 * @copyright 2012 Charles Jolley
 * 
 * Default configs for plain CSS files.
 * 
 */

var plugins = require('../pipeline_plugins');

module.exports = {
  type: 'application/javascript',
  compilers: {
    '.js': plugins.GenericCompiler,
    '.coffee': plugins.CoffeeScriptCompiler
  },

  analyzer: plugins.GenericAnalyzer,
  linker:   plugins.SimpleMergeLinker,
  minifier: plugins.UglifyMinifier
};
