/**
 * @module copier
 * @copyright 2012 Charles Jolley
 * 
 * Supported options:
 * 
 *   * `root` - the root directory for copying
 *   * `include` - optional array of globbing matcher strings to include
 *   * `exclude` - optional array of globbing matcher strings to exclude
 *   
 * Copier will copy all assets within root unless `include` is defined in 
 * which case it will only copy assets matching `include` within `root`. If 
 * `exclude` is defined, any matching assets will be exluded from final set.
 */

var LoggedEventEmitter = require('./logged_events').LoggedEventEmitter;
var UTILS = require('./utils');
var PATH  = require('path');
var FS    = require('fs');
var ASYNC = require('async');
var glob  = require('glob');
var MIME  = require('mime');

// var glob  = require('glob');
// var minimatch = require('minimatch');

var _extend = UTILS.extend;
var _error  = UTILS.makeError;

//.....................................
// ASSET COPIER
// 

function AssetCopier() {
  LoggedEventEmitter.call(this);
  for(var idx=0, len=arguments.length;idx<len;idx++) {
    _extend(this, arguments[idx]);
  }

  if (!this.root) {
    throw new Error('copier requires root');
  }

  if (!this.path) {
    throw new Error('copier requires path');
  }

  this.root = PATH.resolve(this.root);
  this.invalidate = this.invalidate.bind(this);
}

AssetCopier.prototype = Object.create(LoggedEventEmitter.prototype);

function _resolve(copier, path) {
  path = PATH.relative(copier.path, path);
  if (~path.indexOf('..')) return null;
  return PATH.resolve(copier.root, path);
}

function _exists(copier, path, allowDirectory, done) {
  path = _resolve(copier, path);
  if (!path || path.indexOf(copier.root)!==0) return done(false);
  PATH.exists(path, function(exists) {
    if (!exists || allowDirectory) return done(exists);
    FS.stat(path, function(err, stats) {
      done(!err && !stats.isDirectory());
    });
  });
}

function _makeWatcher(root, callback) {

  var watcher = null;
  var children = null;
  var ret = null;

  function handleError(err) {
    if (err) throw err;
  }

  function fileChanged() {
    teardown();
    setup(function(err) {
      if (err) return handleError(err);
      callback(root);
    });
  }

  function childChanged(path) {
    callback(path);
  }

  function setup(next) {
    watcher = FS.watch(root, { persistent: true }, fileChanged);
    FS.stat(root, function(err, stats) {
      if (err) return next(err);
      if (stats.isDirectory()) {
        children = [];
        FS.readdir(root, function(err, files) {
          if (err) return next(err);
          files.forEach(function(path) {
            path = PATH.resolve(root, path);
            children.push(_makeWatcher(path, childChanged));
          });
          next();
        });
      } else {
        next();
      }
    });
  }

  function teardown() {
    if (watcher) watcher.close();
    watcher = null;
    
    if (children) {
      children.forEach(function(watcher) {
        watcher.close();
      });
    }
    children = null;
  }

  ret = {
    path: root,
    close:  teardown
  };

  setup(handleError);
  return ret;
}

function _watch(copier, done) {
  if (copier.watch & !copier._watcher) {
    copier._watcher = _makeWatcher(copier.root, function(path) {
      copier.info('changed', path);
      copier.invalidate();
    });
  }

  done();
}

/**
 * Returns true if the packager can generate the named path. For AssetCopier
 * this just patches against the path.
 * 
 * @param  {String} path search path
 * @return {void}
 */
AssetCopier.prototype.exists = function(path, done) {
  _exists(this, path, false, done);
};

/**
 * Returns an array of relative paths this asset can generate. The default
 * implementation can only generate one path.
 * 
 * @param  {Function} done invoked on complete
 * @return {void}        
 */
AssetCopier.prototype.findPaths = function(done) {
  var self = this;
  done = _error(this, done);
  FS.stat(self.root, function(err, stats) {
    if (err) return done(err);
    if (!stats.isDirectory()) return done(null, [self.path]);

    glob(PATH.resolve(self.root, '**/*'), function(err, files) {
      if (err) return done(err);
      var output = [];
      ASYNC.forEach(files, function(path, next) {
        FS.stat(path, function(err, stats) {
          path = PATH.join(self.path, PATH.relative(self.root, path));
          if(!err && !stats.isDirectory()) output.push(path);
          next();
        });
      }, function(err) {
        _watch(self, function() {
          done(err, output);
        });
      });
    });
  });
};

/**
 * Invokes done with an asset object describing the fully constructed asset.
 * The `body` property will contain the body text.
 * 
 * @param  {Function} done Invoked when build is complete.
 * @return {void}
 */
AssetCopier.prototype.build = function(srcPath, done) {
  done = _error(this, done);
  var realPath = _resolve(this, srcPath);
  var self = this;
  PATH.exists(realPath, function(exists) {
    if (!exists) return done(new Error(srcPath + ' not found'));
    FS.stat(realPath, function(err, stats) {
      if (!err && stats.isDirectory()) {
        err = new Error(srcPath + ' is a directory');
      }
      _watch(self, function() {
        done(err, err ? null : {
          path: srcPath,
          type: MIME.lookup(realPath, 'application/binary'),
          mtime: stats.mtime ? stats.mtime.getTime() : 0,
          size:  stats.size,
          bodyPath: realPath
        });
      });
    });
  });
};

/**
 * Invalidates any caches so that the next call to the packager will rebuild
 * from scratch.
 * 
 * @return {void}
 */
AssetCopier.prototype.invalidate = function() {
  this.emit('invalidate');
  this.unwatch();
};

/**
 * Used mostly for testing. Removes any watches.
 * @return {void} 
 */
AssetCopier.prototype.unwatch = function() {
  if (this._watcher) {
    if (this._watcher.end) this._watcher.end();
    else this._watcher.close();
    this._watcher = null;
  }
  this._watcher = null;
};


exports.AssetCopier = AssetCopier;
