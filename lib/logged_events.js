/**
 * @module LoggedEventEmitter
 * @copyright 2012 Charles Jolley
 * 
 * Extends event emitter to include logging method. You can also attach a 
 * logger property which will output any logged events. The pipeLogger() 
 * method allows you to pipe logging events from one object to another.
 * 
 * This is the base class for Pipeline and AssetPackager.
 * 
 */

var EventEmitter = require('events').EventEmitter;

function LoggedEventEmitter() {
  EventEmitter.call(this);
}

LoggedEventEmitter.prototype = Object.create(EventEmitter.prototype);


/**
 * Emits a warning event, to be logged.
 * 
 * @return {void}
 */
LoggedEventEmitter.prototype.warn = function() {
  var args = Array.prototype.slice.call(arguments);
  var logger = this.logger;
  if (logger) logger.warn.apply(logger, args);
  args.unshift('warn');
  this.emit.apply(this, args);
};

/**
 * Emits an error event, to be logged.
 * 
 * @return {void}
 */
LoggedEventEmitter.prototype.error = function() {
  var args = Array.prototype.slice.call(arguments);
  var logger = this.logger;
  if (logger) logger.error.apply(logger, args);
  if (this.listeners('error').length>0) {
    args.unshift('error');
    this.emit.apply(this, args);
  }
};

/**
 * Emits an info event, to be logged.
 * 
 * @return {void}
 */
LoggedEventEmitter.prototype.info = function() {
  var args = Array.prototype.slice.call(arguments);
  var logger = this.logger;
  if (logger) logger.info.apply(logger, args);
  args.unshift('info');
  this.emit.apply(this, args);
};

// alias log
LoggedEventEmitter.prototype.log = LoggedEventEmitter.prototype.info;

/**
 * Pipes a logging events from the passed object to the current one. Adds an
 * optional prefix.
 * 
 * @param  {LoggedEventEmitter} loggedEmitter emitter to connect
 * @param {String}              prefix        optional. prefixed to log
 */
LoggedEventEmitter.prototype.pipeLogging = function(loggedEmitter, prefix) {

  function makeHandler(self, logType) {
    if (prefix) {
      return function() {
        var args = Array.prototype.slice.call(arguments);
        args.unshift(prefix);
        self[logType].apply(self, args);
      };
    } else {
      return function() {
        self[logType].apply(self, arguments);
      };
    }
  }

  loggedEmitter.on('warn', makeHandler(this, 'warn'));
  loggedEmitter.on('error', makeHandler(this, 'error'));
  loggedEmitter.on('info', makeHandler(this, 'info'));
};

exports.LoggedEventEmitter = LoggedEventEmitter;

