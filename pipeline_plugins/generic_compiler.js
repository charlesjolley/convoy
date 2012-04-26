/**
 * @module generic_compiler
 * @copyright 2012 Charles Jolley
 */

var FS = require('fs');

function GenericCompiler(asset, context, done) {
  FS.readFile(asset.path, 'utf8', function(err, data) {
    if (err) return done(err);
    asset.body = data;
    done();
  });
}

module.exports = GenericCompiler;
