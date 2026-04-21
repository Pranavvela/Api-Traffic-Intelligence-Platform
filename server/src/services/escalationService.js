'use strict';

const settingsService = require('./settingsService');
const throttling = require('./throttlingService');
const blocklist = require('./blocklistService');

const SEVERITY_RANK = { low: 1, medium: 2, high: 3, critical: 4 };

function repeatThreshold(settings) {
  return Math.max(2, Math.round(settings.rateLimitThreshold / 5));
}

function blockThreshold(settings) {
  return Math.max(3, Math.round(settings.rateLimitThreshold / 3));
}

function shouldEscalateToBlock({ userId, severity, repeatCount, isMlAnomaly }) {
  const settings = settingsService.getSettings(userId);
  if (!settings.autoBlockEnabled) return false;

  const rank = SEVERITY_RANK[severity] || 1;
  const blockRepeat = blockThreshold(settings);

  if (rank >= SEVERITY_RANK.critical) return true;
  if (rank >= SEVERITY_RANK.high && repeatCount >= blockRepeat) return true;
  if (isMlAnomaly && repeatCount >= blockRepeat + 1) return true;
  return false;
}

function shouldThrottle({ userId, severity, repeatCount }) {
  const settings = settingsService.getSettings(userId);
  const rank = SEVERITY_RANK[severity] || 1;
  const repeat = repeatThreshold(settings);

  if (rank >= SEVERITY_RANK.high) return true;
  if (rank >= SEVERITY_RANK.medium && repeatCount >= repeat) return true;
  return false;
}

async function applyEscalation({ userId, ip, severity, repeatCount, isMlAnomaly, reason }) {
  if (shouldEscalateToBlock({ userId, severity, repeatCount, isMlAnomaly })) {
    await blocklist.blockIp(userId, ip, reason || 'Auto-block: repeated/severe alerts.');
    return 'BLOCKED';
  }

  if (shouldThrottle({ userId, severity, repeatCount })) {
    throttling.throttleIp(userId, ip);
    return 'THROTTLED';
  }

  return 'NONE';
}

module.exports = { applyEscalation };
