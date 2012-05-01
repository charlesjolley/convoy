/**
 * @module simple_merge_linker
 * @copyright 2012 Charles Jolley
 */

function SimpleMergeLinker(asset, context, done) {
  context.expand(asset.assets, function(err, expanded) {
    if (err) return done(err);
    asset.body = 
      expanded.map(function(asset) { return asset.body; }).join("\n");

    asset.mtime = expanded.reduce(function (curMtime, asset) {
      return Math.max(curMtime || 0, asset.mtime || 0);
    }, 0);
    
    done();
  });
}

module.exports = SimpleMergeLinker;
