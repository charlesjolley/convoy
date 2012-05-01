/**
 * @module helpers
 * @copyright 2012 Charles Jolley
 */

var path = require('path');
var fs   = require('fs');
var temp = require('temp');
var UGLIFY = require('uglify-js');

var DIRNAME       = path.dirname(module.filename);
var FIXTURES_PATH = path.resolve(DIRNAME, '..', '..', 'fixtures');

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
exports.lib = require('../../lib');

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

/**
 * Ensures the passed directories exist, creating them if needed
 */
exports.mkdirSync_p = function(p) {
  if (path.existsSync(p)) {
    if (!fs.statSync(p).isDirectory()) {
      throw new Error(p + ' is not a directory');
    }
  } else {
    this.mkdirSync_p(path.dirname(p));
    fs.mkdirSync(p);
  }
};

exports.uglify = function(text, options) {
  if (!options) options = {};
  var pro = UGLIFY.uglify;
  var ast = UGLIFY.parser.parse(text);

  ast = pro.ast_mangle(ast, options);
  ast = pro.ast_squeeze(ast, options);
  return pro.gen_code(ast, options);
};

// listens to an event emitter that puts out warn, info, and error events.
exports.captureLog = function(eventEmitter) {
  var ret = {
    warnings: [],
    info:     [],
    errors:   []
  };

  eventEmitter.on('warn',  function(line) { ret.warnings.push(line); });
  eventEmitter.on('error', function(line) { ret.errors.push(line); });
  eventEmitter.on('info',  function(line) { ret.info.push(line); });

  return ret;
};


