/**
 * @module javascript config
 * @copyright 2012 Charles Jolley
 * 
 * Default configs for module-based JavaSript files.
 * 
 */

var plugins = require('../pipeline_plugins');

module.exports = {
  type: 'application/javascript',
  compilers: {
    '.js': plugins.GenericCompiler,
    '.coffee': plugins.CoffeeScriptCompiler
  },

  analyzer: plugins.CommonJSAnalyzer,
  linker:   plugins.CommonJSLinker,
  minifier: plugins.UglifyMinifier
};
