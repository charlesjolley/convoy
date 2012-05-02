/**
 * @module asset_packager
 */

var should = require('should');
var FS       = require('fs');
var h  = require('./support/helpers');
var lib = h.lib;
var UTILS = require('../lib/utils');
var PATH  = require('path');
var ASYNC = require('async');


function packager(config) {
  return new lib.AssetPackager({
    path: 'app.js',
    compilers: {
      '.js': lib.plugins.GenericCompiler
    },
    analyzer: lib.plugins.GenericAnalyzer,
    linker:   lib.plugins.SimpleMergeLinker,
    minifier: lib.plugins.UglifyMinifier,
    mainKey:  'main'
  }, config);
}

describe('[unit] asset_packager', function() {

  describe("getSourceAsset", function() {

    var inst;

    beforeEach(function() {
      inst = packager({
        path: 'app.js',
        main: h.fixture('demo_package/main.js')
      });
    });

    it('should return an asset object for main module', function(done) {
      var path = h.fixture('demo_package/main.js');
      var stat = FS.statSync(path);
      var body = FS.readFileSync(path, 'utf8');
      inst.getSourceAsset(path, function(err, asset) {
        if (err) return done(err);
        asset.should.have.property('path', path);
        asset.should.have.property('body', body);
        asset.should.have.property('mtime', stat.mtime.getTime());
        asset.should.have.property('id', 'demo_package/main');
        asset.dependencies.should.eql([
          h.fixture('demo_package/lib/mod1.js')
        ]);

        asset.parents.should.eql([]);
        asset.children.should.eql([]);
        done();
      });
    });

    it('should return an error for a relative path', function(done) {
      inst.on('error', function() {}); // prevents exception
      inst.getSourceAsset('./main.js', function(err, asset) {
        should.exist(err);
        done();
      });
    });

    it('should return a raw asset for any file with a compiler', function(done){
      var path = h.fixture('demo_package/conflict_test.js');
      var stat = FS.statSync(path);
      var body = FS.readFileSync(path, 'utf8');
      inst.getSourceAsset(path, function(err, asset) {
        if (err) return done(err);
        asset.should.have.property('path', path);
        asset.should.have.property('body', body);
        asset.should.have.property('mtime', stat.mtime.getTime());
        asset.id.should.equal('demo_package/conflict_test');
        done();
      });
    });

    it('should return error for asset without compiler', function(done) {
      inst.on('error', function() {}); // prevents exception
      var path = h.fixture('sample_app/app/styles/global.css');
      inst.getSourceAsset(path, function(err, asset) {
        should.exist(err);
        done();
      });
    });

  });

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
        asset.should.have.property('body', expected);
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

    it('should match newest mtime', function(done) {
      var mtime = ['test_module.js', 'test_module_2.js'].reduce(
      function(cur, fname) {
        var next = FS.statSync(h.fixture(fname)).mtime.getTime();
        return Math.max(next, cur);
      }, 0); 

      mtime.should.not.equal(0);
      inst.build('app.js', function(err, asset) {
        if (err) return done(err);
        asset.should.have.property('mtime', mtime);
        done();
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
        asset.should.have.property('body', expected);
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
        asset.should.have.property('body', expected);
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
        asset.should.have.property('body', expected);
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
        asset.should.have.property('body', expected);
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
        asset.should.have.property('body', expected);
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
        asset.should.have.property('body', expected);
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
      asset.should.have.property('body', expected);
      done();
    });
  });

  describe('[watching]', function() {

    var tmp = h.tmpfile('tmp_fixtures'), inst;

    beforeEach(function(done) {

      ASYNC.series([
        function(next) {
          UTILS.mkdir_p(tmp, next);
        }, function(next) {
          var paths = ['local_dependencies.js', 'test_module.js', 
                       'test_module_2.js', 'required_module.js'];
          ASYNC.forEach(paths, function(path, next) {
            UTILS.cp(h.fixture(path), PATH.resolve(tmp, path), null, next);
          }, next);
        }, function(next) {
          inst = packager({
            main: PATH.resolve(tmp, 'local_dependencies.js'),
            watch: true
          });
          next();
        }
      ], done);
    });

    afterEach(function() {
      inst.unwatch();
    });

    it('should invalidate when main file changes', function(done) {
      inst.build('app.js', function(err) {
        if (err) return done(err);

        // if not called then this will timeout eventually.
        inst.on('invalidate', function() {
          should.exist(true, 'invalidate called');
          done();
        });

        var corePath = PATH.resolve(tmp, 'local_dependencies.js');
        FS.writeFile(corePath, 'FOO', function(err) {
          if (err) done(err);
        });
      });
    });


    it('should invalidate when a dependent changes', function(done) {
      inst.build('app.js', function(err) {
        if (err) return done(err);

        // if not called then this will timeout eventually.
        inst.on('invalidate', function() {
          should.exist(true, 'invalidate called');
          done();
        });

        var corePath = PATH.resolve(tmp, 'test_module.js');
        FS.writeFile(corePath, 'FOO', function(err) {
          if (err) done(err);
        });
      });
    });

    it('should not invalidate again until rebuilt', function(done) {
      var shouldInvalidate = true, next;
      var corePath = PATH.resolve(tmp, 'test_module.js');
      var timer = null;
      var cnt   = 1;

      function writeFile() {
        FS.writeFile(corePath, 'FOO ' + cnt++, function(err) {
          if (err) {
            if (timer) clearTimeout(timer);
            done(err);
          }
        });
      }

      var states ;

      function gotoState(key) {
        states[key]();
      }

      // this test progresses through the states below. the basic idea is:
      // 1. build, modify file -> should invalidate
      // 2. modify file again -> should not invalidate again
      // 3. build again, modify file -> should invalidate
      states = {
        first_build: function() {
          inst.build('app.js', function(err) {
            if (err) return done(err);
            // if not called then this will timeout eventually.
            inst.on('invalidate', function() {
              shouldInvalidate.should.equal(true, 'invalidate called');
              next();
            });
            gotoState('first_write');
          });
        },

        first_write: function() {
          shouldInvalidate = true;
          next = function() { gotoState('second_write'); };
          writeFile();
        },

        second_write: function() {
          shouldInvalidate = false;
          timer = setTimeout(function() {
            gotoState('second_build');
          }, 100);

          next = function() {
            clearTimeout(timer);
            done();
          };

          writeFile();
        },

        second_build: function() {
          inst.build('app.js', function(err) {
            if (err) return done(err);
            gotoState('third_write');
          });
        },

        third_write: function() {
          shouldInvalidate = true;
          next = done;
          writeFile();
        }
      };

      gotoState('first_build');
    });

    it('should not invalidate when an unrelated file changes', function(done){
      
      inst.build('app.js', function(err) {
        if (err) return done(err);

        inst.on('invalidate', function() {
          should.exist(false, 'invalidate called!');
          clearTimeout(timer);
          done(new Error('invalidate called'));
        });

        // give FS watcher some time.
        var timer = setTimeout(function() {
          should.exist(true, 'invalidate not called');
          done();
        }, 100);

        var corePath = PATH.resolve(tmp, 'unrelated.js');
        FS.writeFile(corePath, 'FOO', function(err) {
          if (err) {
            clearTimeout(timer);
            done(err);
          }
        });
      });
    });

    it ('should not invalidate until the asset has been built', function(done){

      inst.on('invalidate', function() {
        should.exist(false, 'invalidate called!');
        clearTimeout(timer);
        done(new Error('invalidate called'));
      });

      // give FS watcher some time.
      var timer = setTimeout(function() {
        should.exist(true, 'invalidate not called');
        done();
      }, 100);

      var corePath = PATH.resolve(tmp, 'local_dependencies.js');
      FS.writeFile(corePath, 'FOO', function(err) {
        if (err) {
          clearTimeout(timer);
          done(err);
        }
      });

    });

  });

});


