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

var PATH  = require('path');
var ASYNC = require('async');
var FS    = require('fs');
var UTIL  = require('util');

var AssetPackager = require('./asset_packager').AssetPackager;
var LoggedEventEmitter = require('./logged_events').LoggedEventEmitter;
var UTILS   = require('./utils');
var packagers = require('./packagers');
var middleware = require('./middleware').middleware;

var _extend = UTILS.extend;
var _values = UTILS.values;
var _error  = UTILS.makeError;

function Pipeline() {
  LoggedEventEmitter.call(this);
  this.packagers = {};
  this.invalidate = this.invalidate.bind(this); // so we can use as a listener
  this._config(arguments);
}

Pipeline.prototype = Object.create(LoggedEventEmitter.prototype);

var CONFIG_KEYS = ['watch', 'paths'];

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
 * Returns a new middleware instance for use in a connect stack. You can
 * pass the same options to this method as you would pass to the connect
 * `static()` middleware.
 * 
 * @param {Hash} options  Optional hash of options
 * @return {Function} connect handler
 */
Pipeline.prototype.middleware = middleware;

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
  var ret, Packager;

  if (this.packagers[path]) this.remove(path);

  Packager = config.packager;
  if ('string' === typeof Packager) {
    Packager = packagers[Packager];
    if (!Packager) {
      throw new Error('Unknown packager ' + config.packager);
    }
  } else if (!Packager) {
    throw new Error('Must define a packager for '+path);
  }

  config = _extend({
    watch:    this.watch,
    pipeline: this,
    path:     path
  }, config);

  ret = new Packager(config);
  this.pipeLogging(ret, path);

  var invalidate = this.invalidate, self = this;
  ret.on('invalidate', function() {
    invalidate.apply(self, arguments);
  });

  this.packagers[path] = ret;
  this.invalidate();
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
    delete this.packagers[path];
    this.invalidate();
  }
};

function _selectPackager(pipeline, path, done) {
  ASYNC.filter(_values(pipeline.packagers), function(packager, next) {
    packager.exists(path, next);
  }, function(packagers) {
    done(packagers[0]);
  });
}

// builds a map of path -> packager
function _mapPaths(pipeline, done) {
  ASYNC.reduce(_values(pipeline.packagers), {}, function(memo, packager, next){
    packager.findPaths(function(err, paths) {
      if (err) return next(err);
      paths.forEach(function(path) { 
        if (!memo[path]) memo[path] = packager;
      });
      next(null, memo);
    });
  }, done);
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
  var self = this;
  done = _error(this, done);
  _selectPackager(this, path, function(packager) {
    if (!packager) return done(new Error('path not found '+path));
    packager.build(path, function(err, asset) {
      if (err) return done(err);
      var dstPath = PATH.resolve(buildir, path);
      UTILS.mkdir_p(PATH.dirname(dstPath), function(err) {
        if (err) return done(err);
        if (asset.bodyPath) {
          UTILS.cp_r(asset.bodyPath, dstPath, self, done);
        } else if (asset.body) {
          var encoding = asset.encoding || 'utf8';
          FS.writeFile(dstPath, asset.body, encoding, function(err) {
            if (!err) self.info('wrote', dstPath);
            done(err);
          });
        } else {
          return done(new Error(path+' asset does not contain body'));
        }
      });

    });
  });
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
  self.findPaths(function(err, paths) {
    if (err) return done(err);
    ASYNC.forEach(paths, function(path, next) {
      self.writeFile(path, buildir, next);
    }, done);
  });
};

/**
 * Builds a single asset. The callback will be invoked with an asset object.
 * The asset contains either a `body` property or a `bodyPath` that can 
 * be used to return the asset contents.
 * 
 * @param  {String}   path Path within pipeline
 * @param  {Function} done Calling to invoke when asset is ready.
 * @return {void}
 */
Pipeline.prototype.build = function(path, done) {
  done = _error(this, done);
  this._canInvalidate = true;
  _selectPackager(this, path, function(packager) {
    if (!packager) {
      done(new Error('path not found '+path));
    } else {
      packager.build(path, done);
    }
  });
};

/**
 * Invokes the done callback with `true` if the pipeline knows how to handle
 * the path. You will often use this when implementing middleware in a server.
 * 
 * @param  {String}   path     path to evaluate
 * @param  {Function} callback Invoked in response.
 * @return {void}            
 */
Pipeline.prototype.exists = function(path, callback) {
  _selectPackager(this, path, function(packager) {
    callback(!!packager);
  });
};

/**
 * Discovers all the valid paths handled by this pipeline and returns them in
 * the done callback. This can involve crawling the disk for asset 
 * directories.
 *  
 * @param  {Function} done Callback
 * @return {void}        
 */
Pipeline.prototype.findPaths = function(done) {
  this._canInvalidate = true;
  _mapPaths(this, function(err, packagers) {
    done(err, !err && packagers ? Object.keys(packagers) : null);
  });
};

Pipeline.prototype.invalidate = function() {
  if (this._canInvalidate) {
    this._canInvalidate = false;
    this.emit('invalidate');
  }
};

exports.Pipeline = Pipeline;


