/**
 * @module commonjs_linker
 * @copyright 2012 Charles Jolley
 */

var UTILS = require('../lib/utils');
var ASYNC = require('async');
var PATH  = require('path');

var _extend = UTILS.extend;

var GLOBAL_NAME = '$mod';

//............................
// Module loader for browser.
//

var LOADER = '(' + 
  require('../lib/loader').toString() + 
')(window, '+JSON.stringify(GLOBAL_NAME)+');\n';

function wrap(moduleId, moduleBody, options) {
  return GLOBAL_NAME + '.define(' + JSON.stringify(moduleId) + ', ' + 
    JSON.stringify(moduleBody) + 
    (options ? (', ' + JSON.stringify(options)) : '') + ');';
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

    // find any conflicts and setup aliases.
    expanded.forEach(function(asset) {
      if (asset.conflicts && (asset !== asset.conflicts[0]) && !asset.aliasId) {
        var idx = asset.conflicts.indexOf(asset); // create unique alias
        var aliasId = '/__conflicts_'+idx+'__/'+asset.id;
        asset.aliasId = aliasId;
        asset.parents.forEach(function(parent) {
          if (!parent.aliases) parent.aliases = {};
          parent.aliases[asset.id] = aliasId;
        });
      }
    });

    ASYNC.map(expanded, function(asset, next) {
      var id = asset.id, opts, body;

      body = '(function(require, exports, module) { '+asset.body +
        '\n});\n//@ sourceURL=' + id + '\n';

      if (asset.aliasId) {
        id = asset.aliasId;

      // if this asset is also the main module for the package, then include
      // in wrap
      } else if (asset.pkg && asset.pkg.main) {
        var mainPath;
        try {
          mainPath = context.resolve(asset.pkg.path, asset.pkg.main);
        } catch (e) {
          mainPath = null; // ignore main path if none 
        }
        if (asset.path === mainPath) id = [id, PATH.basename(asset.pkg.path)];
      }

      if (asset.aliases) opts = { aliases: asset.aliases };

      minifyIfNeeded(context, asset, body, function(err, body) {
        next(err, wrap(id, body, opts));
      });
    }, function(err, expanded) {
      if (err) return done(err);
      asset.body = LOADER + '\n' + expanded.join("\n");
      done();
    });
  });
}


exports = module.exports = CommonJSLinker;
exports.wrap = wrap;
exports.LOADER = LOADER;
