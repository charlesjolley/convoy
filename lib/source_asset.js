/**
 * @module source_asset
 * @copyright 2012 Charles Jolley
 * 
 * The core kind of asset to load from disk.
 * 
 */

var async = require('async');

function SourceAsset(path, context) {
  this.path     = path;
  this.context  = context;
  this.prepared = false;
}

var Sp = SourceAsset.prototype;

/**
 * Call to ensure the asset has been loaded and processed. An asset will only
 * be prepared once. It is safe to call this method as often as you need to 
 * ensure the asset has been prepared.
 *  
 * @param  {Function} done Invoked when prepare completed.
 * @return {void}       
 */
Sp.prepare = function(done) {
  if (!this._preparing) {
    this._preparing = async.memoize(function(done) {
      this._prepare(function(err) {
        this.prepared = !err;
        if (err) this._preparing = null; // reset to try again
        done(err);
      }.bind(this));
    }.bind(this));
  }

  this._preparing(done);
};

/**
 * Resets the asset and any caches.
 * @param  {Function} done Invoked when reset completed.
 * @return {void}       
 */
Sp.reset = function(done) {
  this.prepared = false;
  this._preparing = null;
  done();
};

/**
 * Core prepare function. Overridden by subclasses.
 * @param  {Function} done Invoked when prepare is completed.
 * @return {void}        
 */
Sp._prepare = function(done) {

  var preprocessor, postprocessor, compiler, type, actions,
      asset    = this,
      context  = this.context;

  compiler = context.compilerForAsset(this);
  type     = this.type = compiler.type;

  actions = [function(next) {
    compiler.compile(asset, next);
  }];

  context.postprocessorsForAsset(this).forEach(function(processor) {
    actions.push(function(next) {
      processor.postprocess(asset, next);
    });
  });

  async.series(actions, done);

};


exports.SourceAsset = SourceAsset;
