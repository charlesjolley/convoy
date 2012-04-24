/**
 * @module module_packager test
 */

var should   = require('should');
var packager = require('../../lib/module_packager');
var h  = require('../helpers');
var UGLIFY   = require('uglify-js');

describe('[unit] module_packager', function() {

  function join(moduleIds, modules, uglify) {
    var ret = [packager.LOADER];
    var len = moduleIds.length, idx;
    for(idx=0;idx<len;idx++) {
      var moduleId = moduleIds[idx], body = modules[idx];
      body = '(function(require, exports, module) { '+ body + 
        '\n});\n//@ sourceURL=' + moduleId + '\n';
      if (uglify) body = h.uglify(body);
      ret.push(packager.wrap(moduleId, body));
    }

    ret = ret.join('\n');
    if (uglify) ret = h.uglify(ret);
    return ret;
  }

  it('should expose a wrap helper', function() {
    packager.wrap('foo', 'bar').should.equal(
      '$mod.define("foo", "bar");'
    );
  });

  it('should wrap a single module', function(done) {
    var expected = join(['commonjs_package/single'], 
      h.loadEach('commonjs_package/single.js'));

    packager({
      main: h.fixture('commonjs_package/single.js')
    }).build(function(err, asset) {
      if (err) return done(err);
      asset.body.should.equal(expected);
      done();
    });
  });

  it('should minify individual modules', function(done) {
    var expected = join(['commonjs_package/single'], 
      h.loadEach('commonjs_package/single.js'), true);

    packager({
      main: h.fixture('commonjs_package/single.js'),
      minify: true
    }).build(function(err, asset) {
      if (err) return done(err);
      asset.body.should.equal(expected);
      done();
    });
  });

  it("should include required modules", function(done) {
    var expected = join(['commonjs_package/lib/foo', 'commonjs_package/lib/index'], 
      h.loadEach('commonjs_package/lib/foo.js', 
                 'commonjs_package/lib/index.js'));

    packager({
      main: h.fixture('commonjs_package')
    }).build(function(err, asset) {
      if (err) return done(err);
      asset.body.should.equal(expected);
      done();
    });
  });

});

