/**
 * @module module_packager test
 */

var should = require('should');
var h  = require('./support/helpers');
var lib = h.lib;
var UGLIFY   = require('uglify-js');

function packager(config) {
  return new lib.AssetPackager({
    path: 'app.js',
    compilers: {
      '.js':  lib.plugins.JavaScriptCompiler
    },

    analyzer: lib.plugins.CommonJSAnalyzer,
    linker:   lib.plugins.CommonJSLinker,
    minifier: lib.plugins.UglifyMinifier,
    mainKey:  'main'
  }, config);
}

var wrap = lib.plugins.CommonJSLinker.wrap;

describe('[unit] commonjs_packager', function() {

  function join(assets, uglify) {

    var ret = [lib.plugins.CommonJSLinker.LOADER];
    var len = assets.length, idx;
    for(idx=0;idx<len;idx++) {
      var asset = assets[idx], body;

      body = '(function(require, exports, module) { '+ asset.body + 
        '\n});\n//@ sourceURL=' + (asset.sourceURL || asset.id) + '\n';
      if (uglify) body = h.uglify(body);
      ret.push(wrap(asset.id, body, asset.opts));
    }

    ret = ret.join('\n');
    if (uglify) ret = h.uglify(ret);
    return ret;
  }

  it('should expose a wrap helper', function() {
    wrap('foo', 'bar').should.equal(
      '$mod.define("foo", "bar");'
    );
  });

  it('should wrap a single module', function(done) {
    var expected = join([
      { id: 'commonjs_package/single',
        body: h.loadEach('commonjs_package/single.js')
      }
    ]);

    packager({
      main: h.fixture('commonjs_package/single.js')
    }).build('app.js', function(err, asset) {
      if (err) return done(err);
      asset.body.should.equal(expected);
      done();
    });
  });

  it('should minify individual modules', function(done) {
    var expected = join([
      { id: 'commonjs_package/single',
        body: h.loadEach('commonjs_package/single.js')
      }
    ], true);

    packager({
      main: h.fixture('commonjs_package/single.js'),
      minify: true
    }).build('app.js', function(err, asset) {
      if (err) return done(err);
      asset.body.should.equal(expected);
      done();
    });
  });

  it("should include required modules", function(done) {
    var expected = join([
      { id: 'commonjs_package/lib/foo',
        body: h.loadEach('commonjs_package/lib/foo.js')
      },

      { id:  ['commonjs_package/lib/index', 'commonjs_package'],
        sourceURL: 'commonjs_package/lib/index',
        body: h.loadEach('commonjs_package/lib/index.js')
      }
    ]);

    packager({
      main: h.fixture('commonjs_package')
    }).build('app.js', function(err, asset) {
      if (err) return done(err);
      asset.body.should.equal(expected);
      done();
    });
  });

  it("should gracefully handle conflicting dependencies by renaming", function(done) {
    var expected = join([
      { id: ['conflicting_package/identical_file', 'conflicting_package'],
        sourceURL: 'conflicting_package/identical_file',
        body: h.loadEach('demo_package/node_modules/uses_conflicting_package/'+
                         'node_modules/conflicting_package/identical_file.js')
      },

      { id: 'conflicting_package/conflicting_file',
        body: h.loadEach('demo_package/node_modules/uses_conflicting_package/'+
                         'node_modules/conflicting_package/conflicting_file.js')
      },

      { id: ['uses_conflicting_package/main', 'uses_conflicting_package'],
        sourceURL: 'uses_conflicting_package/main',
        body: h.loadEach('demo_package/node_modules/uses_conflicting_package/'+
                         'main.js')
      },

      { id: '/__conflicts_1__/conflicting_package/conflicting_file',
        sourceURL: 'conflicting_package/conflicting_file',
        body: h.loadEach('demo_package/node_modules/'+
                         'conflicting_package/conflicting_file.js')
      },

      { id: 'demo_package/conflict_test',
        body: h.loadEach('demo_package/conflict_test.js'),
        opts: {
          aliases: {
            'conflicting_package/conflicting_file':
              '/__conflicts_1__/conflicting_package/conflicting_file'
          }
        }
      }
    ]);

    var inst = packager({
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

