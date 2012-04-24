/**
 * @module default_compiler
 * @copyright 2012 Charles Jolley
 * 
 * Default compiler loads a file into a SourceAsset with no additional 
 * processing. This is suitable for JavaScript and CSS.
 */

var fs = require  ('fs');

function DefaultCompiler(context) {
  this.context = context;
}

var Dp = DefaultCompiler.prototype;

Dp.isPipelinePlugin = true;

Dp.compile = function(asset, done) {
  fs.readFile(asset.path, 'utf8', function(err, data) {
    if (err) return done(err);
    asset.data = data;
    done();
  });
};

exports.DefaultCompiler = DefaultCompiler;
