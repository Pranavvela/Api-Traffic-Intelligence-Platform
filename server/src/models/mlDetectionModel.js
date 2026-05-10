'use strict';

const { query } = require('../config/db');
const logger = require('../utils/logger');
const eventBus = require('../services/eventBus');

async function insertDetectionResult(result = {}) {
  const {
    userId = null,
    ip = null,
    y_true = 0,
    anomaly_score = 0,
    y_pred = 0,
    zscore_score = null,
    isolation_forest_score = null,
    ensemble_confidence = null,
  } = result;

  try {
    const res = await query(
      `INSERT INTO ml_detection_results
        (user_id, ip, y_true, anomaly_score, y_pred, zscore_score, isolation_forest_score, ensemble_confidence, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
       RETURNING *;`,
      [userId, ip, y_true, anomaly_score, y_pred, zscore_score, isolation_forest_score, ensemble_confidence]
    );
    // Publish ML detection event for live updates
    try {
      if (res && res.rows && res.rows[0]) {
        eventBus.emit('ml_detection', res.rows[0]);
      }
    } catch (e) {
      logger.warn('Failed to publish ml_detection event', { error: e.message });
    }
    return res.rows[0];
  } catch (err) {
    logger.error('Failed to insert ML detection result', { error: err.message });
    return null;
  }
}

module.exports = {
  insertDetectionResult,
};
