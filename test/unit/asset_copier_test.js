/**
 * @module asset_copier
 */

var FS    = require('fs');
var UTIL  = require('util');
var PATH  = require('path');
var ASYNC = require('async');

var should = require('should');
var h      = require('../helpers');
var lib    = h.lib;
var utils  = require('../../lib/utils');

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

    it('should writeFile', function(done) {
      var tmppath = h.tmpfile('' + (cnt++) + '_test_module.js');
      inst.writeFile(tmppath, 'test_module_foo.js', function(err) {
        if (err) return done(err);
        var expected = FS.readFileSync(inst.root, 'utf8');
        FS.readFileSync(tmppath, 'utf8').should.equal(expected);
        done();
      });
    });

    it('should build file', function(done) {
      var tmppath = h.tmpfile('' + (cnt++) + '_test_module.js');
      inst.build('test_module_foo.js', function(err, asset) {
        if (err) return done(err);
        asset.path.should.equal('test_module_foo.js');
        asset.type.should.equal('application/javascript');
        should.exist(asset.bodyStream);

        var os = FS.createWriteStream(tmppath);
        UTIL.pump(asset.bodyStream, os, function(err) {
          if (err) return done(err);
          var expected = FS.readFileSync(inst.root, 'utf8');
          FS.readFileSync(tmppath, 'utf8').should.equal(expected);
          done();
        });

      });
    });

    it('should exists logical filen', function(done) {
      inst.exists('test_module_foo.js', function(exists) {
        exists.should.equal(true);
        done();
      });
    });

    it('should not say real file exists', function(done) {
      inst.exists('test_module.js', function(exists) {
        exists.should.equal(false);
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

    it('should writeFile for path inside of directory', function(done) {
      var tmppath = h.tmpfile('' + (cnt++) + '_main.js');
      inst.writeFile(tmppath, 'sample_app_foo/main.js', function(err) {
        if (err) return done(err);
        var expected = 
          FS.readFileSync(PATH.resolve(inst.root, 'main.js'), 'utf8');
        FS.readFileSync(tmppath, 'utf8').should.equal(expected);
        done();
      });
    });

    it('should writeFile entire directory', function(done) {
      var tmppath = h.tmpfile('' + (cnt++) + '_app');
      inst.writeFile(tmppath, 'sample_app_foo', function(err) {
        if (err) return done(err);
        var expected;
        ['main.js', 'core.js', 'views/main_view.js'].forEach(function(fname) {
          expected = FS.readFileSync(PATH.resolve(inst.root, fname), 'utf8');
          FS.readFileSync(PATH.resolve(tmppath, fname), 'utf8')
            .should.equal(expected);
        });
        done();
      });
    });

    it('should build single path inside of directory', function(done) {
      var tmppath = h.tmpfile('' + (cnt++) + '_main.js');
      inst.build('sample_app_foo/main.js', function(err, asset) {
        if (err) return done(err);
        var expected = 
          FS.readFileSync(PATH.resolve(inst.root, 'main.js'), 'utf8');

        var os = FS.createWriteStream(tmppath);
        UTIL.pump(asset.bodyStream, os, function(err) {
          if (err) return done(err);
          FS.readFileSync(tmppath, 'utf8').should.equal(expected);
          done();
        });
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

    it('should say directory exists', function(done) {
      var paths = ['sample_app_foo', 'sample_app_foo/templates'];
      ASYNC.forEach(paths, function(path, next) {
        inst.exists(path, function(exists) {
          exists.should.equal(true, path);
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
      FS.writeFile(PATH.resolve(tmproot, 'main.js'), 'FOO');
    });

    it('should invalidate when single file changes', function(done) {
      inst.build('sample_app_foo/main.js', function(err) {
        if (err) return done(err);
        didInvalidate = function() {
          should.ok('invalidated');
          done();
        };
        FS.writeFile(PATH.resolve(tmproot, 'main.js'), 'FOO');
      });
    });

    it('should invalidate when nested file changes', function(done) {
      inst.build('sample_app_foo/main.js', function(err) {
        if (err) return done(err);
        didInvalidate = function() {
          should.ok('invalidated');
          done();
        };
        FS.writeFile(PATH.resolve(tmproot, 'views/main_view.js'), 'FOO');
      });
    });

    it('should invalidate when new file added to directory', function(done) {
      inst.build('sample_app_foo/main.js', function(err) {
        if (err) return done(err);
        didInvalidate = function() {
          should.ok('invalidated');
          done();
        };
        FS.writeFile(PATH.resolve(tmproot, 'new_file.txt'), 'FOO');
      });
    });

    it('should invalidate when file removed from directory', function(done) {
      inst.build('sample_app_foo/main.js', function(err) {
        if (err) return done(err);
        didInvalidate = function() {
          should.ok('invalidated');
          done();
        };
        FS.unlink(PATH.resolve(tmproot, 'views/main_view.js'));
      });
    });

    it('should invalidate when directory added', function(done) {
      inst.build('sample_app_foo/main.js', function(err) {
        if (err) return done(err);
        didInvalidate = function() {
          should.ok('invalidated');
          done();
        };
        FS.mkdir(PATH.resolve(tmproot, 'tests'));
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
          FS.unlink(PATH.resolve(tmproot, 'tests'));
        });
      });
    });
  });

});


