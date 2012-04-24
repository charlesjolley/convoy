/**
 * @module source_asset test
 * @copyright 2012
 * 
 * Test loading asset from a context.
 */

var helpers = require("../helpers");
var should  = require("should");
var lib     = helpers.lib;

describe("[integration] source_asset", function() {

  var context, path;

  before(function() {
    context = new lib.Context();
    path  = helpers.fixture('test_module.js');
  });

  it("should get source asset for an absolute path", function() {
    var asset = context.getSourceAsset(path);
    should.exist(asset);
    asset.path.should.equal(path);
  });

  it("should return the same asset for multiple calls", function() {
    var asset = context.getSourceAsset(path);
    var asset2 = context.getSourceAsset(path);
    asset2.should.equal(asset);
  });

});