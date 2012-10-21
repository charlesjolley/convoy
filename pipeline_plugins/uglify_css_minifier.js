/**
 * @module uglify_css_minifier
 * @copyright 2012 Charles Jolley
 */

var UGLIFY = require('uglifycss');
var _extend = require('../lib/utils').extend;

var DEFAULT_UGLIFY_OPTIONS = {
  // TODO: determine default options
};

function UglifyCSSMinifier(asset, context, done) {
  var options = context.minify;
  if ('object' === typeof options) {
    options = _extend(_extend({}, DEFAULT_UGLIFY_OPTIONS), options);
  } else {
    options = DEFAULT_UGLIFY_OPTIONS;
  }

  asset.body = UGLIFY.processString(asset.body, options);
  done();
}

module.exports = UglifyCSSMinifier;

