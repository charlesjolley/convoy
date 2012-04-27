/**
 * @module css config
 * @copyright 2012 Charles Jolley
 * 
 * Default configs for plain CSS files.
 * 
 */

var plugins = require('../pipeline_plugins');

module.exports = {
  type: 'text/css',
  
  compilers: {
    '.css': plugins.GenericCompiler
  },

  analyzer: plugins.GenericAnalyzer,
  linker:   plugins.SimpleMergeLinker,
  minifier: null // none yet defined for CSS
};
