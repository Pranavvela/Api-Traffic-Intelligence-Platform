'use strict';

const sw = require('./slidingWindowService');
const { evaluateAll } = require('./ruleEngine');
const {
  insertAlert,
  findActiveGroup,
  updateAlertAggregation,
  updateAlertState,
  autoResolveAlert,
} = require('../models/alertModel');
const { insertDetectionResult } = require('../models/mlDetectionModel');
const { markAlertTriggered } = require('../models/logModel');
const mlService = require('./mlService');
const featureCacheService = require('./featureCacheService');
const settingsService = require('./settingsService');
const throttlingService = require('./throttlingService');
const blocklistService = require('./blocklistService');
const { createTtlStore } = require('./store');
const logger = require('../utils/logger');

const offenseStore = createTtlStore();
const suspicionStore = createTtlStore();

function actorKey(userId, ip) {
  return `${userId || 'anonymous'}:${ip}`;
}

// 🔥 FIXED ESCALATION LOGIC
async function applyProgressiveEscalation({
  userId,
  ip,
  topSeverity,
  suspicionScore,
  repeatCount,
  settings,
  isMlAnomaly,
  isSimulatorNormal,
}) {
  if (isSimulatorNormal) {
    return 'NONE';
  }

  const blockThreshold = settings.blockScoreThreshold || 250;
  const throttleThreshold = settings.throttleScoreThreshold || 120;

  const repeatBlockThreshold = 8;
  const repeatThrottleThreshold = 4;

  const isCritical = topSeverity === 'critical';
  const isHigh = topSeverity === 'high';

  // 🔴 BLOCK (VERY STRICT)
  if (
    settings.autoBlockEnabled &&
    (
      suspicionScore > blockThreshold ||
      (isCritical && repeatCount >= repeatBlockThreshold) ||
      (isMlAnomaly && repeatCount >= repeatBlockThreshold + 2)
    )
  ) {
    await blocklistService.blockIp(userId, ip, 'High confidence attack');
    return 'BLOCKED';
  }

  // 🟡 THROTTLE FIRST
  if (
    suspicionScore > throttleThreshold ||
    repeatCount >= repeatThrottleThreshold ||
    isHigh
  ) {
    throttlingService.throttleIp(userId, ip);
    return 'THROTTLED';
  }

  return 'NONE';
}

async function analyse(logEntry, savedLog) {
  const { ip, endpoint, statusCode } = logEntry;
  const userId = logEntry.userId || null;
  const settings = settingsService.getSettings(userId);
  const isSimulatorNormal = logEntry.simulatorFlag && logEntry.simulatorMode === 'normal';

  const tracker = actorKey(userId, ip);

  // 🔥 FIX: allow BOTH api + proxy
  const isProxy = endpoint.startsWith('/proxy');
  const isApi = endpoint.startsWith('/api');

  if (!isProxy && !isApi) return;

  // ── Sliding window tracking ──
  sw.record(sw.rateKey(tracker, endpoint));
  sw.record(sw.ipBurstKey(tracker));

  const isLogin = /login/i.test(endpoint);
  const isFailure = [400, 401, 403].includes(statusCode);

  if (isLogin && isFailure) {
    sw.record(sw.loginFailKey(tracker));
  }

  featureCacheService.updateFromLog(logEntry, savedLog);

  // ── RULE DETECTION ──
  const violations = evaluateAll({ ...logEntry, _trackerIp: tracker });

  // ── ML DETECTION ──
  let mlSignal = null;
  try {
    mlSignal = await mlService.scoreIpWindow(ip, userId);
  } catch (e) {
    logger.warn('ML failed', { error: e.message });
  }

  const isMlAnomaly = mlSignal?.ml_label === 'ANOMALY';

  // Persist ML detection result asynchronously for metrics and charts
  (async () => {
    try {
      if (mlSignal) {
        // Normalize ensemble vs legacy signal shapes
        const anomaly_score = mlSignal.anomaly_score ?? mlSignal.ensemble_score ?? mlSignal.ensemble_score ?? 0;
        const ml_label = mlSignal.ml_label ?? mlSignal.ensemble_label ?? mlSignal.ensemble_label ?? 'NORMAL';
        const y_pred = ml_label === 'ANOMALY' ? 1 : 0;
        const result = {
          userId: userId || null,
          ip: ip || null,
          y_true: isMlAnomaly ? 1 : 0,
          anomaly_score: Number(anomaly_score),
          y_pred,
          zscore_score: mlSignal.zscore_component?.score ?? mlSignal.zscore_score ?? null,
          isolation_forest_score: mlSignal.if_component?.score ?? mlSignal.if_score ?? null,
          ensemble_confidence: mlSignal.method_agreement_score ?? null,
        };

        await insertDetectionResult(result);
      }
    } catch (e) {
      logger.warn('Failed to persist ML detection result', { error: e.message });
    }
  })();

  if (!violations.length && !isMlAnomaly) return;

  // 🔥 SLOW DOWN SCORE BUILDUP
  const suspicionIncrement =
    violations.length * 10 + (isMlAnomaly ? 20 : 0);

  const suspicionScore =
    (suspicionStore.get(tracker) || 0) + suspicionIncrement;

  suspicionStore.set(tracker, suspicionScore, 60000);

  const repeatCount = (offenseStore.get(tracker) || 0) + 1;
  offenseStore.set(tracker, repeatCount, 60000);

  const topSeverity = violations.length ? 'high' : 'medium';

  // ── Mark log
  if (savedLog?.request_id) {
    markAlertTriggered(savedLog.request_id).catch(() => {});
  }

  // ── ALERT STORAGE ──
  for (const v of violations) {
    await insertAlert({
      requestId: savedLog?.request_id,
      userId,
      ruleTriggered: v.ruleId,
      ip,
      endpoint,
      reason: v.reason,
      severity: v.severity,
      source: 'RULE',
    });
  }

  if (isMlAnomaly) {
    await insertAlert({
      requestId: savedLog?.request_id,
      userId,
      ruleTriggered: 'ML_ANOMALY',
      ip,
      endpoint,
      reason: `ML anomaly score ${mlSignal.anomaly_score}`,
      severity: 'medium',
      source: 'ML',
    });
  }

  // ── ESCALATION ──
  await applyProgressiveEscalation({
    userId,
    ip,
    topSeverity,
    suspicionScore,
    repeatCount,
    settings,
    isMlAnomaly,
    isSimulatorNormal,
  });
}

module.exports = { analyse };