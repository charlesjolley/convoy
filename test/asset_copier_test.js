/**
 * @module asset_copier
 */

var should = require('should');
var FS    = require('fs');
var UTIL  = require('util');
var PATH  = require('path');
var ASYNC = require('async');

var h      = require('./support/helpers');
var lib    = h.lib;
var utils  = require('../lib/utils');

var cnt = 1, inst;

function copier(config) {
  return new lib.AssetCopier(config);
}

describe('[unit] asset_copier', function() {

  describe('[single files]', function() {

    beforeEach(function() {
      inst = copier({
        root: h.fixture('test_module.js'),
        path: 'test_module_foo.js' // should work with a 'logical' filename
      });
    });

    it('should build file', function(done) {
      inst.build('test_module_foo.js', function(err, asset) {
        if (err) return done(err);
        asset.should.have.property('path', 'test_module_foo.js');
        asset.should.have.property('type', 'application/javascript');
        asset.should.have.property('bodyPath', h.fixture('test_module.js'));
        done();
      });
    });

    it('should add mtime and size', function(done) {
      var stats = FS.statSync(h.fixture('test_module.js'));
      inst.build('test_module_foo.js', function(err, asset) {
        if (err) return done(err);
        asset.should.have.property('mtime', stats.mtime.getTime());
        asset.should.have.property('size', stats.size);
        done();
      });
    });

    it('should exists logical file', function(done) {
      inst.exists('test_module_foo.js', function(exists) {
        exists.should.equal(true, 'test_module_foo.js');
        done();
      });
    });

    it('should not say real file exists', function(done) {
      inst.exists('test_module.js', function(exists) {
        exists.should.equal(false, 'test_module.js');
        done();
      });
    });

    it('should not find another file outside of asset', function(done) {
      inst.exists('test_module_2.js', function(exists) {
        exists.should.equal(false);
        done();
      });
    });

    it('should findPaths with just file', function(done) {
      inst.findPaths(function(err, paths) {
        if (err) return done(err);
        paths.should.eql(['test_module_foo.js']);
        done();
      });
    });

  });

  describe('[directories]', function() {

    beforeEach(function() {
      inst = copier({
        root: h.fixture('sample_app/app'),
        path: 'sample_app_foo'
      });
    });

    it('should build single path inside of directory', function(done) {
      var tmppath = h.tmpfile('' + (cnt++) + '_main.js');
      inst.build('sample_app_foo/main.js', function(err, asset) {
        if (err) return done(err);
        asset.should.have.property('bodyPath', 
          PATH.resolve(inst.root, 'main.js'));
        done();
      });
    });

    it('should not build directory', function(done) {
      inst.on('error', function() {}); // absorb error exception
      inst.build('sample_app_foo/views', function(err) {
        should.exist(err);
        done();
      });
    });

    it('should say file inside directory exists', function(done) {
      inst.exists('sample_app_foo/main.js', function(exists) {
        exists.should.equal(true);
        done();
      });
    });

    it('should not say directory exists', function(done) {
      var paths = ['sample_app_foo', 'sample_app_foo/templates'];
      ASYNC.forEach(paths, function(path, next) {
        inst.exists(path, function(exists) {
          exists.should.equal(false, path);
          next();
        });
      }, done);
    });

    it('should not say missing file exists', function(done) {
      var paths = ['sample_app_foo/missing.png', 'sample_app_foo/templates2'];
      ASYNC.forEach(paths, function(path, next) {
        inst.exists(path, function(exists) {
          exists.should.equal(false, path);
          next();
        });
      }, done);
    });

    it('should findPaths with files only', function(done) {
      var expected = [
        'sample_app_foo/core.js',
        'sample_app_foo/main.js',
        'sample_app_foo/models/person.js',
        'sample_app_foo/templates/main_template.hbr',
        'sample_app_foo/templates/main_template.js',
        'sample_app_foo/views/main_view.js'
      ];

      inst.findPaths(function(err, paths) {
        if (err) return done(err);
        paths.should.eql(expected);
        done();
      });
    });
  });

  describe('[watch]', function() {

    var tmproot, didInvalidate, timer;

    function wait(done) {
      timer = setTimeout(function() {
        timer = null;
        done();
      }, 100);
    }

    function unwait() {
      if (timer) clearInterval(timer);
      timer=  null;
    }

    // delay in order to have time to setup watch
    function writeLater(path, body) {
      setTimeout(function() {
        FS.writeFile(path, body, function(err) {
          should.not.exist(err);
        });
      }, 20);
    }

    beforeEach(function(done) {
      tmproot = h.tmpfile('sample_app_' + cnt++);
      utils.cp_r(h.fixture('sample_app/app'), tmproot, null, function(err) {
        if (err) return done(err);
        inst = copier({
          root: tmproot,
          path: 'sample_app_foo',
          watch: true
        });

        inst.on('invalidate', function() {
          if (didInvalidate) didInvalidate();
        });

        done();
      });
    });

    afterEach(function() {
      unwait();
      didInvalidate = null;
      inst.unwatch();
    });

    it('should not invalidate before being built', function(done) {
      didInvalidate = function() {
        should.fail('invalidate called');
        done();
      };
      wait(done);
      writeLater(PATH.resolve(tmproot, 'main.js'), 'FOO');
    });

    it('should invalidate when single file changes', function(done) {
      inst.build('sample_app_foo/main.js', function(err) {
        if (err) return done(err);
        didInvalidate = function() {
          should.ok('invalidated');
          done();
        };

        writeLater(PATH.resolve(tmproot, 'main.js'), 'FOO');
      });
    });

    it('should invalidate when nested file changes', function(done) {
      inst.build('sample_app_foo/main.js', function(err) {
        if (err) return done(err);
        didInvalidate = function() {
          should.ok('invalidated');
          done();
        };
        writeLater(PATH.resolve(tmproot, 'views/main_view.js'), 'FOO');
      });
    });

    it('should invalidate when new file added to directory', function(done) {
      inst.build('sample_app_foo/main.js', function(err) {
        if (err) return done(err);
        didInvalidate = function() {
          should.ok('invalidated');
          done();
        };
        writeLater(PATH.resolve(tmproot, 'new_file.txt'), 'FOO');
      });
    });

    it('should invalidate when file removed from directory', function(done) {
      inst.build('sample_app_foo/main.js', function(err) {
        if (err) return done(err);
        didInvalidate = function() {
          should.ok('invalidated');
          done();
        };

        setTimeout(function() {
          FS.unlink(PATH.resolve(tmproot, 'views/main_view.js'), function(e){
            should.not.exist(e);
          });
        }, 20);
      });
    });

    it('should invalidate when directory added', function(done) {
      inst.build('sample_app_foo/main.js', function(err) {
        if (err) return done(err);
        didInvalidate = function() {
          should.ok('invalidated');
          done();
        };

        setTimeout(function() {
          FS.mkdir(PATH.resolve(tmproot, 'tests'), function(err) {
            should.not.exist(err);
          });
        }, 20);
      });
    });

    it('should invalidate when directory removed', function(done) {
      FS.mkdir(PATH.resolve(tmproot, 'tests'), function(err) {
        if (err) done(err);

        inst.build('sample_app_foo/main.js', function(err) {
          if (err) return done(err);
          didInvalidate = function() {
            should.ok('invalidated');
            done();
          };

          setTimeout(function() {
            FS.rmdir(PATH.resolve(tmproot, 'tests'), function(err) {
              should.not.exist(err);
            });
          }, 20);
        });
      });
    });
  });

});


