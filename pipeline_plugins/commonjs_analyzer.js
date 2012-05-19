/**
 * @module commonjs_analyzer
 * @copyright 2012 Charles Jolley
 */

var UGLIFY = require('uglify-js');
var PATH = require('path');

// modules found here are skipped as requirements. Mostly this includes the 
// builtin modules for node as well as some specific exceptions for jquery 
var EXCEPTIONS = {
  '__node': ['util', 'events', 'stream', 'buffer', 'crypto', 'tls', 'fs', 'path', 
        'net', 'dgram', 'dns', 'http', 'url', 'querystring', 'https', 
        'readline', 'vm', 'child_process', 'asset', 'tty', 'zlib', 'os',
        'cluster'],
  'jquery': ['jsdom', 'xmlhttprequest', 'location', 'navigator']
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
      var isException = (EXCEPTIONS.__node.indexOf(moduleId)>=0 ||
          (exceptions && exceptions.indexOf(moduleId)>=0));
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
  asset.dependencies = modules.map(function(moduleId) {
    return context.resolve(moduleId, PATH.dirname(asset.path));
  });

  done();
}

module.exports = CommonJSAnalyzer;
