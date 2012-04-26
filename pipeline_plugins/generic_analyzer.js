/**
 * @module generic_analyzer
 * @copyright 2012 Charles Jolley
 */

var PATH = require('path');
var GLOBAL_REGEX = /^\s*\/(\/|\*)=\s+require\s+.+\s*(\*\/)?\s*$/mg;
var LINE_REGEX   = /^\s*\/(\/|\*)=\s+require\s+(.+?)\s*(\*\/)?\s*$/m;
/**
 * Simple analyzer follows similar structure as Sprockets. Looks for two 
 * types of commands in files:
 * 
 *     //= require foo
 *     / *= require foo * /
 * 
 * @param {Hash}   asset   asset descriptor
 * @param {Object}   context package context object
 * @param {Function} done    invoked when complete.
 */
function GenericAnalyzer(asset, context, done) {
  var requires = asset.body.match(GLOBAL_REGEX),
      deps = {};

  if (requires) {
    try {
      requires = requires.map(function(line) {
        var id = line.match(LINE_REGEX)[2];
        var path = context.resolve(id, PATH.dirname(asset.path));
        return path;
      });
    } catch(e) {
      return done(e);
    }

    asset.dependencies = requires;

  }

  done();
}

module.exports = GenericAnalyzer;
