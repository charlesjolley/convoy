/**
 * @module default_plugins
 * @copyright 2012 Charles Jolley
 */

// Bring in all the plugins for use by other modules.

(function(e) {
  e.GenericCompiler      = require('./generic_compiler');
  e.JavaScriptCompiler   = require('./javascript_compiler');
  e.CoffeeScriptCompiler = require('./coffeescript_compiler');
  e.CSSCompiler          = require('./css_compiler');

  e.GenericAnalyzer      = require('./generic_analyzer');
  e.CommonJSAnalyzer     = require('./commonjs_analyzer');

  e.SimpleMergeLinker    = require('./simple_merge_linker');
  e.CommonJSLinker       = require('./commonjs_linker');

  e.UglifyMinifier       = require('./uglify_minifier');
})(exports);
