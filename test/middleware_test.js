/**
 * middleware test
 */

// most of these tests are borrowed from the connect.static middleware tests

var should = require('should');
require('./support/http');

var connect = require('connect');
var convoy  = require('../lib');
var h = require('./support/helpers');
var PATH = require('path');
var ASYNC = require('async');

var pipeline = convoy({

  'todo.js': {
    packager: 'legacy_javascript',
    main: h.fixture('middleware/todo.js')
  },

  'foo bar.css': {
    packager: 'css',
    main: h.fixture('middleware/foo bar')
  },

  'nums.css': {
    packager: 'css',
    main: h.fixture('middleware/nums.css')
  },

  'users': {
    packager: 'copy',
    root: h.fixture('middleware/users')
  }

});

var todos_body = [
'//- groceries',
'',
'//= require ./groceries',
'// todos',
''
].join('\n');

var app = connect();
app.use(pipeline.middleware());

describe('convoy.middleware()', function(){

  it('should serve primary asset', function(done){
    app.request()
    .get('/todo.js')
    .expect(todos_body, done);
  });

  it('should support nesting & copies', function(done){
    app.request()
    .get('/users/tobi.txt')
    .expect('ferret', done);
  });
  
  it('should set Content-Type from javascript', function(done){
    app.request()
    .get('/todo.js')
    .expect('Content-Type', 'application/javascript', done);
  });
  

  it('should set Content-Type from css', function(done){
    app.request()
    .get('/foo%20bar.css')
    .expect('Content-Type', 'text/css; charset=UTF-8', done);
  });

  it('should set Content-Type from copied', function(done){
    app.request()
    .get('/users/tobi.txt')
    .expect('Content-Type', 'text/plain; charset=UTF-8', done);
  });


  it('should support urlencoded pathnames', function(done){
    app.request()
    .get('/foo%20bar.css')
    .expect('baz', done);
  });

  it('should support index.html', function(done){
    app.request()
    .get('/users/')
    .end(function(res){
      res.body.should.equal('<p>tobi, loki, jane</p>');
      res.headers.should.have.property('content-type', 'text/html; charset=UTF-8');
      done();
    });
  });

  it('should support valid ../', function(done){
    app.request()
    .get('/users/../todo.js')
    .expect(todos_body, done);
  });

  it('should support HEAD', function(done){
    app.request()
    .head('/todo.js')
    .expect('', done);
  });

  describe('hidden files', function(){
    it('should be ignored by default', function(done){
      app.request()
      .get('/users/.hidden')
      .expect(404, done);
    });
    
    it('should be served when hidden: true is given', function(done){
      var app = connect();

      app.use(pipeline.middleware({ hidden: true }));

      app.request()
      .get('/users/.hidden')
      .expect('I am hidden', done);
    });
  });

  describe('maxAge', function(){
    it('should be 0 by default', function(done){
      app.request()
      .get('/todo.js')
      .end(function(res){
        res.should.have.header('cache-control', 'public, max-age=0');
        done();
      });
    });

    it('should be reasonable when infinite', function(done){
      var app = connect();

      app.use(pipeline.middleware({ maxAge: Infinity }));

      app.request()
      .get('/todo.js')
      .end(function(res){
        res.should.have.header('cache-control', 'public, max-age=' + 60*60*24*365);
        done();
      });
    });
  });

  describe('when traversing passed root', function(){
    it('should respond with 403 Forbidden', function(done){
      app.request()
      .get('/users/../../todo.js')
      .expect(403, done);
    });
    
    it('should catch urlencoded ../', function(done){
      app.request()
      .get('/users/%2e%2e/%2e%2e/todo.js')
      .expect(403, done);
    });
  });

  describe('on ENOENT', function(){
    it('should next()', function(done){
      app.request()
      .get('/does-not-exist')
      .expect(404, done);
    });
  });

  describe('when a trailing backslash is given', function(){
    it('should 500', function(done){
      app.request()
      .get('/todo.js\\')
      .expect(404, done);
    });
  });

  describe('with a malformed URL', function(){
    it('should respond with 400', function(done){
      app.request()
      .get('/%')
      .expect(400, done);
    });
  });

  describe('on ENAMETOOLONG', function(){
    it('should next()', function(done){
      var path = Array(100).join('foobar');
  
      app.request()
      .get('/' + path)
      .expect(404, done);
    });
  });

  describe('when mounted', function(){
    it('should respond to urls', function(done){
      var app = connect();
      app.use('/static', pipeline.middleware());

      var expected = {
        '/static/todo.js': todos_body,
        '/static/foo%20bar.css': 'baz',
        '/static/users/tobi.txt': 'ferret'
      };

      ASYNC.forEachSeries(Object.keys(expected), function(url, next) {
        app.request()
        .get(url)
        .end(function(res) {
          res.should.have.status(200);
          res.body.should.equal(expected[url]);
          next();
        });
      }, done);
    });
  });


  var types = {
    '/todo.js': 'compiled asset',
    '/users/tobi.txt': 'copied asset'
  };

  Object.keys(types).forEach(function(url) {
    describe('conditional gets ['+types[url]+']', function() {

      it('should provide Etag', function(done) {
        app.request()
        .get(url)
        .end(function(res) {
          res.should.have.status(200);
          res.should.have.header('etag');
          done();
        });
      });

      it('should 304 on Etag for compiled asset', function(done) {
        app.request()
          .get(url)
          .end(function(res) {
            res.should.have.status(200);

            var req = app.request();
            req.header['if-none-match'] = res.headers.etag;
            req.get(url)
            .end(function(res) {
              res.should.have.status(304);
              done();
            });
          });
      });
    });
  });

});

