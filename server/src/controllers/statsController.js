'use strict';

const { getEndpointStats, getTopIps, countRequestsInLastWindow, getTrafficByMinute } = require('../models/logModel');
const { countUnresolved } = require('../models/alertModel');
const { getTopAttackers } = require('../services/attackerScoringService');

/**
 * GET /api/stats/summary
 * High-level dashboard summary for the last 60 seconds.
 */
async function getSummary(req, res, next) {
  try {
    const windowMs = parseInt(req.query.windowMs, 10) || 60_000;

    const [requestCount, unresolvedAlerts, topIps, endpointStats] = await Promise.all([
      countRequestsInLastWindow(windowMs),
      countUnresolved(),
      getTopIps(windowMs, 10),
      getEndpointStats(windowMs),
    ]);

    const requestsPerMinute =
      windowMs === 60_000
        ? requestCount
        : Math.round((requestCount / windowMs) * 60_000);

    res.json({
      success: true,
      data: {
        windowMs,
        requestCount,
        requestsPerMinute,
        unresolvedAlerts,
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
    const windowMs = parseInt(req.query.windowMs, 10) || 60_000;
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    const data = await getTopIps(windowMs, limit);
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
    const windowMs = parseInt(req.query.windowMs, 10) || 60_000;
    const data = await getEndpointStats(windowMs);
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
    const minutes = Math.min(parseInt(req.query.minutes, 10) || 5, 60);
    const data = await getTrafficByMinute(minutes);
    res.json({ success: true, data });
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
    const windowMs = parseInt(req.query.windowMs, 10) || 3_600_000;
    const limit    = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    const data     = await getTopAttackers(windowMs, limit);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = { getSummary, getTopIpsHandler, getEndpointStatsHandler, getTrafficGraphHandler, getAttackersHandler };
