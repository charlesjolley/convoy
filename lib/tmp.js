
var path = require('path');
var async = require('async');


// environment captures configuration options.
function Context(options) {
  this.preparables = []; // assets that must be prepared before serving.
  this.sourceAssets = {};
}

(function(p) {

  // copies assets found in fromPath to the target path. Also watches the 
  // fromPath. Creates a CopyAsset which is added to the sources array.
  // Preparing a CopyAsset will simply create Asset objects for each found
  // file and add it to the output hash under the appropriate output path.
  p.addCopyAsset = function(fromPath, outputPath) {

  };

  // creates a new generated asset at the named output path with the specified
  // options. this asset becomes part of the sources array. preparing the 
  // asset will cause it to follow the root module.
  p.addGeneratedAsset = function(outputPath, options) {

  };

  // removes the asset from the set of preparables. Resets the context.
  p.removeAsset = function(outputPath, done) {
    var self = this;
    this.reset(function(err) {
      if (err) return done(err);
      self.preparables = self.preparables.filter(function(asset) {
        return asset.path !== outputPath;
      });
    });
  };

  // adds a watcher that will automatically reset the context. The optional
  // persistant flag can be set to false - causing the watcher to be removed
  // automatically when you reset the context. This is used mostly by 
  // the generated and copy assets.
  p.addWatcher = function(path, persistant) {

  };

  // removes a watcher previously set
  p.removeWatcher = function(path) {

  };


  // gets a source asset for the named path. Source assets represent a 
  // physical asset on disk. Never a generated or CopyAsset. Calling this 
  // method more than once with the same path will return the same asset.
  // 
  // This is usually used by GeneratedAssets and CopyAssets. You usually won't
  // call it directly.
  p.getSourceAsset = function(fromPath) {

  };

  // You can use this context to build assets onto disk if you like. You can
  // also set the context as middleware on connect and simply serve it up.

  // returns output paths. must be prepared first.
  p.getOutputPaths = function() {
    return Object.keys(this.output);
  };

  // writes an output asset with the named path to the buildRoot.
  p.writeOutputAsset = function(outputPath, buildRoot, done) {
    // get write stream for the asset - pipe to file.
  };

  // writes out all output assets to the build root.
  p.writeOutputAssets = function(buildRoot, done) {
    var self = this;
    this.prepare(function(err) {
      if (err) return done(err);
      var q = async.queue(function(outputPath, next) {
        self.writeOutputAsset(outputPath, buildRoot, next);
      }, 10);
      q.drain = done;
      q.push(self.getOutputPaths());
    });
  };

  // ensures all the preparable sources are prepared. once this is called 
  // you can safely try to retrieve output assets.
  p.prepare = function(done) {
    if (!this._preparing) {
      this._preparing = async.memoize(function(done) {
        var reseting = this._reseting || function(callback) { callback(); };
        reseting(function() {
          var q = async.queue(function(item, next) {
            item.prepare(next);
          });

          q.drain = done;
          q.push(this.sourceAssets);
        }.bind(this));
      }.bind(this));
    }

    this._preparing(done);
  };

  // resets the whole thing so it can be prepared again. this is generally
  // called whenever a watched asset changes.
  p.reset = function(done) {
    if (this._reseting) {
      this._reseting(done);
    } else if (!this._preparing) {
      done();

    } else {
      this._reseting = async.memoize(function(done) {
        this._preparing(function(err) {
          this._preparing = null;
          var q = async.queue(function(item, next) {
            item.reset(next);
          });

          q.drain = function(err) {
            this._reseting = null;
            done(err);
          };

          q.push(this.sourceAssets);
        }.bind(this));
      }.bind(this));

      this._reseting(done);
    }
  };

  // selects the most appropriate compiler plugin for the path extension
  p.compilerForAsset = function(asset) {

  };

  // selects the appropriate postprocessor plugins for the type
  p.postprocessorsForAsset = function(asset) {

  };

})(Context.prototype);

var a_slice = Array.prototype.slice;


// An asset can contain header, modules, footer. It can also have dependencies
// which are assets it was built from and it has an optional path which 
// represents it. and it has dependenants which are assets that depend on it.
function SourceAsset(path, context) {
  this.context = context;
  this.path        = path;
  this.prepared    = false; 
}

(function(p) {

  function _memoizedPrepare(done) {
    var self = this;
    self._prepare(function(err) {
      self.prepared = !err;
      if (err) self._preparing = null; // reset to try again
      done(err);
    });
  }

  // call to make sure the asset has been loaded and processed as needed.
  // the default implementation will look for the appropriate compiler and
  // have it compile the path into the asset. Once the asset is prepared,
  // calls done.
  // 
  p.prepare = function(done) {
    if (!this._preparing) {
      this._preparing = async.memoize(_memoizedPrepare.bind(this));
    }
    this._preparing(done);
  };

  // resets the asset. the default just sets prepared back to false.
  p.reset = function(done) {
    this.prepared = false;
    done();
  };

  // core prepare function. overridden by subclasses.
  p._prepare = function(done) {

    var preprocessor, postprocessor, compiler, type, actions;
        self = this;
        context  = this.context;

    compiler = context.compilerForAsset(this);
    type     = this.type = compiler.type;

    actions.push(function(next) {
      compiler.compile(asset, next);
    });

    context.postprocessorsForAsset(this).forEach(function(processor) {
      actions.push(function(next) {
        processor.postprocess(asset, next);
      });
    });

    aync.series(actions, done);

  };


})(Asset.prototype);


// GeneratedAsset is actually constructed from other assets. When you add 
// a generated asset, you must give it a path relative to the environment
// root as well as a root module and type.
function GeneratedAsset(path, context, options) {
  this.path = path;
  this.context = context;
  this.options = options;
  this.dependencies = []; // assets this object depends on.
}

GeneratedAsset.prototype = Object.create(SourceAsset.prototype);

(function(p) {

  p._prepare = function(done) {
  };

})(GeneratedAsset.prototype);

// Does copying
function CopyAsset(outputPath, sourcePath, context) {
  this.path = outputPath;
  this.sourcePath = sourcePath;
}

CopyAsset.prototype = Object.create(SourceAsset.prototype);

(function(p) {

  p._prepare = function(done) {
    // find all potential assets.
    // get assets, add to output and watch directories
  };

})(CopyAsset.prototype);


// pass in a starting file, a module id, all possible extensions, and this
// will return the path to the file matching the module. 
// 
// options:
//    extensions: ['js'],     // allowable extensions
//    usePackages: true,      // enables searching packages
//    mainModuleKey: 'main',  // key to check in package for main module
//    
function resolveId(moduleId, rootFile, options) {

}

// given a path returns a 'compiled' Asset object. You must pass the set of 
// plugins, which should include the necessary Compiler. The return object must
// state the type ('javascript', 'stylesheet') as well as the compiled body.
// 
function loadAsset(path, plugins, done) {

}

// gets the dependencies out of the asset. Looks in the plugins for a parser
// that can extract the list of dependent modules.
function extractRequiredIds(asset, plugins, done) {

}

// walks a hierarchy of assets and returns a flattens hash of modules and
// moduleIds which can be output. modules will be ordered based on their 
// dependencies.
function flattenAssets(rootAsset) {

}

exports.resolveId = resolveId;
