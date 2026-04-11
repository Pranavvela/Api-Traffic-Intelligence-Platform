'use strict';

const { getTopAttackers } = require('../services/attackerScoringService');
const mlService = require('../services/mlService');
const { getAlertSummary, getRuleBreakdown, getTimeline } = require('../models/threatAnalysisModel');

async function getSummary(req, res, next) {
  try {
    const windowMs = parseInt(req.query.windowMs, 10) || 3_600_000;
    const limit = Math.min(parseInt(req.query.limit, 10) || 5, 20);

    const [summary, topAttackers] = await Promise.all([
      getAlertSummary(windowMs),
      getTopAttackers(windowMs, limit),
    ]);

    let mlTopIps = [];
    const mlStatus = await mlService.status();
    if (mlStatus.trained) {
      const ml = await mlService.detect({ windowMs });
      const anomalies = (ml.results || []).filter((r) => r.ml_label === 'ANOMALY');
      const counts = new Map();
      anomalies.forEach((row) => {
        counts.set(row.ip, (counts.get(row.ip) || 0) + 1);
      });
      mlTopIps = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([ip, count]) => ({ ip, count }));
    }

    res.json({
      success: true,
      data: {
        summary: summary || {
          total_alerts: 0,
          ml_alerts: 0,
          rule_alerts: 0,
          critical_alerts: 0,
          last_alert_at: null,
        },
        topAttackers,
        mlTopIps,
        mlStatus,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getRules(req, res, next) {
  try {
    const windowMs = parseInt(req.query.windowMs, 10) || 3_600_000;
    const data = await getRuleBreakdown(windowMs);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getTimelineHandler(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const source = req.query.source ? String(req.query.source).toUpperCase() : null;
    const data = await getTimeline(limit, source);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
}

module.exports = { getSummary, getRules, getTimelineHandler };
