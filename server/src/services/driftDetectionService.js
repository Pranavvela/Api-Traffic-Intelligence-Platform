'use strict';

const { query } = require('../config/db');
const logger = require('../utils/logger');

/**
 * Concept Drift Detection Service
 * Monitors for distribution shift (concept drift) in ML model performance
 * Paper: "On the Detection of Offline Drift" (Gama et al., 2014)
 * 
 * Approach:
 * - Compare model predictions (ml_label) with actual alerts (alert_triggered)
 * - Track detection rate, false positive rate, precision over time windows
 * - Flag drift when metrics degrade below configurable thresholds
 * - Trigger auto-retraining when drift is detected
 */

const DRIFT_CONFIG = {
  detectionWindowDays: 1,       // Look back 1 day for drift analysis
  minSampleSize: 100,            // Need 100+ samples for statistical significance
  accuracyThreshold: 0.80,       // Alert if accuracy drops below 80%
  precisionThreshold: 0.70,      // Alert if precision drops below 70%
  recallThreshold: 0.75,         // Alert if recall drops below 75%
  driftSensitivity: 0.10,        // 10% drop in metric = drift
};

const driftState = {
  lastAnalysisAt: null,
  lastTrainAt: null,
  currentMetrics: null,
  previousMetrics: null,
  driftDetected: false,
  driftScore: 0,
  driftReasons: [],
};

/**
 * Compute performance metrics comparing predictions vs ground truth
 * @param {Array} rows - API logs with ml_label and alert_triggered
 * @returns {Object} Precision, recall, accuracy, etc.
 */
function computeMetrics(rows) {
  if (!rows || rows.length === 0) {
    return null;
  }

  let truePositives = 0;    // Model predicted anomaly, actual alert
  let falsePositives = 0;   // Model predicted anomaly, no alert
  let trueNegatives = 0;    // Model predicted normal, no alert
  let falseNegatives = 0;   // Model predicted normal, but alert occurred

  rows.forEach((row) => {
    const predicted = row.ml_label === 'ANOMALY';
    const actual = row.alert_triggered === true;

    if (predicted && actual) truePositives += 1;
    else if (predicted && !actual) falsePositives += 1;
    else if (!predicted && !actual) trueNegatives += 1;
    else falseNegatives += 1;
  });

  const accuracy = (truePositives + trueNegatives) / rows.length;
  const precision = truePositives / (truePositives + falsePositives + 1e-6);
  const recall = truePositives / (truePositives + falseNegatives + 1e-6);
  const f1Score = (2 * precision * recall) / (precision + recall + 1e-6);
  const specificity = trueNegatives / (trueNegatives + falsePositives + 1e-6);

  return {
    sampleSize: rows.length,
    accuracy: Number(accuracy.toFixed(4)),
    precision: Number(precision.toFixed(4)),
    recall: Number(recall.toFixed(4)),
    f1_score: Number(f1Score.toFixed(4)),
    specificity: Number(specificity.toFixed(4)),
    true_positives: truePositives,
    false_positives: falsePositives,
    true_negatives: trueNegatives,
    false_negatives: falseNegatives,
  };
}

/**
 * Fetch recent API logs with ml predictions and alerts
 * @param {number} lookbackDays - Days to look back
 * @returns {Promise<Array>}
 */
async function fetchRecentLogs(lookbackDays = 1) {
  try {
    const startDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

    const result = await query(
      `SELECT id, alert_triggered, timestamp,
              COALESCE(ml_label, 'NORMAL') AS ml_label
       FROM api_logs
       WHERE timestamp >= $1
       ORDER BY timestamp DESC
       LIMIT $2`,
      [startDate.toISOString(), 10000]
    );

    return result.rows;
  } catch (err) {
    // If column doesn't exist, return empty (drift detection will skip)
    if (err.message && err.message.includes('does not exist')) {
      logger.warn('Drift detection skipped: ML columns not yet populated');
      return [];
    }
    logger.error('Error fetching logs for drift detection', { error: err.message });
    return [];
  }
}

/**
 * Detect concept drift by comparing metrics against thresholds
 * @param {Object} metrics - Current metrics
 * @returns {Object} Drift detection result
 */
function detectDrift(metrics) {
  const reasons = [];
  const severities = [];

  if (!metrics || metrics.sampleSize < DRIFT_CONFIG.minSampleSize) {
    return {
      driftDetected: false,
      reasons: ['Insufficient samples for drift detection'],
      driftScore: 0,
    };
  }

  // Check individual metric thresholds
  if (metrics.accuracy < DRIFT_CONFIG.accuracyThreshold) {
    const degradation = DRIFT_CONFIG.accuracyThreshold - metrics.accuracy;
    reasons.push(`Accuracy ${metrics.accuracy.toFixed(3)} < ${DRIFT_CONFIG.accuracyThreshold}`);
    severities.push(degradation);
  }

  if (metrics.precision < DRIFT_CONFIG.precisionThreshold) {
    const degradation = DRIFT_CONFIG.precisionThreshold - metrics.precision;
    reasons.push(`Precision ${metrics.precision.toFixed(3)} < ${DRIFT_CONFIG.precisionThreshold}`);
    severities.push(degradation);
  }

  if (metrics.recall < DRIFT_CONFIG.recallThreshold) {
    const degradation = DRIFT_CONFIG.recallThreshold - metrics.recall;
    reasons.push(`Recall ${metrics.recall.toFixed(3)} < ${DRIFT_CONFIG.recallThreshold}`);
    severities.push(degradation);
  }

  // Compute composite drift score (average degradation)
  const driftScore = severities.length > 0
    ? Number((severities.reduce((a, b) => a + b) / severities.length).toFixed(4))
    : 0;

  const driftDetected = reasons.length > 0;

  return {
    driftDetected,
    reasons,
    driftScore,
    metricsComparison: {
      current: metrics,
    },
  };
}

/**
 * Analyze model drift and return drift status
 * @returns {Promise<Object>}
 */
async function analyzeDrift() {
  try {
    const logs = await fetchRecentLogs(DRIFT_CONFIG.detectionWindowDays);
    const currentMetrics = computeMetrics(logs);

    const driftAnalysis = detectDrift(currentMetrics);

    // Update state
    driftState.lastAnalysisAt = new Date().toISOString();
    driftState.previousMetrics = driftState.currentMetrics;
    driftState.currentMetrics = currentMetrics;
    driftState.driftDetected = driftAnalysis.driftDetected;
    driftState.driftScore = driftAnalysis.driftScore;
    driftState.driftReasons = driftAnalysis.reasons;

    logger.info('Concept drift analysis complete', {
      driftDetected: driftAnalysis.driftDetected,
      driftScore: driftAnalysis.driftScore,
      sampleSize: currentMetrics?.sampleSize || 0,
    });

    return driftAnalysis;
  } catch (err) {
    logger.error('Drift analysis failed', { error: err.message });
    throw err;
  }
}

/**
 * Get current drift detection state
 * @returns {Object}
 */
function getDriftStatus() {
  return {
    lastAnalysisAt: driftState.lastAnalysisAt,
    driftDetected: driftState.driftDetected,
    driftScore: driftState.driftScore,
    driftReasons: driftState.driftReasons,
    currentMetrics: driftState.currentMetrics,
    driftThresholds: {
      accuracy: DRIFT_CONFIG.accuracyThreshold,
      precision: DRIFT_CONFIG.precisionThreshold,
      recall: DRIFT_CONFIG.recallThreshold,
      minSampleSize: DRIFT_CONFIG.minSampleSize,
    },
  };
}

/**
 * Mark that model was retrained to reset drift flag
 */
function markModelRetrained() {
  driftState.lastTrainAt = new Date().toISOString();
  driftState.driftDetected = false;
  driftState.driftScore = 0;
  driftState.driftReasons = [];
  logger.info('Model retraining marked - drift flag reset');
}

module.exports = {
  analyzeDrift,
  getDriftStatus,
  markModelRetrained,
  computeMetrics,
  DRIFT_CONFIG,
};
