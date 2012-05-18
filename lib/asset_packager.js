/**
 * @module asset_packager
 * @copyright 2012 Charles Jolley
 * 
 * Generates a single asset from one or more source assets. Needs to be 
 * configured with:
 * 
 *    {
 *      // compilers for various languages. Should yield a single language
 *      // (javascript or CSS)
 *      compilers: {
 *        'js': GenericCompiler,
 *        'coffee': CoffeeScriptCompiler
 *      },
 *      
 *      // inspects compiled asset to find additional dependencies, etc.
 *      analyizer: GenericAnalyzer,
 *      
 *      // combines assets to merge them into a single asset.
 *      linker: CommonJSModuleLinker,
 *
 *      // minifies the merged asset.
 *      minifier: UglifyMinifier,
 *      
 *      // postprocesses the asset. usually adds a copyright statement
 *      postprocessors: [HeaderPostprocessor],
 *      
 *      // used to resolve paths.
 *      basedir: '.'
 *    }
 *    
 * The default implementation provided by this module can build a minified
 * combined JavaScript file using similar require rules provided by Sprockets
 * in Rails. You probably don't want to do this. Instead you want to use the
 * module-aware version in module_packager.
 * 
 */

var LoggedEventEmitter = require('./logged_events').LoggedEventEmitter;
var PATH    = require('path');
var FS      = require('fs');
var ASYNC   = require('async');
var RESOLVE = require('./resolver');
var UTILS   = require('./utils');

var _extend = UTILS.extend;
var _error  = UTILS.makeError;

function _reset(asset) {
  asset._sourceAssets = {};
  asset._build = null;
  asset._sourcePackages = {};
  asset._watching = {};
}

//...............................
// PACKAGED ASSET
//

function AssetPackager(config) {
  LoggedEventEmitter.call(this);
  for(var idx=0, len=arguments.length;idx<len;idx++) {
    _extend(this, arguments[idx]);
  }
  this.basedir = PATH.resolve(this.basedir);
  this.invalidate = this.invalidate.bind(this);
  if (!this.path) throw new Error('AssetPackager requires a path');
  _reset(this);
}

AssetPackager.prototype = Object.create(LoggedEventEmitter.prototype);

// default properties
_extend(AssetPackager.prototype, {
  basedir: '.',
  preprocessors:  {},
  postprocessors: [],
  finalizers:     [],
  minify:         false,

  // these must be defined by a config
  compilers: {},
  analyzer:  null,
  linker:    null,
  minifier:  null
});

AssetPackager.prototype.watchPath = function(assetPath) {
  var self = this;
  if (self.watch && !self._watching[assetPath]) {
    self._watching[assetPath] = 
      FS.watch(assetPath, { persistent: true }, function() {
        self.info('changed', assetPath);
        self.invalidate();
      });
  }
};

/**
 * Returns the asset descriptor for a given source asset. `done()` will be 
 * called with the asset instance. The asset should contain the compiled body
 * as well as any additional information extracted from the analyzer.
 * 
 * @param  {String}   assetPath Path to the asset. Will be resolved
 * @param  {Function} done [description]
 * @return {[type]}        [description]
 */
AssetPackager.prototype.getSourceAsset = function(assetPath, done) {
  if (!done) done = function() {};
  assetPath = PATH.resolve(this.basedir, assetPath);
  if (!this._sourceAssets[assetPath]) {
    var self = this;
    this._sourceAssets[assetPath] = UTILS.once(function(done) {
      var compiler = self.compilers[PATH.extname(assetPath)],
          preprocessors = self.preprocessors[PATH.extname(assetPath)] || [],
          analyzer = self.analyzer,
          err;

      if (!compiler) {
        err = new Error('No compiler for '+assetPath);
      } else if (!analyzer) {
        err = new Error('No analyzer for '+self.path);
      } 
      if (err) return done(err);

      var asset = {
        path: assetPath,
        id:   self.unresolve(assetPath),
        dependencies: [],
        parents: [], // assets requiring this asset.
        children: [] // assets required by this asset
      };

      ASYNC.series([
        function(next) {
          FS.stat(assetPath, function(err, stats) {
            if (err) return next(err);
            asset.mtime = stats.mtime.getTime();
            next();
          });
        }, function(next) {
          compiler(asset, self, next);

        }, function(next) {
          ASYNC.forEachSeries(preprocessors, function(preprocessor, next) {
            preprocessor(asset, self, next);
          }, next);

        }, function(next) {
          analyzer(asset, self, next);
        }
      ], function(err) {
        if (err) return done(err);
        if (!err) self.watchPath(assetPath);
        return done(err, asset);
      });
    });
  }

  this._sourceAssets[assetPath](done);
};


function _isFile(file) {
  return PATH.existsSync(file) && FS.statSync(file).isFile();
}

function _findNearestPackage(path) {
  var pkgPath = PATH.resolve(path, 'package.json');
  while(path && path !== '/' && (_isFile(path) || !_isFile(pkgPath))) {
    path = PATH.dirname(path);
    pkgPath = PATH.resolve(path, 'package.json');
  }
  if (_isFile(path) || !_isFile(pkgPath)) return null; // not found
  return path;
}

function _getNearestPackageInfo(path) {
  path = _findNearestPackage(path);
  if (!path) return null;
  var pkgPath = PATH.resolve(path, 'package.json');
  var body = FS.readFileSync(pkgPath, 'utf8');
  var pkg  = JSON.parse(body);
  pkg.path = path;
  return pkg;
}

/**
 * Returns true if the packager can generate the named path. For AssetPackager
 * this just patches against the path.
 * 
 * @param  {String} path search path
 * @return {void}
 */
AssetPackager.prototype.exists = function(path, done) {
  done(path === this.path);
};

/**
 * Returns an array of relative paths this asset can generate. The default
 * implementation can only generate one path.
 * 
 * @param  {Function} done invoked on complete
 * @return {void}        
 */
AssetPackager.prototype.findPaths = function(done) {
  return done(null, [this.path]);
};

/**
 * Attempts to map a moduleId to a physical path, relative to the named 
 * rootPath. This will respect the installed compiler extensions.
 * 
 * @param  {String} moduleId module ID to resolve
 * @param  {String} rootPath Optional. Root path to begin from.
 * @return {String}          Resolved path or null if illegal.
 */
AssetPackager.prototype.resolve = function(moduleId, basedir, opts) {

  if (!opts) opts = {};
  if (this.pipeline && this.pipeline.paths) {
    opts.paths = this.pipeline.paths.concat(opts.paths || []); 
  }

  return RESOLVE.sync(moduleId, UTILS.merge({
    extensions: Object.keys(this.compilers),
    basedir:    basedir || this.basedir,
    isFile:     _isFile,
    mainKey:    this.mainKey
  }, opts));
};

/**
 * Attempts to reverse a normalized moduleId for the passed path, relative to
 * the named basedir. Yields a normalized module Id for later referencing.
 * 
 * @param  {String} path     path to file
 * @param  {String} basedir  Optional basedir
 * @return {String}          module Id
 */
AssetPackager.prototype.unresolve = function(path, basedir) {
  path = PATH.resolve(basedir || this.basedir, path);
  var pkg = this.getNearestPackage(path);
  if (!pkg) return path; 

  // remove the extension
  path = PATH.join(PATH.dirname(path), PATH.basename(path, PATH.extname(path)));
  path = PATH.join(PATH.basename(pkg.path), PATH.relative(pkg.path, path));
  return path;
};

/**
 * Returns the nearest package info if found. This will also make the asset
 * depend on this package config.
 * 
 * @param  {String} path Path to begin search.
 * @return {Hash}        Package descriptor
 */
AssetPackager.prototype.getNearestPackage = function(path) {
  path = _findNearestPackage(path);
  if (!path) return null;
  if (!this._sourcePackages[path]) {
    this._sourcePackages[path] = _getNearestPackageInfo(path);
  }
  return this._sourcePackages[path];
};

// walks dependency tree. returns ordered array of assets.
function _expandDependencies(context, seen, expanded, deps, done) {
  ASYNC.forEachSeries(deps, function(asset, next) {
    if (seen.indexOf(asset)>=0) return next();
    seen.push(asset);
    if (asset.dependencies.length === 0) {
      expanded.push(asset);
      return next();
    }

    ASYNC.mapSeries(asset.dependencies, function(path, next) {
      context.getSourceAsset(path, function(err, sourceAsset) {
        if (!sourceAsset) {
          err = new Error(''+path+' not found (required in '+asset.path+')');
        }
        next(err, sourceAsset);
      });
    }, function(err, assets) {

      if (err) return next(err);

      asset.children = assets; 
      assets.forEach(function(childAsset) {
        childAsset.parents.push(asset);
      });

      _expandDependencies(context, seen, expanded, assets, function(err) {
        expanded.push(asset);
        next(err);
      });
    });

  }, function(err) {
    done(err, expanded);    
  });
}

/**
 * Accepts an array of assets and returns a fully expanded array of assets that
 * includes all direct and indirect dependencies of the assets.
 * 
 * The callback will be invoked when completed with a possible error and the
 * array of assets.
 * 
 * @param  {Array}   assets  Array of asset descriptors
 * @param  {Function} done   Invoked when complete.
 * @return {void}          
 */
AssetPackager.prototype.expand = function(assets, done) {
  var self = this;
  done = _error(this, done);
  _expandDependencies(this, [], [], assets, function(err, expanded) {
    if (err) return done(err);

    var seen = {}, output = [], hasConflicts = false, warned = [];

    expanded.forEach(function(asset) {
      var conflicts = asset.id && seen[asset.id];
      if (conflicts) {
        // if bodies are the same it's just a duplicate so we can omit it.
        if (asset.body !== conflicts[0].body) {
          conflicts[0].conflicts = conflicts;
          asset.conflicts = conflicts;
          conflicts.push(asset);
          output.push(asset); // still output conflicts. let linker handle it
          hasConflicts = true;
        }
      } else {
        if (asset.id) seen[asset.id] = [asset];
        output.push(asset);
      }
    });

    // warn on conflicts. wait until now so we have a full picture
    // of all conflicts.
    if (hasConflicts) {
      output.forEach(function(asset) {
        if (asset.conflicts && warned.indexOf(asset.conflicts)<0) {
          warned.push(asset.conflicts); // only warn once
          self.warn('conflicting assets: \n  '+ 
            asset.conflicts.map(function(asset) { 
              return asset.path; 
            }).join('\n  '));
        }
      });
    }

    done(null, output);
  });
};

/**
 * Invokes done with an asset object describing the fully constructed asset.
 * The `body` property will contain the body text.
 * 
 * @param  {Function} done Invoked when build is complete.
 * @return {void}
 */
AssetPackager.prototype.build = function(sourcePath, done) {
  done = _error(this, done);
  if (sourcePath !== this.path) {
    return done(new Error('path not found ' + sourcePath));
  }

  if (!this._build) {
    var self = this;
    this._build = UTILS.once(function(done) {
      var main     = self.main,
          linker   = self.linker,
          minifier = self.minifier, 
          postprocessors = self.postprocessors || [],
          finalizers = self.finalizers || [],
          err;

      if (!main) {
        err = new Error('Main module not specified for ' + self.path);
      } else if (!linker) {
        err = new Error('Linker not found for ' + self.path);
      } else if (!minifier && self.minify) {
        err = new Error('Minifier not found for ' + self.path);
      }

      if (err) return done(err);

      // normalize some params
      if ('string' === typeof main) main = [main];
      if (!postprocessors) postprocessors = [];

      ASYNC.waterfall([

        // compile and preprocess each source asset.
        function(next) {
          ASYNC.map(main, function(path, next) {
            path = self.resolve(path, self.basedir); // can be a module
            return self.getSourceAsset(path, next);
          }, next);

        // link assets - generates merged asset
        }, function(assets, next) {
          var asset = {
            path:   self.path,
            assets: assets,
            type:   self.type
          };

          linker(asset, self, function(err) {
            next(err, asset);
          });

        // run postprocessors on merged asset. Useful to do comment cleanup
        }, function(asset, next) {
          ASYNC.forEachSeries(postprocessors, function(postprocessor, next) {
            postprocessor(asset, self, next);
          }, function(err) {
            next(err, asset);
          });

        // minify if feature activated
        }, function(asset, next) {
          if (self.minify) {
            minifier(asset, self, function(err) {
              next(err, asset);
            });
          } else {
            next(null, asset);
          }      

        // finalizers can add copyright statements etc.
        }, function(asset, next) {
          ASYNC.forEachSeries(finalizers, function(finalizer, next) {
            finalizer(asset, self, next);
          }, function(err) {
            next(err, asset);
          });
        }
      ], function(err, asset) {
        if (!err) self.info('built', self.main);
        done(err, asset);
      });
    });
  }

  this._build(done);
};

/**
 * Cleans up any watchers. Normally just for testing.
 * @return {void}
 */
AssetPackager.prototype.unwatch = function() {
  // stop watching to restart later...
  var self = this;
  Object.keys(self._watching).forEach(function(path) {
    self._watching[path].close();
  });
};

/**
 * Invalidates any caches so that the next call to the packager will rebuild
 * from scratch.
 * 
 * @return {void}
 */
AssetPackager.prototype.invalidate = function(event, filename) {
  this.emit('invalidate');
  this.unwatch();
  _reset(this);
};

exports.AssetPackager      = AssetPackager; // for testing only
