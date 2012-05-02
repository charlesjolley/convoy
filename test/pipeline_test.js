/**
 * @module pipeline_test
 * @copyright 2012 Charles Jolley
 */

var should = require('should');
var h  = require('./support/helpers');
var lib = h.lib;
var FS  = require('fs');
var PATH = require('path');

RegExp.escape = function(text) {
    return text.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, "\\$&");
};

function testmodules(data) {
  var idx, len = arguments.length;

  var lines = data.split('\n'), regex;

  function processLine(line) {
    line.should.match(regex);
  }

  function filterLines(moduleName) {
    return function(line) { 
      return line.indexOf('"'+moduleName+'"')>=0; 
    };
  }  
  
  for(idx=1;idx<len;idx++) {
    var moduleName = RegExp.escape(arguments[idx]);
    regex = new RegExp('define\\(.*\\"' + moduleName +
      '\\".+\\"\\(function\\(.+@module\\s+' + moduleName);

    var filteredLines = lines.filter(filterLines(arguments[idx]));

    filteredLines.length.should.not.equal(0, arguments[idx]);
    filteredLines.forEach(processLine);
  }

}

function testcss(data) {
  var regex = [], idx, len = arguments.length;
  for(idx=1;idx<len;idx++) {
    regex = new RegExp('@module\\s+' + RegExp.escape(arguments[idx]));
    data.should.match(regex);
  }
}


describe('[unit] pipeline', function() {

  var inst, buildir, cnt=1;

  beforeEach(function() {
    inst = new lib.Pipeline({
      'app.js': {
        packager: 'javascript',
        main:     h.fixture('sample_app')
      },

      'app.css': {
        packager: 'css',
        main:     h.fixture('sample_app/styles')
      },

      'built_assets': { // make dirname different
        packager: 'copy',
        root:     h.fixture('sample_app/assets')
      }
    });

    buildir = h.tmpfile('public_'+cnt++) ;
  });

  describe('writing', function() {

    it('should build javascript', function(done) {
      var path = PATH.resolve(buildir, 'app.js');

      h.mkdirSync_p(buildir);
      inst.writeFile('app.js', buildir, function(err) {
        if (err) return done(err);
        PATH.existsSync(path).should.equal(true);
        testmodules(FS.readFileSync(path, 'utf8'),
          'jquery/lib/jquery',
          'ember/view',
          'ember/core',
          'ember/model',
          'ember/application',
          'sample_app/app/main',
          'sample_app/app/core',
          'sample_app/app/views/main_view',
          'sample_app/app/templates/main_template',
          'sample_app/app/models/person');
        done();
      });
    });

    it("should build css" , function(done) {
      var path    = PATH.resolve(buildir, 'app.css');
      h.mkdirSync_p(buildir);
      inst.writeFile('app.css', buildir, function(err) {
        if (err) return done(err);
        PATH.existsSync(path).should.equal(true);
        testcss(FS.readFileSync(path, 'utf8'),
          'bootstrap/styles/reset/type',
          'bootstrap/styles/reset/body',
          'bootstrap/styles/reset/index',
          'bootstrap/styles/addon',
          'bootstrap/styles/index',
          'sample_app/styles/global',
          'sample_app/styles/models',
          'sample_app/styles/index');
        done();
      });
    });

    it("should copy individual assets", function(done) {
      var path = PATH.resolve(buildir, 'built_assets/index.html');
      inst.writeFile('built_assets/index.html', buildir, function(err) {
        if (err) return done(err);
        PATH.existsSync(path).should.equal(true, path);
        done();
      });
    });

    it("should return error when directory is passed", function(done) {
      inst.on('error', function() {}); // prevent exception
      inst.writeFile('built_assets', buildir, function(err) {
        should.exist(err);
        done();
      });
    });

    it("should build all assets for writeAll", function(done) {
      inst.writeAll(buildir, function(err) {
        if (err) return done(err);
        ['app.js', 'app.css', 
          'built_assets/index.html', 
          'built_assets/images/a.png', 
        'built_assets/images/b.png'].forEach(function(file) {
          PATH.existsSync(PATH.resolve(buildir, file)).should.equal(true, file);
        });
        done();
      });
    });

    it("should be able to run copy rules in parallel", function(done){
      inst = new lib.Pipeline({
        'images': {
          packager: 'copy',
          root: h.fixture('sample_app/assets/images')
        },

        'index.html': {
          packager: 'copy',
          root: h.fixture('sample_app/assets/index.html')
        }
      });

      inst.writeAll(buildir, function(err) {
        if (err) return done(err);
        ['index.html', 'images/a.png', 'images/b.png'].forEach(function(file) {
          PATH.existsSync(PATH.resolve(buildir, file)).should.equal(true, file);
        });
        done();
      });
    });

  });

  describe('[unit] pipeline exists', function() {

    it('should find packaged assets exist', function(done) {
      inst.exists('app.js', function(exists) {
        exists.should.equal(true);
        done();
      });
    });

    it('should find copied assets exists', function(done) {
      inst.exists('built_assets/index.html', function(exists) {
        exists.should.equal(true);
        done();
      });
    });

    it('should not find missing assets', function(done) {
      inst.exists('imaginary/foo/app.css', function(exists) {
        exists.should.equal(false);
        done();
      });
    });

    it('should not find missing assets inside copied areas', function(done) {
      inst.exists('built_assets/imaginary_asset.jpg', function(exists) {
        exists.should.equal(false);
        done();
      });
    });

  });

  describe('[unit] pipeline build', function() {

    it('should build javascript', function(done) {

      inst.build('app.js', function(err, asset) {
        if (err) return done(err);
        asset.path.should.equal('app.js');
        asset.type.should.equal('application/javascript');
        testmodules(asset.body,
          'jquery/lib/jquery',
          'ember/view',
          'ember/core',
          'ember/model',
          'ember/application',
          'sample_app/app/main',
          'sample_app/app/core',
          'sample_app/app/views/main_view',
          'sample_app/app/templates/main_template',
          'sample_app/app/models/person');
        done();
      });
    });

    it("should build css" , function(done) {
      inst.build('app.css', function(err, asset) {
        if (err) return done(err);
        asset.should.have.property('path','app.css');
        asset.should.have.property('type', 'text/css');
        testcss(asset.body,
          'bootstrap/styles/index',
          'bootstrap/styles/addon',
          'bootstrap/styles/reset/index',
          'bootstrap/styles/reset/body',
          'bootstrap/styles/reset/type',
          'sample_app/styles/global',
          'sample_app/styles/models',
          'sample_app/styles/index');
        done();
      });
    });

    it("should copy individual assets", function(done) {
      inst.build('built_assets/index.html', function(err, asset) {
        if (err) return done(err);
        asset.should.have.property('path','built_assets/index.html');
        asset.should.have.property('type', 'text/html');
        asset.should.have.property('bodyPath', 
          h.fixture('sample_app/assets/index.html'));
        done();
      });
    });

    it("should return error for directory", function(done) {
      inst.on('error', function() {}); // prevent exception
      inst.build('built_assets', function(err, asset) {
        should.exist(err);
        done();
      });
    });
  });

});

