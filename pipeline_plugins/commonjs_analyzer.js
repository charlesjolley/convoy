/**
 * @module commonjs_analyzer
 * @copyright 2012 Charles Jolley
 */

var DETECTIVE = require('detective');
var PATH = require('path');

// modules found here are skipped as requirements. Mostly this includes the 
// builtin modules for node as well as some specific exceptions for jquery 
var EXCEPTIONS = {
  '__node': require('../lib/resolver').core, 
  '__narwhal': { system: true, file: true },
  'jquery': { 
    jsdom: true, xmlhttprequest: true, location: true, navigator: true 
  } 
};

function _extractRequiredModules(asset) {
  var ast, filteredResults = [], results = [];

  results = DETECTIVE(asset.body);
  filteredResults = results.filter(function(moduleId) {
    var exceptions = asset.pkg && EXCEPTIONS[asset.pkg.name];
    var isException = 
        EXCEPTIONS.__node[moduleId] || EXCEPTIONS.__narwhal[moduleId] ||
        (exceptions && exceptions[moduleId]);
    return (!isException);
  });

  return filteredResults;
}

// inspects files for require statements
function CommonJSAnalyzer(asset, context, done) {
  asset.pkg = context.getNearestPackage(asset.path);
  var modules = _extractRequiredModules(asset);
  try {
    asset.dependencies = modules.map(function(moduleId) {
      return context.resolve(moduleId, PATH.dirname(asset.path));
    });
  } catch (e) {
    e.message = e.message +' (required in '+asset.id+')';
    throw e;
  }

  done();
}

module.exports = CommonJSAnalyzer;
