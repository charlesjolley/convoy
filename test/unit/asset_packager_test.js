/**
 * @module asset_packager
 */

var should   = require('should');
var FS       = require('fs');
var h  = require('../helpers');
var lib = h.lib;

function packager(config) {
  return new lib.AssetPackager({
    path: 'app.js',
    compilers: {
      '.js': lib.plugins.GenericCompiler
    },
    analyzer: lib.plugins.GenericAnalyzer,
    linker:   lib.plugins.SimpleMergeLinker,
    minifier: lib.plugins.UglifyMinifier
  }, config);
}

describe('[unit] asset_packager', function() {

  describe("[with no dependencies]", function() {

    var inst, expected;

    before(function() {
      expected = h.loadEach('test_module.js', 'test_module_2.js').join("\n");
    });

    beforeEach(function() {
      inst = packager({ 
        path: 'app.js',
        main: [h.fixture('test_module.js'), h.fixture('test_module_2.js')]
      });
    });

    it('should merge assets with no dependencies in order passed', 
      function(done) {
      inst.build('app.js', function(err, asset) {
        if (err) return done(err);
        asset.body.should.equal(expected);
        done();
      });
    });

    it('should memoize build result', function(done) {
      inst.build('app.js', function(err, asset1) {
        if (err) done(err);
        inst.build('app.js', function(err, asset2) {
          if (err) done(err);
          asset2.should.equal(asset1);
          done();
        });
      });
    });

    it("should rebuild after invalidate", function(done) {
      inst.build('app.js', function(err, asset1) {
        if (err) return done(err);
        inst.invalidate();
        inst.build('app.js', function(err, asset2) {
          if (err) return done(err);
          asset2.should.not.equal(asset1);
          done();
        });
      });
    });

    it("should write out contents", function(done) {
      var tmpfile = h.tmpfile();
      inst.writeFile(tmpfile, 'app.js', function(err) {
        if (err) return done(err);
        FS.readFileSync(tmpfile, 'utf8').should.equal(expected);
        done();
      });
    });

    it("should write out contents on each call", function(done) {
      var tmpfile = h.tmpfile();
      inst.writeFile(tmpfile, 'app.js', function(err) {
        if (err) return done(err);
        var expected = FS.readFileSync(tmpfile, 'utf8');
        FS.writeFileSync(tmpfile, "DUMMY"); // make sure write happens again
        inst.writeFile(tmpfile, 'app.js', function(err) {
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
        path: 'app.js',
        main: h.fixture('local_dependencies.js')
      });

      inst.build('app.js', function(err, asset) {
        if (err) return done(err);
        asset.body.should.equal(expected);
        done();
      });
    });

    it('should not choke on circular dependencies', function(done) {
      expected = 
        h.loadEach('circular/first.js', 'circular/second.js').join("\n");

      inst = packager({
        path: 'app.js',
        main: h.fixture('circular', 'second.js')
      });

      inst.build('app.js', function(err, asset) {
        if (err) return done(err);
        asset.body.should.equal(expected);
        done();
      });
    });

    it('should load main module from package', function(done) {
      expected = 
        h.loadEach('demo_package/lib/mod1.js', 'demo_package/main.js').join("\n");

      packager({
        path: 'app.js',
        main: h.fixture('demo_package')
      }).build('app.js', function(err, asset) {
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
        path: 'app.js',
        main: h.fixture('demo_package/lib/requires_package.js')
      }).build('app.js', function(err, asset) {
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
        path: 'app.js',
        main: [h.fixture('test_module.js'), h.fixture('test_module_2.js')],
        minify: true
      }).build('app.js', function(err, asset) {
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
        path: 'app.js',
        main: [h.fixture('test_module.js'), h.fixture('test_module_2.js')],
        minify: options
      }).build('app.js', function(err, asset) {
        if (err) return done(err);
        asset.body.should.equal(expected);
        done();
      });
    });

  });


  // this scenario can happen because of how node_modules are stored - if two
  // packages depend on the same package, then the package can appear more than
  // once in the system.
  // 
  // The solution to this is to recognize when the same asset is loaded more
  // than once and then remove exact duplicates from the expanded set of 
  // assets. If we can't remove exact duplicates, then both files remain but 
  // are noted as a conflict. By default conflicting assets are both included
  // though some plugins (like the CommonJS module system) may be more 
  // intelligent about it.
  // 
  it("should gracefully handle conflicting dependencies", function(done) {
    var expected = h.loadEach(
      'demo_package/node_modules/uses_conflicting_package/node_modules/conflicting_package/identical_file.js',
      'demo_package/node_modules/uses_conflicting_package/node_modules/conflicting_package/conflicting_file.js',
      'demo_package/node_modules/uses_conflicting_package/main.js',

      // this file is required but is identical and therefore should be 
      // omitted
      //'demo_package/node_modules/conflicting_package/identical_file.js',

      // this file is required twice but conflicts so it shoudl appear.
      'demo_package/node_modules/conflicting_package/conflicting_file.js',
      'demo_package/conflict_test.js').join("\n");

    var inst = packager({
      path: 'app.js',
      main: h.fixture('demo_package/conflict_test.js')
    });

    var log = h.captureLog(inst); // listen for logging events

    inst.build('app.js', function(err, asset) {
      if (err) return done(err);
      should.exist(log.warnings[0]);
      log.warnings[0].should.match(/conflict/); // should log a conflict
      asset.body.should.equal(expected);
      done();
    });
  });

});


