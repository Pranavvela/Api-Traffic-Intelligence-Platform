'use strict';

const { query } = require('../config/db');

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_OBSERVATION_MS = 10_000;

/**
 * Compute feature vectors per IP and time window for ML training.
 * @param {Object} opts
 * @param {number} [opts.windowMs=60000]
 * @param {number} [opts.observationMs=10000]
 * @param {string} [opts.start]
 * @param {string} [opts.end]
 * @param {string} [opts.ip]
 * @returns {Promise<Object[]>}
 */
async function getMlFeatures(opts = {}) {
  const windowMs = Math.max(parseInt(opts.windowMs, 10) || DEFAULT_WINDOW_MS, 10_000);
  const observationMs = Math.min(
    Math.max(parseInt(opts.observationMs, 10) || DEFAULT_OBSERVATION_MS, 1_000),
    windowMs
  );

  const hasStart = Boolean(opts.start);
  const hasEnd = Boolean(opts.end);
  const startDate = hasStart ? new Date(opts.start) : new Date(Date.now() - windowMs);
  const endDate = hasEnd ? new Date(opts.end) : new Date();

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new Error('Invalid start or end date. Use ISO format.');
  }

  const params = [startDate.toISOString(), endDate.toISOString()];
  const clauses = ['timestamp >= $1', 'timestamp <= $2'];

  if (opts.ip) {
    params.push(opts.ip);
    clauses.push(`ip = $${params.length}`);
  }

  const result = await query(
    `SELECT ip, endpoint, status_code, response_ms, alert_triggered, is_blocked, timestamp
     FROM api_logs
     WHERE ${clauses.join(' AND ')}
     ORDER BY timestamp ASC`,
    params
  );

  const buckets = new Map();

  for (const row of result.rows) {
    const ts = new Date(row.timestamp).getTime();
    const bucketStart = Math.floor(ts / windowMs) * windowMs;
    const key = `${row.ip}::${bucketStart}`;

    if (!buckets.has(key)) {
      buckets.set(key, {
        ip: row.ip,
        window_start: new Date(bucketStart).toISOString(),
        totalCount: 0,
        errorCount: 0,
        failedLoginCount: 0,
        alertCount: 0,
        blockedCount: 0,
        uniqueEndpoints: new Set(),
        responseSum: 0,
        responseCount: 0,
        recentCount: 0,
        baselineCount: 0,
        recentBoundary: bucketStart + windowMs - observationMs,
      });
    }

    const entry = buckets.get(key);
    entry.totalCount += 1;
    entry.uniqueEndpoints.add(row.endpoint);

    if (row.status_code >= 400) {
      entry.errorCount += 1;
    }

    if (row.alert_triggered) {
      entry.alertCount += 1;
    }

    if (row.is_blocked) {
      entry.blockedCount += 1;
    }

    if (/login/i.test(row.endpoint) && [400, 401, 403].includes(row.status_code)) {
      entry.failedLoginCount += 1;
    }

    if (row.response_ms !== null && row.response_ms !== undefined) {
      entry.responseSum += Number(row.response_ms) || 0;
      entry.responseCount += 1;
    }

    if (ts >= entry.recentBoundary) {
      entry.recentCount += 1;
    } else {
      entry.baselineCount += 1;
    }
  }

  const features = [];

  for (const entry of buckets.values()) {
    const requestsPerMinute = Math.round((entry.totalCount / windowMs) * 60_000);
    const avgResponseTime = entry.responseCount > 0
      ? Math.round(entry.responseSum / entry.responseCount)
      : 0;
    const errorRate = entry.totalCount > 0
      ? Number((entry.errorCount / entry.totalCount).toFixed(4))
      : 0;

    const recentRate = entry.recentCount / (observationMs / 1000);
    const baselineDurationSec = Math.max((windowMs - observationMs) / 1000, 1);
    const baselineRate = entry.baselineCount / baselineDurationSec;
    const burstRatio = baselineRate > 0 ? Number((recentRate / baselineRate).toFixed(2)) : 0;

    features.push({
      ip: entry.ip,
      window_start: entry.window_start,
      requests_per_minute: requestsPerMinute,
      failed_login_count: entry.failedLoginCount,
      unique_endpoints_hit: entry.uniqueEndpoints.size,
      avg_response_time: avgResponseTime,
      burst_ratio: burstRatio,
      error_rate: errorRate,
      alert_count: entry.alertCount,
      blocked_request_count: entry.blockedCount,
    });
  }

  return features;
}

module.exports = { getMlFeatures };
