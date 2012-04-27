/**
 * @module loader
 * @copyright 2012 Charles Jolley
 * 
 * This is the module loader that is included client side. It doesn't actually
 * run well in node.
 */
/*jshint evil:true */

// Variables and function names are truncated to minimize final size.
// Uglify for some reason doesn't want to rename the variables and functions.
// Hopefully can fix this one day.
// 
module.exports = function(g, k) { // g = global, k = key
  var pr = g[k]; // previous global
  var ms  = {}; // modules
  var df  = {}; // defined
  var al  = {}; // aliases

  // error()
  function er(message, Type) {
    if (!Type) Type = Error;
    throw new Type(message);
  }

  // dirname()
  function dn(id) {
    var idx = id.lastIndexOf('/');
    return idx<0 ? '' : (idx===0 ? '/' : id.slice(0,idx));
  }

  // basename()
  function bn(id) {
    var idx = id.lastIndexOf('/');
    return idx<0 ? id : id.slice(idx+1);
  }

  // findNextTerm() - recursive processing of paths
  function nt(working, callingId, id) {
    var term = bn(working), 
        ret  = dn(working);

    if (ret === '') {
      if (callingId && (term === '.' || term === '..')) {
        ret = dn(callingId);
      }
    } else if (ret !== '/') {
      ret = nt(ret, callingId, id);
    }

    if (term === '..') {
      if (ret === '' || ret === '/') {
        er('Invalid module id ' + id);
      }
      ret = dn(ret);
    } else if (term !== '.' && term !== '') {
      ret = ret === '' ? term : ret+'/'+term;
    }

    return ret;
  } 

  // normalize() id
  function nm(id, callingId) {
    return id.indexOf('.')<0 ? id : nt(id, callingId, id);
  }

  // search()
  // looks for alternative ids if the default one is not found. Returns the
  // id itself.
  function sc(id) {
    if (ms[id] || df[id]) return id;
    if (al[id]) return al[id];
    var tmp = id+'/index';
    return (ms[tmp] || df[tmp]) ? tmp : id;
  }

  // makeRequire()
  function mr(callingId) {
    var fn = function(id) {
      id = sc(nm(id, callingId));

      // aliases may be defined along with the module to deal with conflicts.
      id = 
        (df[callingId] && df[callingId].aliases && df[callingId].aliases[id]) ||
        id;

      var mod = ms[id]; 
      if (mod) {
        if (callingId && ms[callingId].children.indexOf(mod)<0) {
          ms[callingId].children.push(mod);
        }
        return mod.exports;
      }

      var body = df[id] && df[id].body;
      if (!body) er('module not found ' + id);
      if ('string' === typeof body) body = eval(body);

      ms[id] = mod = {
        id: id,
        exports: {},
        require: mr(id),
        loaded:  false,
        parent:  ms[callingId],
        children: []
      };

      body(mod.require, mod.exports, mod);
      mod.loaded = true;

      if (callingId) ms[callingId].children.push(mod);
      return mod.exports;
    };

    return fn;
  }

  // $mod global
  var md = {
    modules: ms,
    defined: df,
    aliases: al,

    define: function(id, body, options) {

      if (!options) options = {};
      options.body = body;

      if ('string' === typeof id) {
        df[id] = options;
      } else {
        df[id[0]] = options;
        for(var idx=1, len = id.length; idx<len; idx++) {
          al[id[idx]] = id[0];
        }
      }
    },

    normalize: nm,

    noConflict: function() {
      g[k] = pr;
      return md;
    }
  };

  md.require = mr();

  // only replace global if it doesn't look like an existing loader. 
  // this way the loader can appear more than once in a JS file and it won't
  // clobber previously loaded modules.
  if (!g[k] || !(g[key].require) || !(g[k].define)) {
    g[k] = md;
    g.require = md.require;
  }
};


