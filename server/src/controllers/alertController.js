'use strict';

const { getAlerts, resolveAlert, countUnresolved, getAlertsByRule, getResolvedAlerts } = require('../models/alertModel');

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
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = parseInt(req.query.offset, 10) || 0;

    const alerts = await getAlerts({ unresolvedOnly, limit, offset });
    const total = await countUnresolved();

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
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Invalid alert ID.' });
    }

    const updated = await resolveAlert(id);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Alert not found.' });
    }

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
    const windowMs = parseInt(req.query.windowMs, 10) || 3_600_000;
    const data = await getAlertsByRule(windowMs);
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
    const limit  = Math.min(parseInt(req.query.limit,  10) || 100, 500);
    const offset = parseInt(req.query.offset, 10) || 0;
    const data   = await getResolvedAlerts({ limit, offset });
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
}

module.exports = { listAlerts, markResolved, alertsByRule, alertHistory };
