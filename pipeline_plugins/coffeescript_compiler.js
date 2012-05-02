/**
 * @module coffeescript_compiler
 * @copyright 2012 Charles Jolley
 */

var CoffeeScript = require('coffee-script');
var FS = require('fs');

function CoffeeScriptCompiler(asset, context, done) {
  FS.readFile(asset.path, 'utf8', function(err, data) {
    if (err) return done(err);
    asset.body = CoffeeScript.compile(data);
    done();
  });
}

module.exports = CoffeeScriptCompiler;
