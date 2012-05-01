/**
 * @module loader test
 */

var should = require('should');
var loader = require('../lib/loader');
var h      = require('./support/helpers');

describe('[unit] loader', function() {

  var G;

  beforeEach(function() {
    G = {};
    loader(G,'$mod');
  });

  it('should add library to global with require and define', function() {
    should.exist(G.$mod);
    (typeof G.$mod.require).should.equal('function');
    (typeof G.$mod.define).should.equal('function');
  });

  it('should execute a module function once on require', function() {
    G.$mod.define('foo', function(require, exports, module) {
      exports.cnt = exports.cnt ? exports.cnt+1 : 1;
    });

    G.$mod.require('foo').cnt.should.equal(1);
    G.$mod.require('foo').cnt.should.equal(1);
  });

  describe('[modules requiring modules]', function() {

    beforeEach(function() {
      G.$mod.define('foo/bar', function(require, exports, module) {
        exports.key = 'foo/bar';
      });
    });

    it('should require modules with top-level paths', function() {
      G.$mod.define('baz/index', function(require, exports, module) {
        exports.key = require('foo/bar').key;
      });

      G.$mod.require('baz/index').key.should.equal('foo/bar');
    });

    it('should require relative paths', function() {
      G.$mod.define('foo/lib/baz', function(require, exports, module) {
        exports.key = require('../bar').key;
      });

      G.$mod.require('foo/lib/baz').key.should.equal('foo/bar');
    });

    it('should require top-level paths with dots', function() {
      G.$mod.define('baz/index', function(require, exports, module) {
        exports.key = require('foo/biff/../bop/.//../bar').key;
      });

      G.$mod.require('baz/index').key.should.equal('foo/bar');
    });

  });

  describe('[aliased and alternate paths]', function() {
    it('should require aliases', function() {
      G.$mod.define(['baz/main', 'baz'], function(req, exports, module) {
        exports.key = module.id;
      });

      G.$mod.require('baz').key.should.equal('baz/main');
      G.$mod.require('baz').should.equal(G.$mod.require('baz/main'));
    });

    it('should require index modules', function() {
      G.$mod.define('baz/index', function(req, exports, module) {
        exports.key = module.id;
      });

      G.$mod.require('baz').key.should.equal('baz/index');
      G.$mod.require('baz').should.equal(G.$mod.require('baz/index'));
    });

    it('should require index modules from relative paths', function() {
      G.$mod.define('baz/index', function(req, exports, module) {
        exports.key = module.id;
      });

      G.$mod.define('baz/lib/foo', function(require, exports, module) {
        exports.key = require('..').key;
      });

      G.$mod.require('baz/lib/foo').key.should.equal('baz/index');
    });

    it('should use aliases defined to avoid conflicts', function() {
      // use a stress case - looking up an indirect URL.
      G.$mod.define('foo/bar/index', function(req, exports, module) {
        exports.key = 'foo/bar';
      });

      G.$mod.define('/conflict.1234/foo/bar/index', function(req,exports,mod){
        exports.key = 'conflict/foo/bar';
      });

      G.$mod.define('app/main', function(require, exports, module) {
        exports.key = require('foo/bar').key;
      }, { 
        aliases: { 
          'foo/bar/index': '/conflict.1234/foo/bar/index' 
        }
      });

      G.$mod.require('app/main').key.should.equal('conflict/foo/bar');
    });

  });

  it('should have node-compatible module', function() {

    var mod;

    G.$mod.define('baz', function(require, exports, module) {
      module.loaded.should.equal(false);
      exports.self = module;
      exports.req  = require;
      exports.bar  = require('foo/bar').self;
    });

    G.$mod.define('foo/bar', function(require, exports, module) {
      exports.self = module; //make public.
    });

    mod = G.$mod.require('baz');
    mod.self.exports.should.equal(mod);
    mod.self.require.should.equal(mod.req);
    should.not.exist(mod.self.filename); // no filename on web
    mod.self.loaded.should.equal(true);
    mod.bar.parent.should.equal(mod.self);
    mod.self.children.should.eql([mod.bar]);
  });

  it('should eval stringified functions', function() {
    G.$mod.define('foo', '(function(r,e,m){e.key="FOO";})');
    G.$mod.require('foo').key.should.equal('FOO');
  });


});
