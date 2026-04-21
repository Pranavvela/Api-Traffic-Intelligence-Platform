'use strict';

const {
  getAlerts,
  resolveAlert,
  countUnresolved,
  getAlertsByRule,
  getResolvedAlerts,
  getAlertById,
  resolveAlertWithMitigation,
  clearAllAlerts,
} = require('../models/alertModel');
const blocklist = require('../services/blocklistService');
const throttling = require('../services/throttlingService');
const settingsService = require('../services/settingsService');

/**
 * GET /api/alerts
 * Query params:
 *   unresolved {boolean} default false — only return unresolved alerts
 *   limit      {number}  default 50
 *   offset     {number}  default 0
 */
async function listAlerts(req, res, next) {
  try {
    const unresolvedOnly = req.query.unresolved === 'true';
    const limit = Math.min(Number.parseInt(req.query.limit, 10) || 50, 200);
    const offset = Number.parseInt(req.query.offset, 10) || 0;
    const userId = req.user?.id || null;

    const alerts = await getAlerts({ unresolvedOnly, limit, offset, userId });
    const total = await countUnresolved(userId);

    res.json({
      success: true,
      unresolvedCount: total,
      count: alerts.length,
      data: alerts,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/alerts/:id/resolve
 * Mark a single alert as resolved.
 */
async function markResolved(req, res, next) {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Invalid alert ID.' });
    }

    const alert = await getAlertById(id, req.user?.id || null);
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found.' });
    }

    if (alert.resolved) {
      return res.json({ success: true, data: alert });
    }

    const resolvedBy = req.body?.resolved_by || 'system';
    const rule = alert.rule_triggered;
    const ip = alert.ip;
    const userId = req.user?.id || null;
    const settings = settingsService.getSettings(userId);

    let mitigationAction = 'NONE';

    const shouldAutoBlock = settings.autoBlockEnabled && (
      rule === 'REPEATED_LOGIN_FAILURE'
      || rule === 'ENDPOINT_FLOODING'
      || rule === 'ENDPOINT_FLOOD'
    );

    if (shouldAutoBlock) {
      await blocklist.blockIp(userId, ip, `Mitigation: ${rule} (alert #${alert.id}).`);
      mitigationAction = 'BLOCKED';
    } else if (rule === 'RATE_LIMIT_VIOLATION') {
      throttling.throttleIp(ip);
      mitigationAction = 'THROTTLED';
    } else if (rule === 'BURST_DETECTION' || rule === 'BURST_TRAFFIC') {
      mitigationAction = 'MONITORED';
    }

    const updated = await resolveAlertWithMitigation(id, {
      resolvedBy,
      mitigationAction,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/alerts/by-rule
 * Returns alert counts grouped by rule for the last hour.
 */
async function alertsByRule(req, res, next) {
  try {
    const windowMs = Number.parseInt(req.query.windowMs, 10) || 3_600_000;
    const data = await getAlertsByRule(windowMs, req.user?.id || null);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/alerts/history
 * Returns resolved (historical) alerts.
 */
async function alertHistory(req, res, next) {
  try {
    const limit  = Math.min(Number.parseInt(req.query.limit,  10) || 100, 500);
    const offset = Number.parseInt(req.query.offset, 10) || 0;
    const data   = await getResolvedAlerts({ limit, offset, userId: req.user?.id || null });
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/alerts/reset
 * Clears all alert records (unresolved + history).
 */
async function resetAlerts(_req, res, next) {
  try {
    await clearAllAlerts(_req.user?.id || null);
    res.json({ success: true, message: 'All alerts cleared.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listAlerts, markResolved, alertsByRule, alertHistory, resetAlerts };
