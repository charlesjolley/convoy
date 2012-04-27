/**
 * @module pipeline
 * @copyright 2012 Charles Jolley
 * 
 * Exposes an asset pipeline. Add the generated files you want by passing a
 * config. You should include at a minimum:
 * 
 *     pipeline = new Pipeline(); // also can pass configs here.
 *     pipeline.add("path/to/asset.js", {
 *       type: "javascript", // or "css" to get default configs
 *       main: "my_package/app/main", // main modules to build from
 *       
 *       // additional optional configs
 *
 *       minify: true,    // to minify
 *       autocache: true, // automatically watches dependent files and rebuilds 
 *       
 *       // plugins - all optional if the type is 'javascript', 'css' or 'less'

 *       // compilers & preprocessors can be overidden by packages
 *       // invoked per source file
 *       compilers: {
 *         ".js": SomeJavaScriptPlugin,
 *         ".coffee": SomeCoffeeScriptPlugin
 *       },
 *       preprocessors:  [SomePreprocessor],
 *       
 *       // invoke per source file, extracts dependencies and other info
 *       analyzer:       SomeAnalyzerPlugin,
 *       
 *       // generates merged asset. postprocessors run on merged assed before
 *       // minification
 *       linker:         SomeLinkerPlugin,
 *       postprocessors: [SomePostprocessor],
 *       
 *       // minifies if `minifiy` is true
 *       minifier:       SomeMinifierPlugin,
 *       
 *       // run on merged asset after minification (if any). useful to add
 *       // copyrights
 *       finalizers:     [SomeFinalizerPlugins]
 *       
 *     });
 *     
 *  Once you have added the asset to the pipeline, you can either use the 
 *  middleware in a connect app:
 *  
 *    connect()
 *      .use(pipeline.middleware())
 *      .start(3000);
 *      
 *  Or you can build the asset out of the pipeline:
 *  
 *    pipeline.writeFile("path/to/asset.js", "basedir", function(err) {
 *      // called when done
 *    });
 *    
 */

var LoggedEventEmitter = require('./logged_events').LoggedEventEmitter;
var UTILS = require('./utils');
var PATH  = require('path');
var ASYNC = require('async');
var FS    = require('fs');
var UTIL  = require('util');

var AssetPackager = require('./asset_packager').AssetPackager;
var plugins      = require('../pipeline_plugins');

// wraps done so that it will emit an error
function _error(pipeline, done) {
  return function(err) {
    if (err) pipeline.emit('error', err);
    if (done) done.apply(this, arguments);
  };
}


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
            FS.mkdir(path, done);
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
    if (!err) logger.info('copied', src, dst);
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

function Pipeline() {
  LoggedEventEmitter.call(this);
  this.packagers = {};
  this.copiers   = {};
  this.invalidate = this.invalidate.bind(); // so we can use as a listener
  this._config(arguments);
}

Pipeline.prototype = Object.create(LoggedEventEmitter.prototype);

var DEFAULT_CONFIGS = {
  javascript: {

    compilers: {
      '.js': plugins.GenericCompiler,
      '.coffee': plugins.CoffeeScriptCompiler
    },

    analyzer: plugins.CommonJSAnalyzer,
    linker:   plugins.CommonJSLinker,
    minifier: plugins.UglifyMinifier
  },

  css: {
    compilers: {
      '.css': plugins.GenericCompiler
    },

    analyzer: plugins.GenericAnalyzer,
    linker:   plugins.SimpleMergeLinker,
    minifier: null // none yet defined for CSS
  },

  // for JS that doesn't know how to CommonJS
  legacy_javascript: {
    compilers: {
      '.js': plugins.GenericCompiler,
      '.coffee': plugins.CoffeeScriptCompiler
    },

    analyzer: plugins.GenericAnalyzer,
    linker:   plugins.SimpleMergeLinker,
    minifier: plugins.UglifyMinifier
  }
};

var CONFIG_KEYS = ['watch'];

Pipeline.prototype._config = function(configs) {
  var idx, len, config, path;
  for(idx=0, len=configs.length; idx<len; idx++) {
    config = configs[idx];
    for(path in config) {
      if (CONFIG_KEYS.indexOf(path)>=0) {
        this[path] = config[path];
      } else {
        if (!config.hasOwnProperty(path)) continue;
        this.add(path, config[path]);
      }
    }
  }
  return this;
};

/**
 * If set to true then pipeline will automatically watch all assets and 
 * invalidate whenever they change. This will keep it's cache clean when used
 * in a server. You can also listen for the `invalidate` event and 
 * trigger a rebuild if you are using as a build tool.
 * 
 * @type {Boolean}
 */
Pipeline.prototype.watch = false;

/**
 * Adds a new generated asset at the named path. Setup with the passed config.
 * See the module header for more information on what options can be passed.
 * 
 * @param {String} path   relative path into pipeline
 * @param {Hash}   config config for asset.
 * @return {void}
 */
Pipeline.prototype.add = function(path, config) {
  var ret, locals;

  if (config.type === 'copy') {
    this.copiers[path] = config;
  } else {
    if (this.packagers[path]) this.remove(path);
    locals = { watch: this.watch };
    ret = new AssetPackager(DEFAULT_CONFIGS[config.type] || {}, locals, config);
    this.pipeLogging(ret, path);
    ret.on('invalidate', this.invalidate);
    this.packagers[path] = ret;
  }
  
  return ret;
};

/**
 * Removes any asset associated with the named relative path.
 * 
 * @param  {String} path path into pipeline
 * @return {void}      
 */
Pipeline.prototype.remove = function(path) {
  var packager = this.packagers[path];
  if (packager) {
    packager.removeListener('invalidate', this.invalidate);
  }
  delete this.packagers[path];
};

function _copyFile(pipeline, path, buildir, done) {
  var copiers = pipeline.copiers,
      copyPath, working, dst, src, config;

  for(working in copiers) {
    if (copiers.hasOwnProperty(working) && path.indexOf(working) === 0) {
      if (!copyPath || working.length>copyPath.length) copyPath = working;
    }
  }

  if (copyPath) {
    config = copiers[copyPath];
    dst = PATH.resolve(buildir, path);
    src = PATH.resolve(config.root, PATH.relative(copyPath, path));
    mkdir_p(PATH.dirname(dst), function(err) {
      if (err) return done(err);
      cp_r(src, dst, pipeline, done);
    });

  } else {
    done(new Error('asset not found for ' + path));
  }
}

function _writeFile(pipeline, path, buildir, done) {
  var packager = pipeline.packagers[path];
  if (!packager) {
    _copyFile(pipeline, path, buildir, done);

  } else {
    path = PATH.resolve(buildir, path);
    packager.writeFile(path, done);
  }
}

/**
 * Writes a single asset to the build directory. Invokes callback when done.
 * 
 * @param  {String}   path    Path to write, must match an added asset.
 * @param  {String}   buildir Base directory to build to.
 * @param  {Function} done    Called when done with possible error.
 * @return {void}           
 */
Pipeline.prototype.writeFile = function(path, buildir, done) {
  _writeFile(this, path, buildir, _error(this, done));
};

/**
 * Writes all defined assets to the named build directory. Invokes the callback
 * when done.
 * 
 * @param  {String}   buildir Directory to build to
 * @param  {Function} done    Called when done with possible error
 * @return {void}           
 */
Pipeline.prototype.writeAll = function(buildir, done) {
  var self = this;
  var paths = Object.keys(this.packagers).concat(Object.keys(this.copiers));
  ASYNC.forEach(paths, function(path, next) {
    _writeFile(self, path, buildir, next);
  }, _error(this, done));
};

Pipeline.prototype.invalidate = function() {
  var key;

  if (!this._invalidating) {
    this._invalidating = true;
    for(key in packagers) {
      if (packagers.hasOwnProperty(key)) packagers[key].invalidate();
    }
    this._invalidating = false; 
    this.emit('invalidate');
  }
};

Pipeline.prototype.middleware = function(root) {
  return function(req, res, next) {
    // TODO: implement
  };
};

exports.Pipeline = Pipeline;


