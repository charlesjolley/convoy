/**
 * @module asset_packager
 */

var should   = require('should');
var packager = require('../../lib/asset_packager');
var FS       = require('fs');
var h  = require('../helpers');

describe('[unit] asset_packager', function() {

  describe("[with no dependencies]", function() {

    var inst, expected;

    before(function() {
      expected = h.loadEach('test_module.js', 'test_module_2.js').join("\n");
    });

    beforeEach(function() {
      inst = packager({ 
        main: [h.fixture('test_module.js'), h.fixture('test_module_2.js')]
      });
    });

    it('should merge assets with no dependencies in order passed', 
      function(done) {
      inst.build(function(err, asset) {
        if (err) return done(err);
        asset.body.should.equal(expected);
        done();
      });
    });

    it('should memoize build result', function(done) {
      inst.build(function(err, asset1) {
        if (err) done(err);
        inst.build(function(err, asset2) {
          if (err) done(err);
          asset2.should.equal(asset1);
          done();
        });
      });
    });

    it("should rebuild after invalidate", function(done) {
      inst.build(function(err, asset1) {
        if (err) return done(err);
        inst.invalidate();
        inst.build(function(err, asset2) {
          if (err) return done(err);
          asset2.should.not.equal(asset1);
          done();
        });
      });
    });

    it("should write out contents", function(done) {
      var tmpfile = h.tmpfile();
      inst.write(tmpfile, function(err) {
        if (err) return done(err);
        FS.readFileSync(tmpfile, 'utf8').should.equal(expected);
        done();
      });
    });

    it("should write out contents on each call", function(done) {
      var tmpfile = h.tmpfile();
      inst.write(tmpfile, function(err) {
        if (err) return done(err);
        var expected = FS.readFileSync(tmpfile, 'utf8');
        FS.writeFileSync(tmpfile, "DUMMY"); // make sure write happens again
        inst.write(tmpfile, function(err) {
          if (err) return done(err);
          FS.readFileSync(tmpfile, 'utf8').should.equal(expected);
          done();
        });
      });
    });

  });

  describe('[with dependencies]', function() {

    var inst, expected;

    it('should include and local dependencies', function(done) {
      expected = h.loadEach('test_module_2.js', 'test_module.js', 
        'required_module.js', 'local_dependencies.js').join("\n");

      inst = packager({
        main: h.fixture('local_dependencies.js')
      });

      inst.build(function(err, asset) {
        if (err) return done(err);
        asset.body.should.equal(expected);
        done();
      });
    });

    it('should not choke on circular dependencies', function(done) {
      expected = 
        h.loadEach('circular/first.js', 'circular/second.js').join("\n");

      inst = packager({
        main: h.fixture('circular', 'second.js')
      });

      inst.build(function(err, asset) {
        if (err) return done(err);
        asset.body.should.equal(expected);
        done();
      });
    });

    it('should load main module from package', function(done) {
      expected = 
        h.loadEach('demo_package/lib/mod1.js', 'demo_package/main.js').join("\n");

      packager({
        main: h.fixture('demo_package')
      }).build(function(err, asset) {
        if (err) return done(err);
        asset.body.should.equal(expected);
        done();        
      });
    });

    it("should find assets from installed packages", function(done) {
      expected = h.loadEach(
        'demo_package/node_modules/example_package/lib/asset2.js',
        'demo_package/node_modules/example_package/lib/index.js',
        'demo_package/lib/requires_package.js').join('\n');

      packager({
        main: h.fixture('demo_package/lib/requires_package.js')
      }).build(function(err, asset) {
        if (err) return done(err);
        asset.body.should.equal(expected);
        done();
      });
    });

  });


  describe('[minifier]', function() {

    it("should minify when activated", function(done) {
      var expected = 
        h.uglify(h.loadEach('test_module.js', 'test_module_2.js').join("\n"));

      packager({
        main: [h.fixture('test_module.js'), h.fixture('test_module_2.js')],
        minify: true
      }).build(function(err, asset) {
        if (err) return done(err);
        asset.body.should.equal(expected);
        done();
      });
    });

    it("should respect uglify options", function(done) {

      var options = {
        beautify: true,
        toplevel: true
      };

      var expected = 
        h.uglify(h.loadEach('test_module.js', 'test_module_2.js').join("\n"),
          options);

      packager({
        main: [h.fixture('test_module.js'), h.fixture('test_module_2.js')],
        minify: options
      }).build(function(err, asset) {
        if (err) return done(err);
        asset.body.should.equal(expected);
        done();
      });
    });

  });



});