/**
 * Utility methods
 * @copyright 2012 Charles Jolley
 */

/**
 * Runs the passed function once, caching the return value for future calls.
 * 
 * @param  {Function} fn function to run
 * @return {Function}     wrapped function
 */
exports.once = function(fn) {
  var pending = [], args, running;
  return function(done) {
    if (args) return done.apply(this, args);
    pending.push(done);
    if (!running) {
      running = true;
      fn(function() {
        args = Array.prototype.slice.call(arguments);
        if (!pending) {
          throw new Error('fn callback invoked more than once');
        }
        pending.forEach(function(done) { done.apply(this, args); });
        pending = null;
      });
    }
  };
};

exports.extend = function(dst, src) {
  Object.keys(src).forEach(function(key) { dst[key] = src[key]; });
};

exports.values = function(obj) {
  return Object.keys(obj).map(function(key) { return obj[key]; });
};

