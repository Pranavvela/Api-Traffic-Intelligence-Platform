'use strict';

const axios = require('axios');
const sw = require('./slidingWindowService');
const settingsService = require('./settingsService');
const { listRegisteredApis } = require('../models/registeredApiModel');
const logger = require('../utils/logger');

const userPolicyCache = new Map();
const apiMetricsStore = new Map();
const runtimePolicyOverrides = new Map();

const POLICY_REFRESH_MS = 60_000;
const HEALTH_SPIKE_FACTOR = Number.parseFloat(process.env.API_HEALTH_SPIKE_FACTOR || '1.75');
const HEALTH_ERROR_THRESHOLD = Number.parseFloat(process.env.API_HEALTH_ERROR_THRESHOLD || '0.2');

const SENSITIVITY_MULTIPLIER = {
  LOW: 0.8,
  MEDIUM: 1,
  HIGH: 1.25,
};

function normalizeSensitivityLevel(value) {
  const normalized = String(value || 'MEDIUM').toUpperCase();
  if (normalized === 'LOW' || normalized === 'HIGH') return normalized;
  return 'MEDIUM';
}

function toPolicyRow(row) {
  const endpoint = String(row.endpoint || '').trim();
  const hasOverride = row.rate_limit_override !== undefined && row.rate_limit_override !== null;
  const parsedOverride = hasOverride ? Number(row.rate_limit_override) : Number.NaN;
  const parsedThreshold = Number(row.threshold);

  let rateLimitOverride = null;
  if (Number.isFinite(parsedOverride)) {
    rateLimitOverride = parsedOverride;
  } else if (Number.isFinite(parsedThreshold)) {
    rateLimitOverride = parsedThreshold;
  }

  const hasMonitoringFlag = row.monitoring_enabled === undefined || row.monitoring_enabled === null;
  const hasActiveFlag = row.is_active === undefined || row.is_active === null;
  let monitoringEnabled = true;
  if (!hasMonitoringFlag) {
    monitoringEnabled = Boolean(row.monitoring_enabled);
  } else if (!hasActiveFlag) {
    monitoringEnabled = Boolean(row.is_active);
  }

  return {
    id: row.id,
    name: row.name || endpoint,
    endpoint,
    method: String(row.method || 'GET').toUpperCase(),
    sensitivityLevel: normalizeSensitivityLevel(row.sensitivity_level),
    rateLimitOverride,
    monitoringEnabled,
  };
}

function runtimePolicyKey(userId, endpoint, method) {
  const normalizedUserId = String(userId || '');
  const normalizedEndpoint = String(endpoint || '').trim();
  const normalizedMethod = String(method || '*').toUpperCase();
  return `${normalizedUserId}:${normalizedMethod}:${normalizedEndpoint}`;
}

function upsertRuntimeApiPolicy(userId, endpoint, method, config = {}) {
  if (!userId) return null;

  const key = runtimePolicyKey(userId, endpoint, method);
  const existing = runtimePolicyOverrides.get(key) || {};

  const next = { ...existing };
  if (config.sensitivityLevel) {
    next.sensitivityLevel = normalizeSensitivityLevel(config.sensitivityLevel);
  }
  if (config.rateLimitOverride !== undefined && config.rateLimitOverride !== null) {
    next.rateLimitOverride = config.rateLimitOverride;
  }
  if (config.monitoringEnabled !== undefined && config.monitoringEnabled !== null) {
    next.monitoringEnabled = Boolean(config.monitoringEnabled);
  }

  runtimePolicyOverrides.set(key, next);
  return next;
}

function removeRuntimeApiPolicy(userId, endpoint, method) {
  if (!userId) return;
  runtimePolicyOverrides.delete(runtimePolicyKey(userId, endpoint, method));
}

function getRuntimeApiPolicy(userId, endpoint, method) {
  if (!userId) return null;

  const direct = runtimePolicyOverrides.get(runtimePolicyKey(userId, endpoint, method));
  if (direct) return direct;
  return runtimePolicyOverrides.get(runtimePolicyKey(userId, endpoint, '*')) || null;
}

function cachePolicyRows(rows = []) {
  const policyCache = new Map();
  for (const row of rows) {
    const policy = toPolicyRow(row);
    if (!policy.endpoint) continue;
    policyCache.set(`${policy.method}:${policy.endpoint}`, policy);
    policyCache.set(`*:${policy.endpoint}`, policy);
  }
  return policyCache;
}

async function refreshPolicyCache(userId) {
  if (!userId) return new Map();

  try {
    const rows = await listRegisteredApis(userId);
    const policyCache = cachePolicyRows(rows);
    userPolicyCache.set(userId, {
      loadedAt: Date.now(),
      cache: policyCache,
    });
    return policyCache;
  } catch (err) {
    logger.warn('Failed to refresh API policy cache', { error: err.message });
    return new Map();
  }
}

async function getPolicyCache(userId) {
  if (!userId) return new Map();

  const current = userPolicyCache.get(userId);
  if (current && Date.now() - current.loadedAt < POLICY_REFRESH_MS) {
    return current.cache;
  }

  return refreshPolicyCache(userId);
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || '0.0.0.0';
}

function extractTargetUrl(req) {
  const queryUrl = typeof req.query?.url === 'string' ? req.query.url.trim() : '';
  const pathUrl = typeof req.params?.[0] === 'string' ? req.params[0].trim() : '';
  const rawTarget = queryUrl || pathUrl;

  if (!rawTarget) {
    return {
      ok: false,
      status: 400,
      message: 'Missing target URL. Use /proxy/<url> or /proxy?url=<url>.',
    };
  }

  let decoded;
  try {
    decoded = decodeURIComponent(rawTarget);
  } catch (err) {
    logger.debug('Proxy URL decode failed', { error: err.message });
    return {
      ok: false,
      status: 400,
      message: 'Malformed target URL encoding.',
    };
  }

  let parsed;
  try {
    parsed = new URL(decoded);
  } catch (err) {
    logger.debug('Proxy URL parse failed', { error: err.message });
    return {
      ok: false,
      status: 400,
      message: 'Invalid target URL format.',
    };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      ok: false,
      status: 400,
      message: 'Only http and https target URLs are allowed.',
    };
  }

  return { ok: true, url: parsed.toString() };
}

function buildForwardHeaders(req) {
  const headers = { ...req.headers };

  delete headers.host;
  delete headers.connection;
  delete headers['content-length'];

  const clientIp = getClientIp(req);
  headers['x-forwarded-for'] = clientIp;

  return headers;
}

function buildForwardParams(req) {
  const params = { ...req.query };
  delete params.url;
  return params;
}

function getPayloadBytes(payload) {
  if (payload === null || payload === undefined) return 0;
  if (Buffer.isBuffer(payload)) return payload.length;
  if (payload instanceof ArrayBuffer) return payload.byteLength;
  if (ArrayBuffer.isView(payload)) return payload.byteLength;
  if (typeof payload === 'string') return Buffer.byteLength(payload);

  try {
    return Buffer.byteLength(JSON.stringify(payload));
  } catch (err) {
    logger.debug('Payload size estimation failed', { error: err.message });
    return 0;
  }
}

function statusCategory(statusCode) {
  if (statusCode >= 500) return '5xx';
  if (statusCode >= 400) return '4xx';
  if (statusCode >= 300) return '3xx';
  if (statusCode >= 200) return '2xx';
  return '1xx';
}

function defaultApiPolicy(targetUrl, method) {
  return {
    id: null,
    name: targetUrl.origin,
    endpoint: targetUrl.origin,
    method: method.toUpperCase(),
    sensitivityLevel: 'MEDIUM',
    rateLimitOverride: null,
    monitoringEnabled: true,
  };
}

function mergePolicyWithRuntime(policy, targetUrl, method, userId) {
  const runtime = getRuntimeApiPolicy(userId, targetUrl.toString(), method) ||
    getRuntimeApiPolicy(userId, targetUrl.origin, method) ||
    getRuntimeApiPolicy(userId, policy.endpoint, policy.method);

  if (!runtime) return policy;

  const merged = { ...policy };
  if (runtime.sensitivityLevel) {
    merged.sensitivityLevel = normalizeSensitivityLevel(runtime.sensitivityLevel);
  }
  if (runtime.rateLimitOverride !== undefined && runtime.rateLimitOverride !== null) {
    merged.rateLimitOverride = runtime.rateLimitOverride;
  }
  if (runtime.monitoringEnabled !== undefined && runtime.monitoringEnabled !== null) {
    merged.monitoringEnabled = Boolean(runtime.monitoringEnabled);
  }
  return merged;
}

function findPolicyForTarget(urlString, method, userId, policyCache) {
  const targetUrl = new URL(urlString);
  const methodKey = String(method || 'GET').toUpperCase();
  const directMethodKey = `${methodKey}:${targetUrl.toString()}`;
  const directWildcardKey = `*:${targetUrl.toString()}`;

  if (policyCache.has(directMethodKey)) {
    return mergePolicyWithRuntime(policyCache.get(directMethodKey), targetUrl, methodKey, userId);
  }
  if (policyCache.has(directWildcardKey)) {
    return mergePolicyWithRuntime(policyCache.get(directWildcardKey), targetUrl, methodKey, userId);
  }

  for (const policy of policyCache.values()) {
    if (policy.method !== methodKey && policy.method !== '*') continue;
    if (!policy.endpoint) continue;

    if (targetUrl.toString().startsWith(policy.endpoint) || targetUrl.origin === policy.endpoint) {
      return mergePolicyWithRuntime(policy, targetUrl, methodKey, userId);
    }
  }

  return mergePolicyWithRuntime(defaultApiPolicy(targetUrl, methodKey), targetUrl, methodKey, userId);
}

function metricsKeyFromPolicy(policy, targetUrl, userId) {
  if (policy.id !== null && policy.id !== undefined) {
    return `user:${userId}:api:${policy.id}`;
  }
  return `user:${userId}:api:${targetUrl.origin}`;
}

function getOrCreateApiMetrics(policy, targetUrl, userId) {
  const key = metricsKeyFromPolicy(policy, targetUrl, userId);
  if (apiMetricsStore.has(key)) {
    return { key, metrics: apiMetricsStore.get(key) };
  }

  const metrics = {
    key,
    apiName: policy.name || targetUrl.origin,
    endpoint: policy.endpoint || targetUrl.origin,
    sensitivityLevel: policy.sensitivityLevel,
    monitoringEnabled: policy.monitoringEnabled,
    rateLimitOverride: policy.rateLimitOverride,
    totalRequests: 0,
    totalAlerts: 0,
    totalErrors: 0,
    total5xx: 0,
    totalAnomalyScore: 0,
    avgAnomalyScore: 0,
    errorPercentage: 0,
    avgResponseMs: 0,
    baselineResponseMs: 0,
    recentResponseMs: 0,
    healthStatus: 'HEALTHY',
    riskScore: 0,
    statusCategoryCounts: {
      '1xx': 0,
      '2xx': 0,
      '3xx': 0,
      '4xx': 0,
      '5xx': 0,
    },
    lastStatusCategory: '2xx',
    lastPayloadBytes: 0,
    lastUpdatedAt: null,
  };

  apiMetricsStore.set(key, metrics);
  return { key, metrics };
}

function computeLatencyAnomalyScore(metrics, responseMs) {
  if (!metrics.baselineResponseMs || metrics.baselineResponseMs <= 0) return 0;
  const spike = responseMs / metrics.baselineResponseMs;
  if (spike <= 1.2) return 0;
  return Number(Math.min(100, (spike - 1) * 25).toFixed(2));
}

function deriveHealthStatus(metrics) {
  const errorRate = metrics.errorPercentage / 100;
  const responseSpike = metrics.baselineResponseMs > 0
    ? metrics.recentResponseMs / metrics.baselineResponseMs
    : 1;

  if (errorRate >= HEALTH_ERROR_THRESHOLD) {
    return 'UNHEALTHY';
  }

  if (responseSpike >= HEALTH_SPIKE_FACTOR) {
    return 'DEGRADED';
  }

  return 'HEALTHY';
}

function recomputeRiskScore(metrics) {
  const sensitivityMultiplier = SENSITIVITY_MULTIPLIER[metrics.sensitivityLevel] || 1;
  const base = metrics.totalAlerts + metrics.avgAnomalyScore + metrics.errorPercentage;
  let healthPenalty = 0;
  if (metrics.healthStatus === 'UNHEALTHY') {
    healthPenalty = 20;
  } else if (metrics.healthStatus === 'DEGRADED') {
    healthPenalty = 10;
  }
  return Number(((base + healthPenalty) * sensitivityMultiplier).toFixed(2));
}

function updateApiMetrics(policy, targetUrl, outcome, userId) {
  const { metrics } = getOrCreateApiMetrics(policy, targetUrl, userId);

  metrics.apiName = policy.name || metrics.apiName;
  metrics.endpoint = policy.endpoint || metrics.endpoint;
  metrics.sensitivityLevel = policy.sensitivityLevel;
  metrics.monitoringEnabled = policy.monitoringEnabled;
  metrics.rateLimitOverride = policy.rateLimitOverride;

  metrics.totalRequests += 1;
  if (outcome.statusCode >= 400) metrics.totalErrors += 1;
  if (outcome.statusCode >= 500) metrics.total5xx += 1;

  metrics.errorPercentage = Number(((metrics.totalErrors / metrics.totalRequests) * 100).toFixed(2));

  const category = statusCategory(outcome.statusCode);
  metrics.statusCategoryCounts[category] += 1;
  metrics.lastStatusCategory = category;
  metrics.lastPayloadBytes = outcome.payloadBytes;

  // EWMA: baseline is slower moving, recent is faster moving.
  if (metrics.baselineResponseMs <= 0) {
    metrics.baselineResponseMs = outcome.responseMs;
  } else {
    metrics.baselineResponseMs = Number((metrics.baselineResponseMs * 0.95 + outcome.responseMs * 0.05).toFixed(2));
  }

  if (metrics.recentResponseMs <= 0) {
    metrics.recentResponseMs = outcome.responseMs;
  } else {
    metrics.recentResponseMs = Number((metrics.recentResponseMs * 0.8 + outcome.responseMs * 0.2).toFixed(2));
  }

  metrics.avgResponseMs = Number(
    ((metrics.avgResponseMs * (metrics.totalRequests - 1) + outcome.responseMs) / metrics.totalRequests).toFixed(2)
  );

  const anomalyScore = computeLatencyAnomalyScore(metrics, outcome.responseMs);
  metrics.totalAnomalyScore += anomalyScore;
  metrics.avgAnomalyScore = Number((metrics.totalAnomalyScore / metrics.totalRequests).toFixed(2));

  if (anomalyScore >= 20 || outcome.statusCode >= 500) {
    metrics.totalAlerts += 1;
  }

  metrics.healthStatus = deriveHealthStatus(metrics);
  metrics.riskScore = recomputeRiskScore(metrics);
  metrics.lastUpdatedAt = new Date().toISOString();
}

function applyPerApiPolicy(req, policy, targetUrl) {
  if (!policy.monitoringEnabled) {
    return null;
  }

  if (!Number.isFinite(policy.rateLimitOverride) || policy.rateLimitOverride <= 0) {
    return null;
  }

  const userId = req.user?.id || null;
  const settings = settingsService.getSettings(userId);
  const ip = getClientIp(req);
  const rateKey = `api_policy_rate:${userId}:${targetUrl.origin}:${targetUrl.pathname}:${ip}`;

  sw.record(rateKey);
  const count = sw.count(rateKey, settings.slidingWindowSeconds * 1000);
  if (count <= policy.rateLimitOverride) {
    return null;
  }

  return {
    ok: false,
    status: 429,
    data: {
      success: false,
      message: 'Per-API rate limit exceeded.',
      detail: {
        api: policy.name || policy.endpoint,
        threshold: policy.rateLimitOverride,
        observed: count,
      },
    },
    headers: {
      'content-type': 'application/json',
    },
    policy,
  };
}

async function forwardRequest(req) {
  const targetResult = extractTargetUrl(req);
  if (!targetResult.ok) {
    return {
      ok: false,
      status: targetResult.status,
      data: {
        success: false,
        message: targetResult.message,
      },
    };
  }

  const method = req.method;
  const headers = buildForwardHeaders(req);
  const params = buildForwardParams(req);
  const hasBody = !['GET', 'HEAD'].includes(method.toUpperCase());
  const userId = req.user?.id || null;
  const targetUrl = new URL(targetResult.url);
  const policyCache = await getPolicyCache(userId);
  const policy = findPolicyForTarget(targetResult.url, method, userId, policyCache);

  const policyRejection = applyPerApiPolicy(req, policy, targetUrl);
  if (policyRejection) {
    updateApiMetrics(policy, targetUrl, {
      statusCode: policyRejection.status,
      responseMs: 0,
      payloadBytes: getPayloadBytes(policyRejection.data),
    }, userId);

    return {
      ok: false,
      status: policyRejection.status,
      data: policyRejection.data,
      headers: policyRejection.headers,
      proxyMeta: {
        api: policy.name,
        sensitivityLevel: policy.sensitivityLevel,
        monitoringEnabled: policy.monitoringEnabled,
        rateLimitOverride: policy.rateLimitOverride,
        statusCategory: statusCategory(policyRejection.status),
      },
    };
  }

  const startedAt = Date.now();

  try {
    const response = await axios({
      method,
      url: targetResult.url,
      headers,
      params,
      data: hasBody ? req.body : undefined,
      responseType: 'arraybuffer',
      validateStatus: () => true,
      timeout: 20_000,
      maxRedirects: 5,
    });

    const responseMs = Date.now() - startedAt;
    const payloadBytes = getPayloadBytes(response.data);

    if (policy.monitoringEnabled) {
      updateApiMetrics(policy, targetUrl, {
        statusCode: response.status,
        responseMs,
        payloadBytes,
      }, userId);
    }

    return {
      ok: true,
      status: response.status,
      data: response.data,
      headers: response.headers,
      proxyMeta: {
        api: policy.name,
        sensitivityLevel: policy.sensitivityLevel,
        monitoringEnabled: policy.monitoringEnabled,
        rateLimitOverride: policy.rateLimitOverride,
        statusCategory: statusCategory(response.status),
        payloadBytes,
        responseMs,
      },
    };
  } catch (err) {
    const upstreamStatus = err.response?.status || 502;
    const upstreamData = err.response?.data;
    const responseMs = Date.now() - startedAt;
    const payloadBytes = getPayloadBytes(upstreamData);

    if (policy.monitoringEnabled) {
      updateApiMetrics(policy, targetUrl, {
        statusCode: upstreamStatus,
        responseMs,
        payloadBytes,
      }, userId);
    }

    if (upstreamData) {
      return {
        ok: false,
        status: upstreamStatus,
        data: upstreamData,
        headers: err.response.headers || {},
        proxyMeta: {
          api: policy.name,
          sensitivityLevel: policy.sensitivityLevel,
          monitoringEnabled: policy.monitoringEnabled,
          rateLimitOverride: policy.rateLimitOverride,
          statusCategory: statusCategory(upstreamStatus),
          payloadBytes,
          responseMs,
        },
      };
    }

    return {
      ok: false,
      status: upstreamStatus,
      data: {
        success: false,
        message: 'Failed to reach target API.',
        detail: err.message,
      },
      headers: {},
      proxyMeta: {
        api: policy.name,
        sensitivityLevel: policy.sensitivityLevel,
        monitoringEnabled: policy.monitoringEnabled,
        rateLimitOverride: policy.rateLimitOverride,
        statusCategory: statusCategory(upstreamStatus),
        payloadBytes,
        responseMs,
      },
    };
  }
}

function getApiStatsSnapshot(userId) {
  if (!userId) return [];

  const items = Array.from(apiMetricsStore.entries())
    .filter(([key]) => key.startsWith(`user:${userId}:`))
    .map(([, entry]) => ({
    apiName: entry.apiName,
    endpoint: entry.endpoint,
    sensitivityLevel: entry.sensitivityLevel,
    monitoringEnabled: entry.monitoringEnabled,
    rateLimitOverride: entry.rateLimitOverride,
    totalRequests: entry.totalRequests,
    totalAlerts: entry.totalAlerts,
    averageAnomalyScore: entry.avgAnomalyScore,
    errorPercentage: entry.errorPercentage,
    averageResponseMs: entry.avgResponseMs,
    baselineResponseMs: entry.baselineResponseMs,
    recentResponseMs: entry.recentResponseMs,
    healthStatus: entry.healthStatus,
    riskScore: entry.riskScore,
    statusCategoryCounts: entry.statusCategoryCounts,
    lastStatusCategory: entry.lastStatusCategory,
    lastPayloadBytes: entry.lastPayloadBytes,
    lastUpdatedAt: entry.lastUpdatedAt,
  }));

  items.sort((a, b) => b.riskScore - a.riskScore);
  return items;
}

module.exports = {
  extractTargetUrl,
  forwardRequest,
  getApiStatsSnapshot,
  upsertRuntimeApiPolicy,
  removeRuntimeApiPolicy,
  getRuntimeApiPolicy,
};
