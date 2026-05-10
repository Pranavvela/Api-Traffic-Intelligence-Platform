"use strict";

const EventEmitter = require('events');

const bus = new EventEmitter();

module.exports = {
  emit: (evt, data) => bus.emit(evt, data),
  on: (evt, cb) => {
    bus.on(evt, cb);
    return () => bus.off(evt, cb);
  },
};
