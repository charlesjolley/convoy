/**
 * @module loader
 * @copyright 2012 Charles Jolley
 * 
 * This is the module loader that is included client side. It doesn't actually
 * run well in node.
 */
/*jshint evil:true */

module.exports = function(global, name) {
  var previous = global[name];
  var modules  = {};
  var defined  = {};

  function error(message, Type) {
    if (!Type) Type = Error;
    throw new Type(message);
  }

  function normalize(id, callingId) {
    // TODO: expand ID.
    return id;
  }

  function makeRequire(callingId) {
    var fn = function(id) {
      id = normalize(id, callingId);
      var ret = modules[id]; 
      if (ret) return ret;

      var body = defined[id];
      if (!body) error('module not found ' + id);
      if ('string' === typeof body) body = eval(body);

      ret = {};
      var mod = {
        id: id,
        exports: ret
      };

      // TODO: catch circular references
      modules[id] = ret;
      body(makeRequire(id), ret, mod);
      modules[id] = mod.exports;

      return ret;
    };

    // TODO: setup rest
    return fn;
  }

  var $mod = {
    modules: modules,
    defined: defined,

    define: function(id, body) {
      defined[id] = body;
    },

    noConflict: function() {
      global[name] = previous;
      return $mod;
    }
  };

  $mod.require = makeRequire();

  global[name] = $mod;
};
