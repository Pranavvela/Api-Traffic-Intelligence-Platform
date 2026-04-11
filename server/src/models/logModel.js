'use strict';

const { query } = require('../config/db');

/**
 * Persist a single API request log entry.
 * @param {Object} log
 * @returns {Promise<Object>} Inserted row
 */
async function insertLog(log) {
  const {
    requestId,
    ip,
    method,
    endpoint,
    statusCode,
    responseMs,
    userAgent,
    alertTriggered,
    isBlocked,
    timestamp,
  } = log;

  const result = await query(
    `INSERT INTO api_logs
       (request_id, ip, method, endpoint, status_code, response_ms, user_agent, alert_triggered, is_blocked, timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      requestId,
      ip,
      method,
      endpoint,
      statusCode,
      responseMs,
      userAgent,
      Boolean(alertTriggered),
      Boolean(isBlocked),
      timestamp,
    ]
  );

  return result.rows[0];
}

/**
 * Update alert_triggered for a log entry.
 * @param {string} requestId
 * @returns {Promise<Object|null>}
 */
async function markAlertTriggered(requestId) {
  const result = await query(
    `UPDATE api_logs
     SET alert_triggered = TRUE
     WHERE request_id = $1
     RETURNING *`,
    [requestId]
  );
  return result.rows[0] || null;
}

/**
 * Fetch the most recent logs with optional pagination.
 * @param {number} [limit=100]
 * @param {number} [offset=0]
 * @returns {Promise<Object[]>}
 */
async function getRecentLogs(limit = 100, offset = 0) {
  const result = await query(
    `SELECT * FROM api_logs
     ORDER BY timestamp DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return result.rows;
}

/**
 * Count requests from an IP to a specific endpoint within a time window.
 * Used to support rule evaluation (db-backed fallback; primary is in-memory).
 * @param {string} ip
 * @param {string} endpoint
 * @param {string} since  ISO timestamp lower bound
 * @returns {Promise<number>}
 */
async function countRequestsInWindow(ip, endpoint, since) {
  const result = await query(
    `SELECT COUNT(*) AS cnt
     FROM api_logs
     WHERE ip = $1 AND endpoint = $2 AND timestamp >= $3`,
    [ip, endpoint, since]
  );
  return parseInt(result.rows[0].cnt, 10);
}

/**
 * Count failed login attempts from an IP within a time window.
 * @param {string} ip
 * @param {string} since  ISO timestamp lower bound
 * @returns {Promise<number>}
 */
async function countFailedLogins(ip, since) {
  const result = await query(
    `SELECT COUNT(*) AS cnt
     FROM api_logs
     WHERE ip = $1
       AND endpoint ILIKE '%login%'
       AND status_code IN (400, 401, 403)
       AND timestamp >= $2`,
    [ip, since]
  );
  return parseInt(result.rows[0].cnt, 10);
}

/**
 * Retrieve aggregate request counts per endpoint for the last N minutes.
 * @param {number} [windowMs=60000]
 * @returns {Promise<Object[]>}
 */
async function getEndpointStats(windowMs = 60000) {
  const since = new Date(Date.now() - windowMs).toISOString();
  const result = await query(
    `SELECT endpoint, COUNT(*) AS request_count
     FROM api_logs
     WHERE timestamp >= $1
     GROUP BY endpoint
     ORDER BY request_count DESC`,
    [since]
  );
  return result.rows;
}

/**
 * Retrieve top N IPs by request volume in the last window.
 * @param {number} [windowMs=60000]
 * @param {number} [limit=10]
 * @returns {Promise<Object[]>}
 */
async function getTopIps(windowMs = 60000, limit = 10) {
  const since = new Date(Date.now() - windowMs).toISOString();
  const result = await query(
    `SELECT ip, COUNT(*) AS request_count
     FROM api_logs
     WHERE timestamp >= $1
     GROUP BY ip
     ORDER BY request_count DESC
     LIMIT $2`,
    [since, limit]
  );
  return result.rows;
}

/**
 * Count total requests in the last window.
 * @param {number} [windowMs=60000]
 * @returns {Promise<number>}
 */
async function countRequestsInLastWindow(windowMs = 60000) {
  const since = new Date(Date.now() - windowMs).toISOString();
  const result = await query(
    `SELECT COUNT(*) AS cnt FROM api_logs WHERE timestamp >= $1`,
    [since]
  );
  return parseInt(result.rows[0].cnt, 10);
}

/**
 * Group request counts by minute for the last N minutes.
 * @param {number} [minutes=5]
 * @returns {Promise<Object[]>}  [{minute: '2026-03-06T12:01:00Z', request_count: 14}, ...]
 */
async function getTrafficByMinute(minutes = 5) {
  const since = new Date(Date.now() - minutes * 60_000).toISOString();
  const result = await query(
    `SELECT
       date_trunc('minute', timestamp) AS minute,
       COUNT(*) AS request_count
     FROM api_logs
     WHERE timestamp >= $1
     GROUP BY minute
     ORDER BY minute ASC`,
    [since]
  );
  return result.rows;
}

module.exports = {
  insertLog,
  markAlertTriggered,
  getRecentLogs,
  countRequestsInWindow,
  countFailedLogins,
  getEndpointStats,
  getTopIps,
  countRequestsInLastWindow,
  getTrafficByMinute,
};
