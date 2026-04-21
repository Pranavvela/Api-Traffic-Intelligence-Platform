'use strict';

const { createKvStore } = require('./store');
const settingsService = require('./settingsService');
const sw = require('./slidingWindowService');
const baselineService = require('./baselineService');

const cache = createKvStore();
const OBSERVATION_MS = 10_000;

function subjectKey(userId, ip) {
  return `${userId || 'anonymous'}:${ip}`;
}

function createEntry(nowMs) {
  return {
    windowStartMs: nowMs,
    totalCount: 0,
    errorCount: 0,
    failedLoginCount: 0,
    alertCount: 0,
    blockedCount: 0,
    uniqueEndpoints: new Set(),
    responseSum: 0,
    responseCount: 0,
    lastUpdatedMs: nowMs,
  };
}

function ensureEntry(userId, ip, windowMs) {
  const nowMs = Date.now();
  const key = subjectKey(userId, ip);
  let entry = cache.get(key);
  if (!entry || (nowMs - entry.windowStartMs) > windowMs) {
    entry = createEntry(nowMs);
    cache.set(key, entry);
  }
  return entry;
}

function updateFromLog(logEntry, savedLog) {
  const settings = settingsService.getSettings(logEntry.userId);
  const windowMs = settings.slidingWindowSeconds * 1000;
  const key = subjectKey(logEntry.userId, logEntry.ip);
  const entry = ensureEntry(logEntry.userId, logEntry.ip, windowMs);

  entry.totalCount += 1;

  if (logEntry.statusCode >= 400) {
    entry.errorCount += 1;
  }

  if (/\/login/i.test(logEntry.endpoint) && [400, 401, 403].includes(logEntry.statusCode)) {
    entry.failedLoginCount += 1;
  }

  if (logEntry.endpoint) {
    entry.uniqueEndpoints.add(logEntry.endpoint);
  }

  if (logEntry.responseMs !== null && logEntry.responseMs !== undefined) {
    entry.responseSum += Number(logEntry.responseMs) || 0;
    entry.responseCount += 1;
  }

  if (savedLog?.is_blocked || logEntry.isBlocked) {
    entry.blockedCount += 1;
  }

  entry.lastUpdatedMs = Date.now();
  cache.set(key, entry);

  const features = buildFeatures(logEntry.ip, entry, windowMs, key);
  baselineService.updateFromFeatures(key, features);
  return features;
}

function addAlertCount(ip, userId, count = 1) {
  const settings = settingsService.getSettings(userId);
  const windowMs = settings.slidingWindowSeconds * 1000;
  const key = subjectKey(userId, ip);
  const entry = ensureEntry(userId, ip, windowMs);
  entry.alertCount += count;
  entry.lastUpdatedMs = Date.now();
  cache.set(key, entry);
}

function buildFeatures(ip, entry, windowMs, key) {
  const requestsPerMinute = Math.round((entry.totalCount / windowMs) * 60_000);
  const avgResponseTime = entry.responseCount > 0
    ? Math.round(entry.responseSum / entry.responseCount)
    : 0;
  const errorRate = entry.totalCount > 0
    ? Number((entry.errorCount / entry.totalCount).toFixed(4))
    : 0;

  const burstKey = sw.ipBurstKey(key);
  const currentRate = sw.currentRate(burstKey, OBSERVATION_MS);
  const baselineRate = sw.rollingAvgRate(burstKey, OBSERVATION_MS, windowMs);
  const burstRatio = baselineRate > 0
    ? Number((currentRate / baselineRate).toFixed(2))
    : 0;

  return {
    ip,
    window_start: new Date(entry.windowStartMs).toISOString(),
    requests_per_minute: requestsPerMinute,
    failed_login_count: entry.failedLoginCount,
    unique_endpoints_hit: entry.uniqueEndpoints.size,
    avg_response_time: avgResponseTime,
    burst_ratio: burstRatio,
    error_rate: errorRate,
    alert_count: entry.alertCount,
    blocked_request_count: entry.blockedCount,
  };
}

function getLatestFeatures(ip) {
  return getLatestFeaturesForUser(ip, null);
}

function getLatestFeaturesForUser(ip, userId) {
  const key = subjectKey(userId, ip);
  const entry = cache.get(key);
  if (!entry) return null;
  const settings = settingsService.getSettings(userId);
  const windowMs = settings.slidingWindowSeconds * 1000;
  return buildFeatures(ip, entry, windowMs, key);
}

module.exports = { updateFromLog, addAlertCount, getLatestFeatures, getLatestFeaturesForUser };
