/**
 * @module pipelinr
 * @copyright 2012 Charles Jolley
 * 
 * Main entry point for library.
 */

var ASSET_PACKAGER = require('./ASSET_PACKAGER');
exports.AssetPackager      = ASSET_PACKAGER.AssetPackager;
exports.JavaScriptCompiler = ASSET_PACKAGER.JavaScriptCompiler;
exports.JavaScriptAnalyzer = ASSET_PACKAGER.JavaScriptAnalyzer;
exports.SimpleMergeLinker  = ASSET_PACKAGER.SimpleMergeLinker;

