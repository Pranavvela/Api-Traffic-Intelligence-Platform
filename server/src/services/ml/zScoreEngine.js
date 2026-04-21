'use strict';

const { getMlFeatures } = require('../featureEngineeringService');
const settingsService = require('../settingsService');
const featureCacheService = require('../featureCacheService');
const baselineService = require('../baselineService');
const mlModelRepository = require('../../models/mlModelRepository');
const logger = require('../../utils/logger');

const MIN_TRAINING_SAMPLES = 50;

// 🔥 FEATURE WEIGHTS (important improvement)
const FEATURE_WEIGHTS = {
  requests_per_minute: 2,
  failed_login_count: 3,
  unique_endpoints_hit: 1.5,
  avg_response_time: 1,
  burst_ratio: 3,
  error_rate: 3,
  alert_count: 2,
  blocked_request_count: 2,
};

const modelState = {
  trained: false,
  trainedAt: null,
  sampleCount: 0,
  features: [],
  means: {},
  stds: {},
  threshold: 3,
  windowMs: 60000,
  observationMs: 10000,
  trainingDurationMs: null,
  modelId: null,
  modelVersion: null,
  isActive: false,
};

function numericFeatures() {
  return Object.keys(FEATURE_WEIGHTS);
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

function baselineKey(ip, userId) {
  return `${userId || 'anonymous'}:${ip}`;
}

function resolveStatsForIp(ip, userId) {
  const baseline = baselineService.getBaselines(baselineKey(ip, userId));
  if (baseline) return baseline;
  return { means: modelState.means, stds: modelState.stds };
}

// 🔥 NEW IMPROVED SCORING FUNCTION
function scoreRowWithExplainability(row, keys, means, stds, topN = 3) {
  const contributions = keys.map((k) => {
    const value = Number(row[k] ?? 0);
    const mean = means[k] ?? 0;
    const std = stds[k] || 1e-6;

    const z = Math.abs((value - mean) / std);
    const weight = FEATURE_WEIGHTS[k] || 1;

    return {
      feature: k,
      z: Number(z.toFixed(4)),
      weighted_z: Number((z * weight).toFixed(4)),
      value: Number(value.toFixed(4)),
      mean: Number(mean.toFixed(4)),
      std: Number(std.toFixed(4)),
    };
  });

  // 🔥 MULTI-DIMENSIONAL SCORE (Euclidean norm)
  const sumSquares = contributions.reduce((sum, c) => sum + Math.pow(c.weighted_z, 2), 0);
  const rawScore = Math.sqrt(sumSquares);

  // 🔥 NORMALIZE SCORE (0–1)
  const normalizedScore = 1 - Math.exp(-rawScore);

  contributions.sort((a, b) => b.weighted_z - a.weighted_z);

  return {
    score: Number(rawScore.toFixed(4)),
    normalized_score: Number(normalizedScore.toFixed(4)),
    explainability: {
      top_features: contributions.slice(0, topN),
    },
  };
}

function loadModel(persistedModelData) {
  if (!persistedModelData) return;

  try {
    const snapshot = persistedModelData.model_data || persistedModelData;
    Object.assign(modelState, snapshot, {
      modelId: persistedModelData.id ?? null,
      modelVersion: persistedModelData.model_version ?? null,
      isActive: persistedModelData.is_active ?? false,
    });
    logger.info('ZScore model loaded');
  } catch (err) {
    logger.error('ZScore model load error', { error: err.message });
  }
}

async function train(opts = {}) {
  const start = Date.now();

  const windowMs = opts.windowMs || modelState.windowMs;
  const observationMs = opts.observationMs || modelState.observationMs;

  const rows = await getMlFeatures({ windowMs, observationMs, start: opts.start, end: opts.end, userId: opts.userId });
  const keys = numericFeatures();

  // 🔥 FIX: Minimum data validation
  if (!rows || rows.length < MIN_TRAINING_SAMPLES) {
    return {
      trained: false,
      reason: `Insufficient training data (${rows?.length || 0}). Minimum required: ${MIN_TRAINING_SAMPLES}`,
    };
  }

  const { means, stds } = computeStats(rows, keys);

  // 🔥 FIX: Dynamic threshold (95th percentile approx)
  const scores = rows.map((row) => {
    const { means, stds } = resolveStatsForIp(row.ip, opts.userId);
    const scored = scoreRowWithExplainability(row, keys, means, stds);
    return scored.score;
  });

  scores.sort((a, b) => a - b);
  const dynamicThreshold = scores[Math.floor(scores.length * 0.95)] || 3;

  const trainedAt = new Date().toISOString();

  Object.assign(modelState, {
    trained: true,
    trainedAt,
    sampleCount: rows.length,
    features: keys,
    means,
    stds,
    threshold: dynamicThreshold,
    windowMs,
    observationMs,
    trainingDurationMs: Date.now() - start,
  });

  const persistedModel = await mlModelRepository.saveModel({
    trained: modelState.trained,
    trainedAt: modelState.trainedAt,
    sampleCount: modelState.sampleCount,
    features: modelState.features,
    means: modelState.means,
    stds: modelState.stds,
    threshold: modelState.threshold,
    windowMs: modelState.windowMs,
    observationMs: modelState.observationMs,
    trainingDurationMs: modelState.trainingDurationMs,
  }, 'zscore');

  loadModel(persistedModel);

  return status();
}

function status() {
  return {
    trained: modelState.trained,
    trainedAt: modelState.trainedAt,
    sampleCount: modelState.sampleCount,
    featureCount: modelState.features.length,
    threshold: modelState.threshold,
    windowMs: modelState.windowMs,
    observationMs: modelState.observationMs,
    modelId: modelState.modelId,
    modelVersion: modelState.modelVersion,
    isActive: modelState.isActive,
    engine: 'zscore',
  };
}

async function detect(opts = {}) {
  if (!modelState.trained) return { trained: false, results: [] };

  const rows = await getMlFeatures(opts);
  const keys = modelState.features;

  const results = rows.map((row) => {
    const { means, stds } = resolveStatsForIp(row.ip, opts.userId);
    const scored = scoreRowWithExplainability(row, keys, means, stds);

    const label = scored.score >= modelState.threshold ? 'ANOMALY' : 'NORMAL';

    return {
      ...row,
      anomaly_score: scored.score,
      normalized_score: scored.normalized_score,
      ml_label: label,
      explainability: scored.explainability,
    };
  });

  return { trained: true, results };
}

async function scoreIpWindow(ip, userId) {
  if (!modelState.trained) return null;

  const settings = settingsService.getSettings(userId);
  const windowMs = settings.slidingWindowSeconds * 1000;

  let latest = featureCacheService.getLatestFeaturesForUser(ip, userId);

  if (!latest) {
    const data = await getMlFeatures({ windowMs, ip, userId });
    if (!data?.length) return null;
    latest = data.at(-1);
  }

  const { means, stds } = resolveStatsForIp(ip, userId);
  const scored = scoreRowWithExplainability(latest, modelState.features, means, stds);

  return {
    ip,
    anomaly_score: scored.score,
    normalized_score: scored.normalized_score,
    ml_label: scored.score >= modelState.threshold ? 'ANOMALY' : 'NORMAL',
    explainability: scored.explainability,
  };
}

async function listModels() {
  return mlModelRepository.getAllModels('zscore');
}

async function activateModel(id) {
  const model = await mlModelRepository.activateModel(id, 'zscore');
  if (model) {
    loadModel(model);
  }
  return model;
}

module.exports = { train, detect, status, scoreIpWindow, loadModel, listModels, activateModel };