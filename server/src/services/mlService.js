// mlService.js - ML engine selector and unified interface.
'use strict';

const zScoreEngine = require('./ml/zScoreEngine');
const isolationForestEngine = require('./ml/isolationForestEngine');
const externalEngine = require('./ml/externalEngine');
const config = require('../config/config');
const logger = require('../utils/logger');

const engineName = String(process.env.ML_ENGINE || '').toLowerCase();
const hasExternal = externalEngine.isExternalEnabled();

function selectEngine() {
  if (engineName === 'isolation-forest' || engineName === 'isolation_forest') {
    return isolationForestEngine;
  }

  if (engineName === 'external' && hasExternal) {
    return {
      train: (opts) => externalEngine.train(opts, 'external'),
      detect: (opts) => externalEngine.detect(opts, 'external'),
      status: () => externalEngine.status('external'),
      scoreIpWindow: (ip) => {
        const windowMs = config.detection.windowSizeMs;
        const observationMs = Math.min(10_000, windowMs);
        return externalEngine.scoreIpWindow(ip, windowMs, observationMs, 'external');
      },
      loadModel: (modelData) => {
        // External engine doesn't use loadModel, but provide stub for consistency
        logger.debug('External ML engine does not use loadModel');
      },
    };
  }

  if (hasExternal && config.ml?.serviceUrl) {
    return isolationForestEngine;
  }

  return zScoreEngine;
}

const engine = selectEngine();

/**
 * Load a previously trained ML model.
 * This is called during server startup to restore the trained model.
 * Currently only zScoreEngine supports persistence; other engines are stubs.
 *
 * @param {Object} modelData - The persisted model data object
 */
function loadModel(modelData) {
  if (engine.loadModel && typeof engine.loadModel === 'function') {
    engine.loadModel(modelData);
  } else {
    logger.debug('ML engine does not support loadModel', { engine: engineName || 'zscore' });
  }
}

async function listModels() {
  if (engine.listModels && typeof engine.listModels === 'function') {
    return engine.listModels();
  }

  return [];
}

async function activateModel(id) {
  if (engine.activateModel && typeof engine.activateModel === 'function') {
    return engine.activateModel(id);
  }

  return null;
}

module.exports = {
  train: (opts) => engine.train(opts),
  detect: (opts) => engine.detect(opts),
  status: () => engine.status(),
  scoreIpWindow: (ip, userId) => engine.scoreIpWindow(ip, userId),
  loadModel,
  listModels,
  activateModel,
};
