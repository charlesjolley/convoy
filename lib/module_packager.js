/**
 * @module module_package
 * @copyright 2012 Charles Jolley
 * 
 * An AssetPackager configured to process CommonJS modules. The individual
 * plugins used here are exported independently as well so you can assemble
 * these items as needed.
 * 
 */

var ASSET_PACKAGER     = require('./asset_packager');
var UGLIFY             = require('uglify-js');
var UTILS              = require('./utils');
var ASYNC              = require('async');
var PATH               = require('path');
var AssetPackager      = ASSET_PACKAGER.AssetPackager;

var _extend = UTILS.extend;
var parser = UGLIFY.parser;

var GLOBAL_NAME = '$mod';

//............................
// Module loader for browser.
//

var LOADER = '(' + 
  require('./loader').toString() + 
')(window, '+JSON.stringify(GLOBAL_NAME)+');\n';

//.................................
// PLUGINS
//

function wrap(moduleId, moduleBody) {
  return GLOBAL_NAME + '.define(' + JSON.stringify(moduleId) + ', ' + 
    JSON.stringify(moduleBody) + ');';
}

function _extractRequiredModules(asset) {
  var ast, results = [],
    walker = UGLIFY.uglify.ast_walker();

  try {
    ast = parser.parse(asset.body);
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

function _minify(context, asset, body, done) {
  asset = Object.create(asset);
  asset.body = body;
  context.minifier(asset, context, function(err) {
    done(err, asset.body);
  });
}

function _skipMinify(context, asset, body, done) {
  done(null, body);
}

// extends the simple linker to wrap assets annoted as modules.
function CommonJSLinker(asset, context, done) {
  var seenPackages = [];
  var minifyIfNeeded = context.minify ? _minify : _skipMinify;

  context.expand(asset.assets, function(err, expanded) {
    if (err) return done(err);
    ASYNC.map(expanded, function(asset, next) {
      var id = context.unresolve(asset.path);
      var body = '(function(require, exports, module) { '+asset.body +
        '\n});\n//@ sourceURL=' + id + '\n';
      minifyIfNeeded(context, asset, body, function(err, body) {
        next(err, wrap(id, body));
      });
    }, function(err, expanded) {
      if (err) return done(err);
      asset.body = LOADER + '\n' + expanded.join("\n");
      done();
    });
  });
}

var DEFAULT_CONFIG = {
  analyzer: CommonJSAnalyzer,
  linker:   CommonJSLinker
};

module.exports = exports = function(config) {
  if (config) {
    config = _extend(_extend({}, DEFAULT_CONFIG), config);
  } else {
    config = DEFAULT_CONFIG;
  }
  return new AssetPackager(config);
};

exports.CommonJSAnalyzer = CommonJSAnalyzer;
exports.CommonJSLinker   = CommonJSLinker;
exports.wrap             = wrap;
exports.LOADER           = LOADER;
