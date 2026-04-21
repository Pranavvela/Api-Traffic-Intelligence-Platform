'use strict';

const sw = require('./slidingWindowService');
const settingsService = require('./settingsService');
const { createTtlStore } = require('./store');

const throttled = createTtlStore();

function scope(userId, ip) {
  return `${userId}:${ip}`;
}

function throttleKey(userId, ip, endpoint) {
  return `throttle:${scope(userId, ip)}:${endpoint}`;
}

function throttleIp(userId, ip, durationMs) {
  if (!userId) return;

  const settings = settingsService.getSettings(userId);
  const ttl = durationMs || settings.throttleDurationMinutes * 60000;
  throttled.set(scope(userId, ip), true, ttl);
}

function isThrottled(userId, ip) {
  if (!userId) return false;
  return throttled.has(scope(userId, ip));
}

function clearThrottle(userId, ip) {
  if (!userId) return;
  throttled.delete(scope(userId, ip));
}

function shouldReject(userId, ip, endpoint) {
  if (!userId) return false;

  const settings = settingsService.getSettings(userId);
  const key = throttleKey(userId, ip, endpoint);

  sw.record(key);
  const count = sw.count(key, settings.slidingWindowSeconds * 1000);

  return count > settings.rateLimitThreshold;
}

module.exports = {
  throttleIp,
  isThrottled,
  clearThrottle,
  shouldReject,
};