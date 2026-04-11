'use strict';

const { getMlFeatures } = require('./featureEngineeringService');
const settingsService = require('./settingsService');
const config = require('../config/config');

const ML_SERVICE_URL = config.ml?.serviceUrl || '';
const LOCAL_ENGINE = 'zscore';
const EXTERNAL_ENGINE = 'isolation-forest';

const modelState = {
  trained: false,
  trainedAt: null,
  sampleCount: 0,
  features: [],
  means: {},
  stds: {},
  threshold: 3.0,
  windowMs: 60000,
  observationMs: 10000,
  trainingDurationMs: null,
};

function numericFeatures() {
  return [
    'requests_per_minute',
    'failed_login_count',
    'unique_endpoints_hit',
    'avg_response_time',
    'burst_ratio',
    'error_rate',
    'alert_count',
    'blocked_request_count',
  ];
}

function isExternalEnabled() {
  return Boolean(ML_SERVICE_URL);
}

async function externalRequest(path, options = {}) {
  const url = new URL(path, ML_SERVICE_URL);
  const response = await fetch(url.toString(), {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`ML service error (${response.status}): ${text || response.statusText}`);
  }

  const payload = await response.json().catch(() => ({}));
  return payload?.data ?? payload;
}

function computeStats(rows, keys) {
  const means = {};
  const stds = {};

  keys.forEach((k) => {
    const values = rows.map((r) => Number(r[k] ?? 0));
    const mean = values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1);
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / Math.max(values.length, 1);
    means[k] = Number(mean.toFixed(6));
    stds[k] = Number(Math.sqrt(variance).toFixed(6)) || 1e-6;
  });

  return { means, stds };
}

function scoreRow(row, keys, means, stds) {
  return scoreRowWithExplainability(row, keys, means, stds).score;
}

function scoreRowWithExplainability(row, keys, means, stds, topN = 3) {
  const contributions = keys.map((k) => {
    const value = Number(row[k] ?? 0);
    const mean = means[k] ?? 0;
    const std = stds[k] || 1e-6;
    const z = Math.abs((value - mean) / std);
    return {
      feature: k,
      z: Number(z.toFixed(4)),
      value: Number(value.toFixed(4)),
      mean: Number(mean.toFixed(4)),
      std: Number(std.toFixed(4)),
    };
  });

  contributions.sort((a, b) => b.z - a.z);
  const score = contributions[0]?.z || 0;

  return {
    score: Number(score.toFixed(4)),
    explainability: {
      top_features: contributions.slice(0, topN),
    },
  };
}

async function train(opts = {}) {
  if (isExternalEnabled()) {
    return externalRequest('/train', { method: 'POST', body: opts });
  }

  const start = Date.now();
  const windowMs = opts.windowMs || modelState.windowMs;
  const observationMs = opts.observationMs || modelState.observationMs;
  const threshold = Number(opts.threshold || modelState.threshold);

  const rows = await getMlFeatures({ windowMs, observationMs, start: opts.start, end: opts.end });
  const keys = numericFeatures();

  if (!rows || rows.length === 0) {
    return { trained: false, reason: 'No feature rows available for training.' };
  }

  const { means, stds } = computeStats(rows, keys);

  modelState.trained = true;
  modelState.trainedAt = new Date().toISOString();
  modelState.trainingDurationMs = Date.now() - start;
  modelState.sampleCount = rows.length;
  modelState.features = keys;
  modelState.means = means;
  modelState.stds = stds;
  modelState.threshold = threshold;
  modelState.windowMs = windowMs;
  modelState.observationMs = observationMs;

  const currentStatus = await status();
  return { ...currentStatus, trained: true };
}

async function status() {
  if (isExternalEnabled()) {
    try {
      const remote = await externalRequest('/status');
      return {
        ...remote,
        external: true,
        engine: EXTERNAL_ENGINE,
      };
    } catch (err) {
      return {
        trained: false,
        external: true,
        engine: EXTERNAL_ENGINE,
        error: err.message,
      };
    }
  }

  return {
    trained: modelState.trained,
    trainedAt: modelState.trainedAt,
    sampleCount: modelState.sampleCount,
    featureCount: modelState.features.length,
    threshold: modelState.threshold,
    windowMs: modelState.windowMs,
    observationMs: modelState.observationMs,
    trainingDurationMs: modelState.trainingDurationMs,
    external: false,
    engine: LOCAL_ENGINE,
  };
}

async function detect(opts = {}) {
  if (isExternalEnabled()) {
    return externalRequest('/detect', { method: 'POST', body: opts });
  }

  if (!modelState.trained) {
    return { trained: false, results: [] };
  }

  const windowMs = opts.windowMs || modelState.windowMs;
  const observationMs = opts.observationMs || modelState.observationMs;
  const threshold = Number(opts.threshold || modelState.threshold);

  const rows = await getMlFeatures({ windowMs, observationMs, start: opts.start, end: opts.end, ip: opts.ip });
  const keys = modelState.features;

  const results = rows.map((row) => {
    const scored = scoreRowWithExplainability(row, keys, modelState.means, modelState.stds);
    const score = scored.score;
    const label = score >= threshold ? 'ANOMALY' : 'NORMAL';
    return {
      ...row,
      anomaly_score: score,
      ml_label: label,
      explainability: scored.explainability,
    };
  });

  return { trained: true, results, threshold };
}

async function scoreIpWindow(ip) {
  if (isExternalEnabled()) {
    const settings = settingsService.getSettings();
    const windowMs = settings.slidingWindowSeconds * 1000;
    const observationMs = Math.min(modelState.observationMs, windowMs);
    const data = await externalRequest('/detect', {
      method: 'POST',
      body: { windowMs, observationMs, ip },
    }).catch(() => null);

    const results = data?.results || data?.data || data;
    if (!Array.isArray(results) || results.length === 0) return null;

    const latest = results[results.length - 1];
    return {
      ip,
      window_start: latest.window_start,
      anomaly_score: latest.anomaly_score,
      ml_label: latest.ml_label,
      threshold: latest.threshold || modelState.threshold,
      explainability: latest.explainability || null,
    };
  }

  if (!modelState.trained) return null;
  const settings = settingsService.getSettings();
  const windowMs = settings.slidingWindowSeconds * 1000;
  const observationMs = Math.min(modelState.observationMs, windowMs);
  const data = await getMlFeatures({ windowMs, observationMs, ip });
  if (!data || data.length === 0) return null;

  const latest = data[data.length - 1];
  const scored = scoreRowWithExplainability(latest, modelState.features, modelState.means, modelState.stds);
  const score = scored.score;
  const label = score >= modelState.threshold ? 'ANOMALY' : 'NORMAL';

  return {
    ip,
    window_start: latest.window_start,
    anomaly_score: score,
    ml_label: label,
    threshold: modelState.threshold,
    explainability: scored.explainability,
  };
}

module.exports = {
  train,
  detect,
  status,
  scoreIpWindow,
};
