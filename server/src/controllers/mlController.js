'use strict';

const { getMlFeatures } = require('../services/featureEngineeringService');
const mlService = require('../services/mlService');

/**
 * GET /ml/features
 * Returns engineered feature vectors for ML training.
 */
async function getFeatures(req, res, next) {
  try {
    const windowMs = parseInt(req.query.windowMs, 10) || 60_000;
    const observationMs = parseInt(req.query.observationMs, 10) || 10_000;
    const { start, end, ip } = req.query;

    const data = await getMlFeatures({ windowMs, observationMs, start, end, ip });
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /ml/export
 * Returns feature-engineered dataset (JSON rows).
 */
async function exportFeatures(req, res, next) {
  try {
    const windowMs = parseInt(req.query.windowMs, 10) || 60_000;
    const observationMs = parseInt(req.query.observationMs, 10) || 10_000;
    const { start, end, ip } = req.query;

    const data = await getMlFeatures({ windowMs, observationMs, start, end, ip });
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /ml/train
 */
async function trainModel(req, res, next) {
  try {
    const { windowMs, observationMs, threshold, start, end } = req.body || {};
    const data = await mlService.train({ windowMs, observationMs, threshold, start, end });
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
    const data = await mlService.detect({ windowMs, observationMs, start, end, ip, threshold });
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

module.exports = { getFeatures, exportFeatures, trainModel, detectAnomalies, getStatus };
