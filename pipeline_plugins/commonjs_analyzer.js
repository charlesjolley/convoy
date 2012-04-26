/**
 * @module commonjs_analyzer
 * @copyright 2012 Charles Jolley
 */

var UGLIFY = require('uglify-js');
var PATH = require('path');

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
      results.push(args[0][1]);
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
  asset.dependencies = modules.map(function(moduleId) {
    return context.resolve(moduleId, PATH.dirname(asset.path));
  });

  done();
}

module.exports = CommonJSAnalyzer;
