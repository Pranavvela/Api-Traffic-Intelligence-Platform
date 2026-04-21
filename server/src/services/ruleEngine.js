// ruleEngine.js - Core logic for defining and evaluating detection rules against incoming logs.
'use strict';

const sw = require('./slidingWindowService');
const logger = require('../utils/logger');
const settingsService = require('./settingsService');

/**
 * Rule definitions.
 *
 * Each rule is an object with:
 *   id        {string}   Unique rule identifier (stored in alerts.rule_triggered)
 *   severity  {string}   'low' | 'medium' | 'high' | 'critical'
 *   evaluate  {Function} (logEntry, windowContext) → { violated: bool, reason: string }
 */
const rules = [
  // ── Rule 1: Rate Limit Violation ─────────────────────────────────────────
  {
    id: 'RATE_LIMIT_VIOLATION',
    severity: 'high',
    evaluate(logEntry) {
      const { ip, endpoint } = logEntry;
      const settings = settingsService.getSettings(logEntry.userId);
      const trackerIp = logEntry._trackerIp || ip;
      const key = sw.rateKey(trackerIp, endpoint);
      const requestCount = sw.count(key, settings.slidingWindowSeconds * 1000);
      const threshold = settings.rateLimitThreshold;

      if (requestCount > threshold) {
        return {
          violated: true,
          reason: `IP ${ip} made ${requestCount} requests to ${endpoint} in the last 60s (threshold: ${threshold}).`,
        };
      }
      return { violated: false };
    },
  },

  // ── Rule 2: Repeated Login Failure ────────────────────────────────────────
  {
    id: 'REPEATED_LOGIN_FAILURE',
    severity: 'critical',
    evaluate(logEntry) {
      const { ip, endpoint, statusCode } = logEntry;
      const settings = settingsService.getSettings(logEntry.userId);
      const isLoginEndpoint = /\/login/i.test(endpoint);
      const isFailure = [400, 401, 403].includes(statusCode);

      if (!isLoginEndpoint || !isFailure) return { violated: false };

      const trackerIp = logEntry._trackerIp || ip;
      const key = sw.loginFailKey(trackerIp);
      const failCount = sw.count(key, settings.slidingWindowSeconds * 1000);
      const threshold = settings.bruteForceThreshold;

      if (failCount > threshold) {
        return {
          violated: true,
          reason: `IP ${ip} had ${failCount} failed login attempts in the last 60s — possible brute-force (threshold: ${threshold}).`,
        };
      }
      return { violated: false };
    },
  },

  // ── Rule 3: Endpoint Flooding ─────────────────────────────────────────────
  {
    id: 'ENDPOINT_FLOODING',
    severity: 'high',
    evaluate(logEntry) {
      const { ip, endpoint } = logEntry;
      const settings = settingsService.getSettings(logEntry.userId);
      const trackerIp = logEntry._trackerIp || ip;
      const key = sw.rateKey(trackerIp, endpoint);
      const requestCount = sw.count(key, settings.slidingWindowSeconds * 1000);
      const threshold = settings.endpointFloodThreshold;

      if (requestCount > threshold) {
        return {
          violated: true,
          reason: `IP ${ip} flooded ${endpoint} with ${requestCount} requests in the last 60s (flood threshold: ${threshold}).`,
        };
      }
      return { violated: false };
    },
  },

  // ── Rule 4: Burst Detection ───────────────────────────────────────────────
  {
    id: 'BURST_DETECTION',
    severity: 'medium',
    evaluate(logEntry) {
      const { ip, endpoint } = logEntry;
      const settings = settingsService.getSettings(logEntry.userId);
      const trackerIp = logEntry._trackerIp || ip;
      const key = sw.rateKey(trackerIp, endpoint);

      const current = sw.currentRate(key);       // req/s over last 10s
      const baseline = sw.rollingAvgRate(key, 10_000, settings.slidingWindowSeconds * 1000);   // req/s over the rest of the window
      const multiplier = settings.burstMultiplier;

      // Only fire when there is a meaningful baseline to compare against.
      if (baseline < 0.1) return { violated: false };

      if (current > multiplier * baseline) {
        return {
          violated: true,
          reason: `IP ${ip} burst on ${endpoint}: current rate ${current.toFixed(2)} req/s is ${(current / baseline).toFixed(1)}× the rolling average of ${baseline.toFixed(2)} req/s (threshold: ${multiplier}×).`,
        };
      }
      return { violated: false };
    },
  },

  // ── Rule 5: Burst Traffic (per-IP total, all endpoints) ───────────────────
  {
    id: 'BURST_TRAFFIC',
    severity: 'high',
    evaluate(logEntry) {
      const { ip } = logEntry;
      const settings = settingsService.getSettings(logEntry.userId);
      const trackerIp = logEntry._trackerIp || ip;
      const key = sw.ipBurstKey(trackerIp);

      const current  = sw.currentRate(key);      // req/s over last 10s
      const baseline = sw.rollingAvgRate(key, 10_000, settings.slidingWindowSeconds * 1000);    // req/s over rest of window
      const multiplier = settings.burstMultiplier;

      if (baseline < 0.1) return { violated: false };

      if (current > multiplier * baseline) {
        return {
          violated: true,
          reason: `IP ${ip} total traffic burst: current ${current.toFixed(2)} req/s is ${
            (current / baseline).toFixed(1)
          }× rolling average of ${baseline.toFixed(2)} req/s (threshold: ${multiplier}×).`,
        };
      }
      return { violated: false };
    },
  },

  // ── Rule 6: Endpoint Flood (30-second window) ─────────────────────────────
  {
    id: 'ENDPOINT_FLOOD',
    severity: 'critical',
    evaluate(logEntry) {
      const { ip, endpoint } = logEntry;
      const settings = settingsService.getSettings(logEntry.userId);
      const trackerIp = logEntry._trackerIp || ip;
      const key      = sw.rateKey(trackerIp, endpoint);
      const count30s = sw.count(key, 30_000);          // last 30s specifically
      const threshold = settings.endpointFloodThreshold;

      if (count30s > threshold) {
        return {
          violated: true,
          reason: `IP ${ip} flooded ${endpoint} with ${count30s} requests in the last 30s (threshold: ${threshold}).`,
        };
      }
      return { violated: false };
    },
  },
];

/**
 * Evaluate all rules against a log entry.
 *
 * @param {Object} logEntry  Normalised request log
 * @returns {Array<{ ruleId: string, severity: string, reason: string }>}
 */
function evaluateAll(logEntry) {
  const violations = [];

  for (const rule of rules) {
    try {
      const result = rule.evaluate(logEntry);
      if (result.violated) {
        violations.push({
          ruleId: rule.id,
          severity: rule.severity,
          reason: result.reason,
        });
      }
    } catch (err) {
      logger.error('Rule evaluation error', { ruleId: rule.id, error: err.message });
    }
  }

  return violations;
}

module.exports = { evaluateAll, rules };
