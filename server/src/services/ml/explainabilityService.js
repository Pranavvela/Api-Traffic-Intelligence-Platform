'use strict';

const logger = require('../../utils/logger');

/**
 * Enhanced Explainability Service for ML anomaly scores
 * Provides SHAP-style feature contribution breakdown showing:
 * - Individual feature deviations from baseline
 * - Cumulative impact percentages
 * - Feature interaction effects
 * 
 * Paper: "A Unified Approach to Interpreting Model Predictions" (Lundberg & Lee, NIPS 2017)
 */

/**
 * Compute detailed feature contribution breakdown
 * @param {Object} row - Feature row with values
 * @param {Array} keys - Feature names
 * @param {Object} means - Baseline means
 * @param {Object} stds - Baseline std devs
 * @param {Object} weights - Feature weights
 * @returns {Object} Detailed explainability breakdown
 */
function computeFeatureContributions(row, keys, means, stds, weights) {
  const contributions = [];
  let totalWeightedZ = 0;

  // Compute individual contributions
  keys.forEach((k) => {
    const value = Number(row[k] ?? 0);
    const mean = means[k] ?? 0;
    const std = stds[k] || 1e-6;
    const weight = weights[k] || 1;

    const z = Math.abs((value - mean) / std);
    const weighted_z = z * weight;
    const deviation_pct = Math.abs((value - mean) / (mean + 1e-6)) * 100;

    contributions.push({
      feature: k,
      value: Number(value.toFixed(2)),
      baseline: Number(mean.toFixed(2)),
      deviation: Number((value - mean).toFixed(2)),
      deviation_pct: Number(deviation_pct.toFixed(2)),
      z_score: Number(z.toFixed(4)),
      weighted_contribution: Number(weighted_z.toFixed(4)),
      weight: weight,
      anomaly_probability: Math.min(1, z / 3),  // Normalized 0-1 probability
    });

    totalWeightedZ += weighted_z * weighted_z;
  });

  // Sort by impact
  contributions.sort((a, b) => b.weighted_contribution - a.weighted_contribution);

  // Calculate cumulative impact percentages
  const cumulativeSum = contributions.reduce((sum, c) => sum + Math.abs(c.weighted_contribution), 0);
  let cumulativePct = 0;
  contributions.forEach((c) => {
    const impact = (Math.abs(c.weighted_contribution) / (cumulativeSum + 1e-6)) * 100;
    c.impact_pct = Number(impact.toFixed(2));
    cumulativePct += impact;
    c.cumulative_impact_pct = Number(cumulativePct.toFixed(2));
  });

  // Detect feature interactions (when multiple features spike together)
  const interactingFeatures = detectInteractions(contributions, 1.5);

  return {
    contributions,
    totalAnomalyScore: Number(Math.sqrt(totalWeightedZ).toFixed(4)),
    topContributors: contributions.slice(0, 3).map(c => c.feature),
    featureInteractions: interactingFeatures,
    summary: generateSummary(contributions),
  };
}

/**
 * Detect feature interactions (coordinated anomalies)
 * @param {Array} contributions - Sorted contributions
 * @param {number} threshold - Interaction threshold
 * @returns {Array} Interaction details
 */
function detectInteractions(contributions, threshold = 1.5) {
  const interactions = [];
  const highContributors = contributions.filter(c => c.z_score > threshold);

  if (highContributors.length >= 2) {
    for (let i = 0; i < highContributors.length - 1; i++) {
      for (let j = i + 1; j < highContributors.length; j++) {
        const combined_z = highContributors[i].z_score + highContributors[j].z_score;
        interactions.push({
          features: [highContributors[i].feature, highContributors[j].feature],
          combined_z_score: Number(combined_z.toFixed(4)),
          interaction_type: classifyInteractionType(combined_z),
        });
      }
    }
  }

  return interactions;
}

/**
 * Classify interaction strength
 * @param {number} combined_z - Combined z-score
 * @returns {string} Classification
 */
function classifyInteractionType(combined_z) {
  if (combined_z > 6) return 'CRITICAL_COORDINATION';
  if (combined_z > 4) return 'STRONG_COORDINATION';
  if (combined_z > 2) return 'MODERATE_COORDINATION';
  return 'WEAK_INTERACTION';
}

/**
 * Generate human-readable explanation summary
 * @param {Array} contributions - Feature contributions
 * @returns {string} Summary text
 */
function generateSummary(contributions) {
  if (contributions.length === 0) return 'No anomalies detected.';

  const top3 = contributions.slice(0, 3);
  const topFeatures = top3.map((c, i) => 
    `${i + 1}. ${c.feature} (${c.impact_pct.toFixed(1)}% impact, +${c.deviation_pct.toFixed(1)}% deviation)`
  ).join('; ');

  return `Top anomalous features: ${topFeatures}`;
}

/**
 * Score explanation with full breakdown
 * @param {Object} row - Feature row
 * @param {Array} keys - Feature names
 * @param {Object} means - Baseline means
 * @param {Object} stds - Baseline stds
 * @param {Object} weights - Feature weights
 * @returns {Object} Complete explanation object
 */
function explainScore(row, keys, means, stds, weights) {
  const contributions = computeFeatureContributions(row, keys, means, stds, weights);

  return {
    ...contributions,
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  computeFeatureContributions,
  detectInteractions,
  generateSummary,
  explainScore,
};
