'use strict';

const {
  getEndpointStats,
  getTopIps,
  countRequestsInLastWindow,
  getTrafficByMinute,
  getTrafficByBucket,
} = require('../models/logModel');
const { countUnresolved } = require('../models/alertModel');
const { getTopAttackers } = require('../services/attackerScoringService');

/**
 * GET /api/stats/summary
 * High-level dashboard summary for the last 60 seconds.
 */
async function getSummary(req, res, next) {
  try {
    const windowMs = Number.parseInt(req.query.windowMs, 10) || 60_000;
    const rpmWindowMs = Number.parseInt(req.query.rpmWindowMs, 10) || 300_000;
    const userId = req.user?.id || null;

    const [requestCount, rpmCount, unresolvedAlerts, topIps, endpointStats, topAttackers] = await Promise.all([
      countRequestsInLastWindow(windowMs, userId),
      countRequestsInLastWindow(rpmWindowMs, userId),
      countUnresolved(userId),
      getTopIps(windowMs, 10, userId),
      getEndpointStats(windowMs, userId),
      getTopAttackers(windowMs, 5, userId),
    ]);

    const requestsPerMinute = Math.round((rpmCount / rpmWindowMs) * 60_000);

    res.json({
      success: true,
      data: {
        windowMs,
        rpmWindowMs,
        requestCount,
        requestsPerMinute,
        unresolvedAlerts,
        threatScore: topAttackers.reduce((sum, row) => sum + (row.score || 0), 0),
        topIps,
        endpointStats,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/stats/top-ips
 * Top IPs by request volume.
 */
async function getTopIpsHandler(req, res, next) {
  try {
    const windowMs = Number.parseInt(req.query.windowMs, 10) || 60_000;
    const limit = Math.min(Number.parseInt(req.query.limit, 10) || 10, 50);
    const data = await getTopIps(windowMs, limit, req.user?.id || null);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/stats/endpoints
 * Request counts per endpoint.
 */
async function getEndpointStatsHandler(req, res, next) {
  try {
    const windowMs = Number.parseInt(req.query.windowMs, 10) || 60_000;
    const data = await getEndpointStats(windowMs, req.user?.id || null);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/stats/traffic
 * Requests grouped by minute for the last 5 minutes.
 */
async function getTrafficGraphHandler(req, res, next) {
  try {
    const range = (req.query.range || '').toLowerCase();
    const ranges = {
      '5m': { windowMs: 5 * 60_000, bucketSeconds: 60 },
      '1h': { windowMs: 60 * 60_000, bucketSeconds: 5 * 60 },
      '12h': { windowMs: 12 * 60 * 60_000, bucketSeconds: 15 * 60 },
      '24h': { windowMs: 24 * 60 * 60_000, bucketSeconds: 30 * 60 },
      '7d': { windowMs: 7 * 24 * 60 * 60_000, bucketSeconds: 60 * 60 },
      '1m': { windowMs: 30 * 24 * 60 * 60_000, bucketSeconds: 6 * 60 * 60 },
      '1y': { windowMs: 365 * 24 * 60 * 60_000, bucketSeconds: 24 * 60 * 60 },
    };

    if (ranges[range]) {
      const { windowMs, bucketSeconds } = ranges[range];
      const data = await getTrafficByBucket(windowMs, bucketSeconds, req.user?.id || null);
      res.json({ success: true, data, meta: { range, windowMs, bucketSeconds } });
      return;
    }

    const minutes = Math.min(Number.parseInt(req.query.minutes, 10) || 5, 60);
    const data = await getTrafficByMinute(minutes, req.user?.id || null);
    res.json({ success: true, data, meta: { range: '5m', windowMs: minutes * 60_000, bucketSeconds: 60 } });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/stats/attackers
 * Top attacker IPs ranked by score.
 */
async function getAttackersHandler(req, res, next) {
  try {
    const windowMs = Number.parseInt(req.query.windowMs, 10) || 3_600_000;
    const limit    = Math.min(Number.parseInt(req.query.limit, 10) || 10, 50);
    const data     = await getTopAttackers(windowMs, limit, req.user?.id || null);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = { getSummary, getTopIpsHandler, getEndpointStatsHandler, getTrafficGraphHandler, getAttackersHandler };
