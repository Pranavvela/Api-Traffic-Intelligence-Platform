'use strict';

const LEVELS = new Set(['debug', 'info', 'warn', 'error']);

function nowIso() {
  return new Date().toISOString();
}

function safeSerialize(value) {
  try {
    return JSON.stringify(value);
  } catch (err) {
    return '"[unserializable]"';
  }
}

function log(level, message, meta) {
  const normalized = LEVELS.has(level) ? level : 'info';
  const payload = {
    timestamp: nowIso(),
    level: normalized,
    message: String(message || ''),
  };

  if (meta && typeof meta === 'object') {
    payload.meta = meta;
  }

  const output = safeSerialize(payload);

  if (normalized === 'error') {
    console.error(output);
  } else if (normalized === 'warn') {
    console.warn(output);
  } else {
    console.log(output);
  }
}

function info(message, meta) {
  log('info', message, meta);
}

function warn(message, meta) {
  log('warn', message, meta);
}

function error(message, meta) {
  log('error', message, meta);
}

function debug(message, meta) {
  log('debug', message, meta);
}

module.exports = {
  log,
  info,
  warn,
  error,
  debug,
};
