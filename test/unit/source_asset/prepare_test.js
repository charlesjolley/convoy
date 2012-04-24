/**
 * @module SourceAsset#prepare test
 * @copyright 2012
 * 
 * Test loading asset from a context.
 */

var helpers = require("../../helpers");
var should  = require("should");
var lib     = helpers.lib;
var fs      = require('fs');

function Postprocessor(keyName) {
  this.keyName = keyName;
}

Postprocessor.prototype.postprocess = function(asset, done) {
  if (!asset.postprocessCount) asset.postprocessCount = 0;
  if (!asset.postprocessed) asset.postprocessed = [];
  asset.postprocessCount++;
  asset.postprocessed.push(this.keyName);
  done();
};

describe("[unit] source_asset/prepare", function() {

  var context, path, asset;

  before(function() {
    context = new lib.Context();
    context.postprocessorsForAsset = function(asset) {
      return [new Postprocessor('A'), new Postprocessor('B')];
    };

    path  = helpers.fixture('test_module.js');
    asset = context.getSourceAsset(path);
  });

  it("should not be prepared at first", function() {
    asset.prepared.should.equal(false);
  });

  it("should load content of file on prepare", function(done) {

    var data = fs.readFileSync(path, 'utf8');

    asset.prepare(function(err) {
      if (err) return done(err);
      asset.data.should.equal(data);
      done();
    });

  });

  it("should run postprocessors in order", function(done) {

    asset.prepare(function(err) {
      if (err) return done(err);
      asset.postprocessed.should.eql(['A', 'B']);
      done();
    });
  });

  it("should not prepare more than once", function(done) {
    var count, lim = 2;

    function whendone() {
      if (--lim<=0) done();
    }

    asset.prepare(function(err) {
      if (err) return done(err);
      asset.postprocessCount.should.equal(2);
      asset.postprocessed.should.eql(['A', 'B']);
      whendone();
    });

    asset.prepare(function(err) {
      if (err) return done(err);
      asset.postprocessCount.should.equal(2);
      asset.postprocessed.should.eql(['A', 'B']);
      whendone();
    });

  });

  it("should prepare again after a reset", function(done) {
    asset.prepare(function(err) {
      if (err) return done(err);
      asset.reset(function(err) {
        if (err) return done(err);
        asset.prepare(function(err){
          if (err) return done(err);
          asset.postprocessCount.should.equal(4);
          asset.postprocessed.should.eql(['A', 'B', 'A', 'B']);
          done();
        });
      });
    });
  });
  
});