/**
 * Utility methods
 * @copyright 2012 Charles Jolley
 */

var PATH  = require('path');
var FS    = require('fs');
var ASYNC = require('async');
var UTIL  = require('util');

/**
 * Runs the passed function once, caching the return value for future calls.
 * 
 * @param  {Function} fn function to run
 * @return {Function}     wrapped function
 */
exports.once = function(fn) {
  var pending = [], args, running;
  return function(done) {
    if (args) return done.apply(this, args);
    pending.push(done);
    if (!running) {
      running = true;
      fn(function() {
        args = Array.prototype.slice.call(arguments);
        if (!pending) {
          throw new Error('fn callback invoked more than once');
        }
        pending.forEach(function(done) { done.apply(this, args); });
        pending = null;
      });
    }
  };
};

function _extend(dst, src) {
  Object.keys(src).forEach(function(key) { dst[key] = src[key]; });
  return dst;
}

exports.extend = _extend;

exports.merge = function(ret) {

  function _merge(props) { _extend(ret, props); }

  var len = arguments.length, idx, props;
  for(idx=1;idx<len;idx++) {
    props = arguments[idx];
    if (props instanceof Array) {
      props.forEach(_merge);
    } else {
      _extend(ret, props);
    }
  }

  return ret;
};

exports.values = function(obj) {
  return Object.keys(obj).map(function(key) { return obj[key]; });
};


// wraps done so that it will emit an error
exports.makeError = function(pipeline, done) {
  return function(err) {
    if (err) pipeline.emit('error', err);
    if (done) done.apply(this, arguments);
  };
};

//...................................
// FILE UTILITIES
// 

PATH.sep = PATH.sep || (process.platform == 'win32' ? '\\' : '/');

var making = {};

function _mkdir_p(path, done) {

  PATH.exists(path, function(exists) {
    if (exists) {
      FS.stat(path, function(err, stat) {
        if (!err && !stat.isDirectory()) {
          err = new Error(path + ' is not a directory');
        }
        done(err);
      });
    } else {
      // sometimes multiple actions might try to make the same directory,
      // this prevents them from both trying to mkdir at the same time.
      if (!making[path]) {
        making[path] = ASYNC.memoize(function(done) {
          _mkdir_p(PATH.dirname(path), function(err) {
            if (err) return done(err);
            FS.mkdir(path, function(err) {
              // sometimes another routine gets around to making this first
              if (err && err.code === 'EEXIST') err = null;
              done(err);
            });
            delete making[path];
          });
        });
      }
      making[path](done);
    }
  });
}

function mkdir_p(path, done) {
  _mkdir_p(PATH.normalize(path), done);
}

function cp(src, dst, logger, done) {
  var is = FS.createReadStream(src);
  var os = FS.createWriteStream(dst);
  UTIL.pump(is, os, function(err) {
    if (!err && logger) logger.info('copied', src, '->', dst);
    done(err);
  });
}

function cp_r(src, dst, logger, done) {
  FS.stat(src, function(err, stat) {
    if (stat.isDirectory()) {
      mkdir_p(dst, function(err) {
        if (err) return done(err);
        FS.readdir(src, function(err, files) {
          ASYNC.forEach(files, function(file, next) {
              cp_r(PATH.join(src, file), PATH.join(dst, file), logger, next);
          }, done);
        });
      });
    } else {
      cp(src, dst, logger, done);
    }
  });
}


exports.mkdir_p = mkdir_p;
exports.cp = cp;
exports.cp_r = cp_r;

