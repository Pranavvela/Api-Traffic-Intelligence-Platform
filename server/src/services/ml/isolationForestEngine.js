//isolationForestEngine.js - ML engine implementation using Isolation Forest algorithm, with optional delegation to external service if enabled.
'use strict';

const settingsService = require('../settingsService');
const externalEngine = require('./externalEngine');
const zScoreEngine = require('./zScoreEngine');

const ENGINE_NAME = 'isolation-forest';

async function train(opts = {}) {
  if (externalEngine.isExternalEnabled()) {
    return externalEngine.train(opts, ENGINE_NAME);
  }
  return zScoreEngine.train(opts);
}

async function detect(opts = {}) {
  if (externalEngine.isExternalEnabled()) {
    return externalEngine.detect(opts, ENGINE_NAME);
  }
  return zScoreEngine.detect(opts);
}

async function status() {
  if (externalEngine.isExternalEnabled()) {
    return externalEngine.status(ENGINE_NAME);
  }
  const local = zScoreEngine.status();
  return { ...local, engine: ENGINE_NAME, external: false };
}

async function scoreIpWindow(ip, userId) {
  const settings = settingsService.getSettings(userId);
  const windowMs = settings.slidingWindowSeconds * 1000;
  const observationMs = Math.min(10_000, windowMs);

  if (externalEngine.isExternalEnabled()) {
    return externalEngine.scoreIpWindow(ip, windowMs, observationMs, ENGINE_NAME);
  }
  return zScoreEngine.scoreIpWindow(ip, userId);
}

module.exports = { train, detect, status, scoreIpWindow };
