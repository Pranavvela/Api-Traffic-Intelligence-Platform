'use strict';

const zScoreEngine = require('./zScoreEngine');
const isolationForestEngine = require('./isolationForestEngine');
const logger = require('../../utils/logger');

/**
 * Ensemble Anomaly Detection Engine
 * Combines multiple anomaly detection engines with weighted voting
 * Paper: "Ensemble Methods in Machine Learning" (Breiman, 2000)
 * 
 * Approach:
 * - Run detection with both Z-Score and Isolation Forest engines
 * - Average their anomaly scores with configurable weights
 * - Require agreement for higher confidence anomalies
 * - Return combined explainability from both engines
 */

const ENSEMBLE_CONFIG = {
  zscoreWeight: 0.6,              // Z-Score gets 60% weight (more interpretable)
  isolationForestWeight: 0.4,     // Isolation Forest gets 40% weight
  requireAgreement: false,         // If true, only flag if both detect anomaly
  agreementThreshold: 0.5,        // Both scores must be > threshold for agreement
};

async function trainEnsemble(opts = {}) {
  try {
    const zscoreResult = await zScoreEngine.train(opts);
    const ifResult = await isolationForestEngine.train(opts);

    return {
      trained: zscoreResult.trained && ifResult.trained,
      zscore: zscoreResult,
      isolationForest: ifResult,
      ensemble_info: 'Both engines trained successfully',
    };
  } catch (err) {
    logger.error('Ensemble training failed', { error: err.message });
    throw err;
  }
}

async function detectEnsemble(opts = {}) {
  try {
    const zscoreResults = await zScoreEngine.detect(opts);
    const ifResults = await isolationForestEngine.detect(opts);

    if (!zscoreResults.trained || !ifResults.trained) {
      return { trained: false, results: [] };
    }

    // Merge results by combining scores and explainability
    const merged = mergeDetectionResults(zscoreResults.results, ifResults.results, opts);

    return {
      trained: true,
      results: merged,
      ensemble_info: {
        methods_used: ['zscore', 'isolation_forest'],
        score_weights: ENSEMBLE_CONFIG,
      },
    };
  } catch (err) {
    logger.error('Ensemble detection failed', { error: err.message });
    return { trained: false, results: [], error: err.message };
  }
}

function mergeDetectionResults(zscoreRows, ifRows, opts) {
  const rowMap = new Map();

  // Index z-score results
  zscoreRows.forEach((row) => {
    const key = `${row.ip}:${row.endpoint}:${row.window_start}`;
    rowMap.set(key, {
      ...row,
      zscore_score: row.anomaly_score,
      zscore_label: row.ml_label,
      zscore_explainability: row.explainability,
      if_score: null,
      if_label: null,
      if_explainability: null,
    });
  });

  // Merge isolation forest results
  ifRows.forEach((ifRow) => {
    const key = `${ifRow.ip}:${ifRow.endpoint}:${ifRow.window_start}`;
    const existing = rowMap.get(key);

    if (existing) {
      existing.if_score = ifRow.anomaly_score;
      existing.if_label = ifRow.ml_label;
      existing.if_explainability = ifRow.explainability;
    } else {
      rowMap.set(key, {
        ...ifRow,
        zscore_score: null,
        zscore_label: null,
        zscore_explainability: null,
        if_score: ifRow.anomaly_score,
        if_label: ifRow.ml_label,
        if_explainability: ifRow.explainability,
      });
    }
  });

  // Compute ensemble scores and labels
  const merged = Array.from(rowMap.values()).map((row) => {
    const zScore = row.zscore_score ?? 0;
    const ifScore = row.if_score ?? 0;

    // Weighted average of scores
    const ensembleScore =
      zScore * ENSEMBLE_CONFIG.zscoreWeight +
      ifScore * ENSEMBLE_CONFIG.isolationForestWeight;

    // Determine label based on agreement or individual thresholds
    const zscoreAnomaly = row.zscore_label === 'ANOMALY';
    const ifAnomaly = row.if_label === 'ANOMALY';
    const agreement = zscoreAnomaly && ifAnomaly;

    let ensembleLabel = 'NORMAL';
    if (ENSEMBLE_CONFIG.requireAgreement) {
      ensembleLabel = agreement ? 'ANOMALY' : 'NORMAL';
    } else {
      // Flag if either method detects high confidence anomaly
      ensembleLabel =
        ensembleScore >= ENSEMBLE_CONFIG.agreementThreshold ? 'ANOMALY' : 'NORMAL';
    }

    return {
      ip: row.ip,
      endpoint: row.endpoint,
      window_start: row.window_start,
      user_id: row.user_id,
      anomaly_score: Number(ensembleScore.toFixed(4)),
      ml_label: ensembleLabel,
      ensemble_agreement: agreement,
      method_agreement_score: computeAgreementScore(zscoreAnomaly, ifAnomaly),
      explainability: {
        zscore: {
          score: Number(zScore.toFixed(4)),
          label: row.zscore_label || 'N/A',
          explanation: row.zscore_explainability,
        },
        isolation_forest: {
          score: Number(ifScore.toFixed(4)),
          label: row.if_label || 'N/A',
          explanation: row.if_explainability,
        },
        ensemble_decision: {
          weight_zscore: ENSEMBLE_CONFIG.zscoreWeight,
          weight_if: ENSEMBLE_CONFIG.isolationForestWeight,
          final_score: Number(ensembleScore.toFixed(4)),
          agreement_required: ENSEMBLE_CONFIG.requireAgreement,
          both_agree: agreement,
        },
      },
    };
  });

  return merged;
}

function computeAgreementScore(zscore, ifAnomaly) {
  if (zscore && ifAnomaly) return 1.0;      // Both agree - high confidence
  if (zscore || ifAnomaly) return 0.5;      // Partial agreement
  return 0.0;                                // No agreement
}

async function statusEnsemble() {
  const zscoreStatus = await zScoreEngine.status();
  const ifStatus = await isolationForestEngine.status();

  return {
    ensemble: true,
    methods: {
      zscore: zscoreStatus,
      isolation_forest: ifStatus,
    },
    config: ENSEMBLE_CONFIG,
  };
}

async function scoreIpWindowEnsemble(ip, userId) {
  const zscoreScore = await zScoreEngine.scoreIpWindow(ip, userId);
  const ifScore = await isolationForestEngine.scoreIpWindow(ip, userId);

  if (!zscoreScore && !ifScore) return null;

  const zScore = zscoreScore?.anomaly_score ?? 0;
  const ifScoreValue = ifScore?.anomaly_score ?? 0;

  const ensembleScore =
    zScore * ENSEMBLE_CONFIG.zscoreWeight +
    ifScoreValue * ENSEMBLE_CONFIG.isolationForestWeight;

  return {
    ip,
    ensemble_score: Number(ensembleScore.toFixed(4)),
    ensemble_label: ensembleScore >= ENSEMBLE_CONFIG.agreementThreshold ? 'ANOMALY' : 'NORMAL',
    zscore_component: {
      score: Number(zScore.toFixed(4)),
      label: zscoreScore?.ml_label || 'N/A',
    },
    if_component: {
      score: Number(ifScoreValue.toFixed(4)),
      label: ifScore?.ml_label || 'N/A',
    },
  };
}

module.exports = {
  train: trainEnsemble,
  detect: detectEnsemble,
  status: statusEnsemble,
  scoreIpWindow: scoreIpWindowEnsemble,
};
