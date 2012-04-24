/**
 * @module resolve
 * @copyright 2012
 * 
 * API to map module ids to paths and visa-versa.
 * 
 */

var resolve = require('resolve');

/**
 * Maps a module id to a path. Pass options to control various lookup
 * options. Unlike the default resolve, this will also respect 'nap'
 * configs in package.json files.
 * 
 * Options:
 * 
 *   - `extensions` - array of allowed extensions (def: `['.js']`)
 *   - `mainKey` - key for main module in packages. (def: `main`)
 *   - `basedir` - base directory to use for searching. 
 * 
 * @param  {Strong} id   module ID
 * @param  {Hash}   opts Optional. options to control lookup
 * @return {String}      Path, if any
 */
exports.resolve = function(id, opts) {

};

/**
 * Attempts to reverse a path into a module id that can be used from
 * a relevant source. Assumes the id will be used by a calling package.
 * 
 * @param  {String} path path to reverse
 * @param  {Hash}   opts Optionals. same options passed to resolve()
 * @return {String}      module id.
 */
exports.unresolve = function(path, opts) {

};

/**
 * Normalizes an id into a reversable id. Basically this will remove any
 * relative path elements from the module. Useful to ensure you have a 
 * module id that can be consistently mapped.
 * 
 * @param  {String} id         The module id
 * @param  {String} relativeId Optional. relative id to base from
 * @return {String}            normalized id
 */
exports.normalize = function(id, relativeId) {

};
