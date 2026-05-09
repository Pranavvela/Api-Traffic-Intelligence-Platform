// mlService.js - ML engine selector and unified interface.
'use strict';

const zScoreEngine = require('./ml/zScoreEngine');
const isolationForestEngine = require('./ml/isolationForestEngine');
const ensembleEngine = require('./ml/ensembleEngine');
const externalEngine = require('./ml/externalEngine');
const driftDetectionService = require('./driftDetectionService');
const config = require('../config/config');
const logger = require('../utils/logger');

// 🔥 AUTO-ENABLED FEATURES (no manual config needed):
const ENABLE_ENSEMBLE = true;              // Always use ensemble for robustness
const ENABLE_DRIFT_MONITORING = true;      // Auto-detect model degradation
const DRIFT_CHECK_INTERVAL_MS = 300000;    // Check every 5 minutes
const ENABLE_AUTO_RETRAIN = true;          // Auto-retrain when drift detected

let driftCheckInterval = null;

function selectEngine() {
  // 🔥 ALWAYS USE ENSEMBLE (most robust)
  if (ENABLE_ENSEMBLE) {
    return ensembleEngine;
  }

  const engineName = String(process.env.ML_ENGINE || '').toLowerCase();
  const hasExternal = externalEngine.isExternalEnabled();

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
        logger.debug('External ML engine does not use loadModel');
      },
    };
  }

  if (hasExternal && config.ml?.serviceUrl) {
    return isolationForestEngine;
  }

  return zScoreEngine;
}

/**
 * Start automated drift monitoring background job
 */
function startDriftMonitoring() {
  if (!ENABLE_DRIFT_MONITORING || driftCheckInterval) return;

  driftCheckInterval = setInterval(async () => {
    try {
      const driftStatus = await driftDetectionService.analyzeDrift();
      
      if (driftStatus.driftDetected) {
        logger.warn('🚨 Concept drift detected!', {
          driftScore: driftStatus.driftScore,
          reasons: driftStatus.reasons,
        });

        if (ENABLE_AUTO_RETRAIN) {
          logger.info('⚡ Auto-retraining model due to drift...');
          try {
            const trainResult = await engine.train({});
            if (trainResult.trained) {
              driftDetectionService.markModelRetrained();
              logger.info('✅ Model successfully retrained');
            }
          } catch (err) {
            logger.error('❌ Auto-retrain failed', { error: err.message });
          }
        }
      }
    } catch (err) {
      logger.error('Drift monitoring error', { error: err.message });
    }
  }, DRIFT_CHECK_INTERVAL_MS);

  logger.info('✅ Drift monitoring started', {
    interval_ms: DRIFT_CHECK_INTERVAL_MS,
    auto_retrain: ENABLE_AUTO_RETRAIN,
  });
}

function stopDriftMonitoring() {
  if (driftCheckInterval) {
    clearInterval(driftCheckInterval);
    driftCheckInterval = null;
  }
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
    logger.debug('ML engine does not support loadModel');
  }
}

function initializeAutomatedFeatures() {
  if (ENABLE_DRIFT_MONITORING) {
    startDriftMonitoring();
  }

  logger.info('🔥🔥🔥 ALL AUTOMATED ML FEATURES INITIALIZED 🔥🔥🔥', {
    ensemble_detection: ENABLE_ENSEMBLE,
    online_learning: 'ENABLED',
    enhanced_explainability: 'ENABLED',
    concept_drift_monitoring: ENABLE_DRIFT_MONITORING,
    auto_retrain_on_drift: ENABLE_AUTO_RETRAIN,
    drift_check_interval_sec: DRIFT_CHECK_INTERVAL_MS / 1000,
  });
}

function shutdown() {
  stopDriftMonitoring();
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
  initializeAutomatedFeatures,
  shutdown,
  startDriftMonitoring,
  stopDriftMonitoring,
};
