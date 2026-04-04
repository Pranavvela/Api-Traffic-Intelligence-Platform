'use strict';

const sw = require('./slidingWindowService');
const { evaluateAll } = require('./ruleEngine');
const { insertAlert, findRecentDuplicate, incrementAlertCount } = require('../models/alertModel');

/**
 * Process a single log entry through the full detection pipeline.
 *
 * Steps:
 *  1. Update sliding-window counters for this request.
 *  2. Run all rule evaluations.
 *  3. Persist any violations as alerts.
 *
 * This function is intentionally decoupled from the HTTP layer so that
 * it can later be replaced with or augmented by an ML inference step
 * without touching any route or controller code.
 *
 * @param {Object} logEntry  Raw log data (pre-persist)
 * @param {Object} savedLog  Persisted row returned by logModel.insertLog
 */
async function analyse(logEntry, savedLog) {
  const { ip, endpoint, statusCode } = logEntry;

  // ── Step 1: Update sliding window counters ────────────────────────────────
  const rateKey = sw.rateKey(ip, endpoint);
  sw.record(rateKey);

  // Track per-IP total burst (for BURST_TRAFFIC rule).
  sw.record(sw.ipBurstKey(ip));

  // Track login failures separately for REPEATED_LOGIN_FAILURE rule.
  const isLoginEndpoint = /\/login/i.test(endpoint);
  const isFailure = [400, 401, 403].includes(statusCode);
  if (isLoginEndpoint && isFailure) {
    sw.record(sw.loginFailKey(ip));
  }

  // ── Step 2: Evaluate rules ────────────────────────────────────────────────
  const violations = evaluateAll(logEntry);

  if (violations.length === 0) return;

  // ── Step 3: Persist alerts with deduplication ────────────────────────────
  const DEDUP_WINDOW_MS = 30_000;

  const persistPromises = violations.map(async (v) => {
    try {
      const existing = await findRecentDuplicate(ip, endpoint, v.ruleId, DEDUP_WINDOW_MS);
      if (existing) {
        await incrementAlertCount(existing.id);
        console.log(`[DetectionService] Dedup: incremented alert #${existing.id} (${v.ruleId}).`);
      } else {
        await insertAlert({
          requestId: savedLog?.request_id || null,
          ruleTriggered: v.ruleId,
          ip,
          endpoint,
          reason: v.reason,
          severity: v.severity,
        });
      }
    } catch (err) {
      console.error(`[DetectionService] Failed to persist alert (${v.ruleId}):`, err.message);
    }
  });

  await Promise.all(persistPromises);

  console.log(
    `[DetectionService] ${violations.length} violation(s) processed from IP ${ip} on ${endpoint}.`
  );
}

module.exports = { analyse };
