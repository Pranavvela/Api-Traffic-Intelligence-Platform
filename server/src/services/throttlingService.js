'use strict';

const sw = require('./slidingWindowService');
const settingsService = require('./settingsService');

const throttled = new Map();

function throttleKey(ip) {
  return `throttle:${ip}`;
}

function nowMs() {
  return Date.now();
}

/**
 * Mark an IP as throttled for a duration.
 * @param {string} ip
 * @param {number} [durationMs]
 */
function throttleIp(ip, durationMs) {
  const settings = settingsService.getSettings();
  const ttl = durationMs || (settings.throttleDurationMinutes * 60_000);
  throttled.set(ip, nowMs() + ttl);
}

/**
 * Check if an IP is currently throttled.
 * @param {string} ip
 * @returns {boolean}
 */
function isThrottled(ip) {
  const expiry = throttled.get(ip);
  if (!expiry) return false;
  if (expiry <= nowMs()) {
    throttled.delete(ip);
    return false;
  }
  return true;
}

/**
 * Record a request for a throttled IP and determine if it should be blocked.
 * @param {string} ip
 * @returns {boolean}  true if should return 429
 */
function shouldReject(ip) {
  const settings = settingsService.getSettings();
  const key = throttleKey(ip);
  sw.record(key);
  const count = sw.count(key, settings.slidingWindowSeconds * 1000);
  return count > settings.rateLimitThreshold;
}

module.exports = {
  throttleIp,
  isThrottled,
  shouldReject,
};
