'use strict';

const { windowStart } = require('../utils/timeUtils');
const config = require('../config/config');

/**
 * In-memory sliding window store.
 *
 * Structure:
 *   windowStore  Map<string, number[]>   key → sorted array of timestamps (ms)
 *
 * Keys are namespaced strings such as:
 *   "rate:<ip>:<endpoint>"
 *   "login_fail:<ip>"
 *   "burst:<ip>:<endpoint>"
 */
const windowStore = new Map();

// Purge stale entries every 2 minutes to prevent unbounded memory growth.
const PURGE_INTERVAL_MS = 120_000;
setInterval(() => purgeExpired(), PURGE_INTERVAL_MS).unref();

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Record a new event timestamp under the given key.
 * @param {string} key
 */
function record(key) {
  const now = Date.now();
  if (!windowStore.has(key)) {
    windowStore.set(key, []);
  }
  windowStore.get(key).push(now);
  evict(key);
}

/**
 * Count events within the configured window for a key.
 * @param {string} key
 * @param {number} [customWindowMs]  Override the default window size.
 * @returns {number}
 */
function count(key, customWindowMs) {
  const timestamps = windowStore.get(key);
  if (!timestamps || timestamps.length === 0) return 0;
  evict(key, customWindowMs);
  return (windowStore.get(key) || []).length;
}

/**
 * Return all timestamps within the window for a key.
 * @param {string} key
 * @param {number} [customWindowMs]
 * @returns {number[]}
 */
function getTimestamps(key, customWindowMs) {
  evict(key, customWindowMs);
  return windowStore.get(key) ? [...windowStore.get(key)] : [];
}

/**
 * Compute the current request rate (requests per second) for a key
 * over a short observation window (default: last 10 seconds).
 * @param {string} key
 * @param {number} [observationMs=10000]
 * @returns {number}
 */
function currentRate(key, observationMs = 10_000) {
  const boundary = Date.now() - observationMs;
  const timestamps = windowStore.get(key) || [];
  const recentCount = timestamps.filter((t) => t >= boundary).length;
  return recentCount / (observationMs / 1000); // req/s
}

/**
 * Compute rolling average rate (req/s) over the full window, excluding
 * the most recent observation sub-window.  Used for burst detection.
 * @param {string} key
 * @param {number} [observationMs=10000]
 * @returns {number}
 */
function rollingAvgRate(key, observationMs = 10_000) {
  const windowMs = config.detection.windowSizeMs;
  const now = Date.now();
  const windowBoundary = now - windowMs;
  const observationBoundary = now - observationMs;

  const timestamps = windowStore.get(key) || [];
  // Count events in the window but BEFORE the recent observation period.
  const baselineCount = timestamps.filter(
    (t) => t >= windowBoundary && t < observationBoundary
  ).length;

  const baselineDurationSec = (windowMs - observationMs) / 1000;
  if (baselineDurationSec <= 0) return 0;
  return baselineCount / baselineDurationSec;
}

/**
 * Build the canonical key for rate-limit tracking.
 * @param {string} ip
 * @param {string} endpoint
 * @returns {string}
 */
function rateKey(ip, endpoint) {
  return `rate:${ip}:${endpoint}`;
}

/**
 * Build the canonical key for login-failure tracking.
 * @param {string} ip
 * @returns {string}
 */
function loginFailKey(ip) {
  return `login_fail:${ip}`;
}

/**
 * Build the canonical key for per-IP total burst tracking.
 * @param {string} ip
 * @returns {string}
 */
function ipBurstKey(ip) {
  return `burst_ip:${ip}`;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Remove timestamps older than the window boundary for a specific key.
 * @param {string} key
 * @param {number} [customWindowMs]
 */
function evict(key, customWindowMs) {
  const boundary = windowStart(customWindowMs || config.detection.windowSizeMs);
  const timestamps = windowStore.get(key);
  if (!timestamps) return;

  // Binary-search the first index still within the window.
  let lo = 0;
  let hi = timestamps.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (timestamps[mid] < boundary) lo = mid + 1;
    else hi = mid;
  }

  if (lo > 0) {
    timestamps.splice(0, lo);
  }

  if (timestamps.length === 0) {
    windowStore.delete(key);
  }
}

/**
 * Walk every stored key and evict stale timestamps; remove empty entries.
 */
function purgeExpired() {
  for (const key of windowStore.keys()) {
    evict(key);
  }
}

module.exports = {
  record,
  count,
  getTimestamps,
  currentRate,
  rollingAvgRate,
  rateKey,
  loginFailKey,
  ipBurstKey,
};
