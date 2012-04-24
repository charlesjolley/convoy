/**
 * @module helpers
 * @copyright 2012 Charles Jolley
 */

var path = require('path');
var fs   = require('fs');
var temp = require('temp');

var DIRNAME       = path.dirname(module.filename);
var FIXTURES_PATH = path.resolve(DIRNAME, '..', 'fixtures');

/**
 * Returns path to an object within the fixtures directory. Works just like
 * resolve().
 * @return {String} Path
 */
exports.fixture = function() {
  var args = Array.prototype.slice.call(arguments);
  args.unshift(FIXTURES_PATH);
  return path.resolve.apply(path, args);
};

// load the whole module for testing.
exports.lib = require('../lib');

exports.loadEach = function() {
  var paths = Array.prototype.slice.call(arguments);

  var processor = 'function' === typeof paths[paths.length-1] ?
    paths.pop() : function(data) { return data; };

  return paths.map(function(path) {
    return processor(fs.readFileSync(exports.fixture(path), 'utf8'));
  });
};

var tmpdir, tmpcnt=0;

/**
 * Returns path to a temporary file. Works just like resolve.
 * 
 * @return {String} path
 */
exports.tmpfile = function() {
  var args = Array.prototype.slice.call(arguments);
  if (!tmpdir) {
    tmpdir = temp.mkdirSync(['test',process.pid,Date.now()].join('-'));
  }

  if (args.length===0) {
    args = [tmpdir, 'tmpfile-'+tmpcnt];
  } else {
    args.unshift(tmpdir);
  }

  return path.resolve.apply(path, args);
};
