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

var EventEmitter = require('events').EventEmitter;
var UTILS = require('./utils');
var PATH  = require('path');
var ASYNC = require('async');
var FS    = require('fs');
var UTIL  = require('util');

var AssetPackager = require('./asset_packager').AssetPackager;
var plugins      = require('../pipeline_plugins');

function _error(pipeline, done, err) {
  pipeline.emit('error', err);
  done(err);
}


//...................................
// FILE UTILITIES
// 

PATH.sep = PATH.sep || (process.platform == 'win32' ? '\\' : '/');


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
      FS.mkdir(path, done);
    }
  });
}

function mkdir_p(path, done) {
  _mkdir_p(PATH.normalize(path), done);
}

function cp(src, dst, done) {
  var is = FS.createReadStream(src);
  var os = FS.createWriteStream(dst);
  UTIL.pump(is, os, done);
}

function cp_r(src, dst, done) {
  FS.stat(src, function(err, stat) {
    if (stat.isDirectory()) {
      mkdir_p(dst, function(err) {
        FS.readdir(src, function(err, files) {
          ASYNC.forEach(files, function(file, next) {
              cp_r(PATH.join(src, file), PATH.join(dst, file), next);
          }, done);
        });
      });
    } else {
      mkdir_p(PATH.dirname(dst), function(err) {
        if (err) return done(err);
        cp(src, dst, done);
      });
    }
  });
}

function _copyPath(path, buildir, copyPath, config, done) {
  var dst = PATH.resolve(buildir, path);
  var src = PATH.resolve(config.root, PATH.relative(copyPath, path));
  cp_r(src, dst, done);
}

function Pipeline() {
  EventEmitter.call(this);
  this.packagers = {};
  this.copiers   = {};
  this._config(arguments);
}

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

Pipeline.prototype = Object.create(EventEmitter.prototype);

Pipeline.prototype._config = function(configs) {
  var idx, len, config, path;
  for(idx=0, len=configs.length; idx<len; idx++) {
    config = configs[idx];
    for(path in config) {
      if (!config.hasOwnProperty(path)) continue;
      this.add(path, config[path]);
    }
  }
};

/**
 * Adds a new generated asset at the named path. Setup with the passed config.
 * See the module header for more information on what options can be passed.
 * 
 * @param {String} path   relative path into pipeline
 * @param {Hash}   config config for asset.
 * @return {void}
 */
Pipeline.prototype.add = function(path, config) {
  var ret;

  if (config.type === 'copy') {
    this.copiers[path] = config;
  } else {
    if (this.packagers[path]) this.remove(path);
    ret = new AssetPackager(DEFAULT_CONFIGS[config.type] || {}, config);
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
  delete this.packagers[path];
};

/**
 * Writes a single asset to the build directory. Invokes callback when done.
 * 
 * @param  {String}   path    Path to write, must match an added asset.
 * @param  {String}   buildir Base directory to build to.
 * @param  {Function} done    Called when done with possible error.
 * @return {void}           
 */
Pipeline.prototype.writeFile = function(path, buildir, done) {
  var packager = this.packagers[path], copiers, copyPath;

  if (!packager) {
    copiers = this.copiers;
    for(copyPath in copiers) {
      if (!copiers.hasOwnProperty(copyPath) || path.indexOf(copyPath)!==0) {
        continue;
      }
      return _copyPath(path, buildir, copyPath, copiers[copyPath], done);
    }

    return _error(this, done, new Error('asset not found for ' + path));
  }

  path = PATH.resolve(buildir, path);
  packager.writeFile(path, done);
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
  ASYNC.forEach(Object.keys(this.packagers), function(path, next) {
    self.writeFile(path, buildir, next);
  }, done);
};

Pipeline.prototype.middleware = function(root) {
  return function(req, res, next) {
    // TODO: implement
  };
};

exports.Pipeline = Pipeline;


