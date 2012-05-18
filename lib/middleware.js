/**
 * @module pipeline middleware
 * 
 * Exposes connect middleware for a pipeline.
 */

var HTTP = require('http');
var PATH = require('path');
var URL  = require('url');
var MIME = require('mime');
var FS   = require('fs');

function decode(path){
  try {
    return decodeURIComponent(path);
  } catch (err) {
    return err;
  }
}

function httpError(code){
  var err = new Error(HTTP.STATUS_CODES[code]);
  err.status = code;
  return err;
}

function setHeader(res, name, value) {
  if (!res.getHeader(name)) res.setHeader(name, value);
}

function getSize(asset) {
  return asset.size || asset.body.length; // TODO: fix for real UTF8
}

function prepareEtag(connect, asset, done) {
  if (asset.etag) return done();
  if (asset.body) {
    asset.etag = connect.utils.md5(asset.body);
    done();
  } else {
    FS.readFile(asset.bodyPath, function(err, data) {
      if (err) return done(err);
      asset.etag = connect.utils.md5(data);
      done();
    });
  }
}

function send(req, res, options, next) {
  var connect = require('connect');
  var pipeline = options.pipeline;
  var maxAge   = options.maxAge || 0;
  var ranges   = req.headers.range;

  if (Infinity === maxAge) maxAge = 60 * 60 * 24 * 365 * 1000; // infinity = 1yr
  if (options.callback) next = options.callback; // allow override of next
  if (options.getOnly && ['GET', 'HEAD'].indexOf(req.method)<0) return next();

  var url  = URL.parse(options.path);
  var path = decode(url.pathname);
  var type;

  // handle invalid URLs and malformed requests
  if (path instanceof URIError) return next(httpError(400));
  //if (~path.indexOf('\0')) return next(httpError(400));
  
  // check for traversing above root
  if ('/' === path[path.length-1]) path += 'index.html';
  path = PATH.relative('/base', PATH.normalize(PATH.join('/base', path)));
  if (~path.indexOf('..')) return next(httpError(403));

  if (!options.hidden && ('.' === PATH.basename(path).charAt(0))) {
    return next();
  }

  pipeline.exists(path, function(exists) {
    if (!exists) return next(); // not found in pipeline - next middleware...
    pipeline.build(path, function(err, asset) {
      // TODO: conditional GET support
      if (err || !(asset.body || asset.bodyPath)) {
        return next(httpError(500)); // TODO: better error
      }

      // header fields
      setHeader(res, 'Date', new Date().toUTCString());
      setHeader(res, 'Cache-Control', 'public, max-age=' + (maxAge/1000));
      if (asset.mtime) {
        setHeader(res, 'Last-Modified', new Date(asset.mtime).toUTCString());
      }

      var type = asset.type;
      var charset = MIME.charsets.lookup(type);
      if (charset && charset.length>0) type = type + '; charset=' + charset;
      res.setHeader('Content-Type', type);

      var len = getSize(asset);
      if (asset.bodyType) res.setHeader('Content-Length', len);

      prepareEtag(connect, asset, function(err) {
        if (err) return next(err);
        res.setHeader('ETag', asset.etag);

        if (connect.utils.conditionalGET(req)) {
          if (!connect.utils.modified(req, res)) {
            res.removeHeader('ETag');
            return connect.utils.notModified(res);
          }
        }

        if ('HEAD' === req.method) return res.end();

        // return body
        if (asset.bodyPath) {
          var stream = FS.createReadStream(asset.bodyPath);
          req.emit('static', stream);
          req.on('close', stream.destroy.bind(stream));
          stream.pipe(res);
          stream.on('error', function(err) {
            if (req.headerSent) {
              console.error(err.stack);
              req.destroy();
            } else {
              next(err);
            }
          });

        } else {
          res.end(asset.body);
        }

      });

    });
  });
}

// attach to Pipeline.prototype
function middleware(options) {
  if (!options) options = {};
  options.pipeline = this;

  return function(req, res, next) {
    options.path = req.url;
    options.getOnly = true;
    send(req, res, options, next);
  };
}

exports.middleware = middleware;
exports.send = send;
