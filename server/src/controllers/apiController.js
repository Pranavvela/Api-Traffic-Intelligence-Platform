'use strict';

const { getRecentLogs } = require('../models/logModel');

/**
 * GET /api/logs
 * Returns the most recent API log entries.
 *
 * Query params:
 *   limit  {number}  default 100
 *   offset {number}  default 0
 */
async function getLogs(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const offset = parseInt(req.query.offset, 10) || 0;
    const logs = await getRecentLogs(limit, offset);
    res.json({ success: true, count: logs.length, data: logs });
  } catch (err) {
    next(err);
  }
}

module.exports = { getLogs };
