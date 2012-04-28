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

  root = PATH.resolve(this.root);
}

AssetCopier.prototype = Object.create(LoggedEventEmitter.prototype);

function _resolve(pipeline, path) {
  path = PATH.relative(pipeline.path, path);
  if (path.charAt(0) === '.') return null; // invalid
  return PATH.resolve(pipeline.root, path);
}

function _exists(pipeline, path, allowDirectory, done) {
  path = _resolve(pipeline, path);
  if (!path || path.indexOf(pipeline.root)!==0) return done(false);
  PATH.exists(path, function(exists) {
    if (!exists || allowDirectory) return done(exists);
    FS.stat(path, function(err, stats) {
      done(!err && !stats.isDirectory());
    });
  });
}

/**
 * Returns true if the packager can generate the named path. For AssetCopier
 * this just patches against the path.
 * 
 * @param  {String} path search path
 * @return {void}
 */
AssetCopier.prototype.exists = function(path, done) {
  _exists(this, path, true, done);
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
        done(err, output);
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
  PATH.exists(realPath, function(exists) {
    if (!exists) return done(new Error(srcPath + ' not found'));
    FS.stat(realPath, function(err, stats) {
      if (!err && stats.isDirectory()) {
        err = new Error(srcPath + ' is a directory');
      }
      done(err, err ? null : {
        path: srcPath,
        type: MIME.lookup(realPath, 'application/binary'),
        bodyStream: FS.createReadStream(realPath)
      });
    });
  });
};

/**
 * Writes the asset to disk. If no outputPath is passed uses the default path
 * provided.
 * 
 * @param  {String}   dstPath    Output path to write to.
 * @param  {String}   srcPath    The logical path to copy from.
 * @param  {Function} done       Optional. Invoked when complete.
 * @return {void}              
 */
AssetCopier.prototype.writeFile = function(dstPath, srcPath, done) {
  var self = this;
  done = _error(this, done);
  _exists(this, srcPath, true, function(exists) {
    if (!exists) return done(new Error(srcPath + ' is not a file'));

    var realPath = _resolve(self, srcPath);
    UTILS.mkdir_p(PATH.dirname(dstPath), function(err) {
      if (err) return done(err);
      UTILS.cp_r(realPath, dstPath, self, done);
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
  _reset(this);
};

exports.AssetCopier = AssetCopier;
