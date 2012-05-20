/**
 * @module commonjs_analyzer
 * @copyright 2012 Charles Jolley
 */

var UGLIFY = require('uglify-js');
var PATH = require('path');

// modules found here are skipped as requirements. Mostly this includes the 
// builtin modules for node as well as some specific exceptions for jquery 
var EXCEPTIONS = {
  '__node': require('../lib/resolver').core, 
  '__narwhal': { system: true, file: true },
  'jquery': { 
    jsdom: true, xmlhttprequest: true, location: true, navigator: true 
  } 
};

function _extractRequiredModules(asset) {
  var ast, results = [],
    walker = UGLIFY.uglify.ast_walker();

  try {
    ast = UGLIFY.parser.parse(asset.body);
  } catch(e) {
    var se = new SyntaxError(e.message);
    se.file = asset.path;
    se.line = e.line + 1;
    se.col  = e.col;
    se.pos  = e.pos;
    throw se;
  }

  function handleExpr(expr, args) {
    if (expr[0] === 'name' && expr[1] === 'require') {
      var moduleId = args[0][1];
      var exceptions = asset.pkg && EXCEPTIONS[asset.pkg.name];
      var isException = 
          EXCEPTIONS.__node[moduleId] || EXCEPTIONS.__narwhal[moduleId] ||
          (exceptions && exceptions[moduleId]); 
      if (!isException) results.push(moduleId);
    }
  }

  walker.with_walkers({
    "new": handleExpr,
    "call": handleExpr
  }, function() { return walker.walk(ast); });

  return results;
}

// inspects files for require statements
function CommonJSAnalyzer(asset, context, done) {
  asset.pkg = context.getNearestPackage(asset.path);
  var modules = _extractRequiredModules(asset);
  try {
    asset.dependencies = modules.map(function(moduleId) {
      return context.resolve(moduleId, PATH.dirname(asset.path));
    });
  } catch (e) {
    e.message = e.message +' (required in '+asset.id+')';
    throw e;
  }

  done();
}

module.exports = CommonJSAnalyzer;
