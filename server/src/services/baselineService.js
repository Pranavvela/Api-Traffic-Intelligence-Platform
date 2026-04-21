'use strict';

const { createKvStore } = require('./store');

const FEATURE_KEYS = [
  'requests_per_minute',
  'failed_login_count',
  'unique_endpoints_hit',
  'avg_response_time',
  'burst_ratio',
  'error_rate',
  'alert_count',
  'blocked_request_count',
];

const baselines = createKvStore();

function ensureEntry(subject) {
  let entry = baselines.get(subject);
  if (!entry) {
    entry = { stats: {}, lastUpdatedMs: Date.now() };
    baselines.set(subject, entry);
  }
  return entry;
}

function updateFeature(entry, feature, value) {
  const v = Number(value) || 0;
  const current = entry.stats[feature] || { count: 0, mean: 0, m2: 0 };

  current.count += 1;
  const delta = v - current.mean;
  current.mean += delta / current.count;
  const delta2 = v - current.mean;
  current.m2 += delta * delta2;

  entry.stats[feature] = current;
}

function updateFromFeatures(subject, features) {
  if (!features) return;
  const entry = ensureEntry(subject);

  FEATURE_KEYS.forEach((key) => {
    updateFeature(entry, key, features[key]);
  });

  entry.lastUpdatedMs = Date.now();
  baselines.set(subject, entry);
}

function getBaselines(subject) {
  const entry = baselines.get(subject);
  if (!entry) return null;

  const means = {};
  const stds = {};

  FEATURE_KEYS.forEach((key) => {
    const stat = entry.stats[key];
    if (!stat || stat.count < 2) return;
    const variance = stat.m2 / (stat.count - 1);
    means[key] = Number(stat.mean.toFixed(6));
    stds[key] = Number(Math.sqrt(variance).toFixed(6)) || 1e-6;
  });

  if (Object.keys(means).length === 0) return null;
  return { means, stds };
}

module.exports = { updateFromFeatures, getBaselines };
