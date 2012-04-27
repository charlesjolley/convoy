/**
 * @module uglify_minifier
 * @copyright 2012 Charles Jolley
 */

var UGLIFY = require('uglify-js');
var _extend = require('../lib/utils').extend;

var DEFAULT_UGLIFY_OPTIONS = {
  // TODO: determine default options
};

function UglifyMinifier(asset, context, done) {
  var options = context.minify;
  if ('object' === typeof options) {
    options = _extend(_extend({}, DEFAULT_UGLIFY_OPTIONS), options);
  } else {
    options = DEFAULT_UGLIFY_OPTIONS;
  }

  var pro = UGLIFY.uglify;
  var ast = UGLIFY.parser.parse(asset.body);
  //ast = pro.ast_lift_variables(ast);
  ast = pro.ast_mangle(ast, options);
  ast = pro.ast_squeeze(ast, options);
  asset.body = pro.gen_code(ast, options);
  done();
}

module.exports = UglifyMinifier;

