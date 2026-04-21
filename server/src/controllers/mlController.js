'use strict';

const { getMlFeatures } = require('../services/featureEngineeringService');
const mlService = require('../services/mlService');

function readFeatureQuery(req) {
  return {
    windowMs: Number.parseInt(req.query.windowMs, 10) || 60_000,
    observationMs: Number.parseInt(req.query.observationMs, 10) || 10_000,
    start: req.query.start,
    end: req.query.end,
    ip: req.query.ip,
    userId: req.user?.id || null,
  };
}

async function sendFeatureRows(req, res, next) {
  try {
    const data = await getMlFeatures(readFeatureQuery(req));
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /ml/features
 * Returns engineered feature vectors for ML training.
 */
async function getFeatures(req, res, next) {
  return sendFeatureRows(req, res, next);
}

/**
 * GET /ml/export
 * Returns feature-engineered dataset (JSON rows).
 */
async function exportFeatures(req, res, next) {
  return sendFeatureRows(req, res, next);
}

/**
 * POST /ml/train
 */
async function trainModel(req, res, next) {
  try {
    const { windowMs, observationMs, threshold, start, end } = req.body || {};
    const userId = req.user?.id || null;
    const data = await mlService.train({ windowMs, observationMs, threshold, start, end, userId });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /ml/detect
 */
async function detectAnomalies(req, res, next) {
  try {
    const { windowMs, observationMs, start, end, ip, threshold } = req.query;
    const userId = req.user?.id || null;
    const data = await mlService.detect({ windowMs, observationMs, start, end, ip, threshold, userId });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /ml/status
 */
async function getStatus(_req, res, next) {
  try {
    const data = await mlService.status();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listModels(_req, res, next) {
  try {
    const data = await mlService.listModels();
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
}

async function activateModel(req, res, next) {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid model id.', code: 'INVALID_MODEL_ID' });
    }

    const data = await mlService.activateModel(id);
    if (!data) {
      return res.status(404).json({ success: false, message: 'Model not found.', code: 'MODEL_NOT_FOUND' });
    }

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = { getFeatures, exportFeatures, trainModel, detectAnomalies, getStatus, listModels, activateModel };
