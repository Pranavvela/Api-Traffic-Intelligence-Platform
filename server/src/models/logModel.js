'use strict';

const { query } = require('../config/db');

const REGISTERED_API_FILTER = `EXISTS (
  SELECT 1
  FROM registered_apis ra
  WHERE ra.user_id = api_logs.user_id
    AND (
      ra.endpoint = api_logs.endpoint
      OR api_logs.endpoint = regexp_replace(ra.endpoint, '^https?://[^/]+', '')
      OR api_logs.endpoint = '/proxy/' || ltrim(ra.endpoint, '/')
      OR api_logs.endpoint = '/proxy/' || ltrim(regexp_replace(ra.endpoint, '^https?://[^/]+', ''), '/')
    )
    AND UPPER(ra.method) = UPPER(api_logs.method)
    AND ra.is_active = TRUE
)`;

/**
 * Persist a single API request log entry.
 * @param {Object} log
 * @returns {Promise<Object>} Inserted row
 */
async function insertLog(log) {
  const {
    requestId,
    userId,
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
       (request_id, user_id, ip, method, endpoint, status_code, response_ms, user_agent, alert_triggered, is_blocked, timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      requestId,
      userId || null,
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
async function getRecentLogs(limit = 100, offset = 0, userId = null) {
  if (!userId) return [];

  const result = await query(
    `SELECT * FROM api_logs
     WHERE user_id = $3
       AND ${REGISTERED_API_FILTER}
     ORDER BY timestamp DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset, userId]
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
  return Number.parseInt(result.rows[0].cnt, 10);
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
  return Number.parseInt(result.rows[0].cnt, 10);
}

/**
 * Retrieve aggregate request counts per endpoint for the last N minutes.
 * @param {number} [windowMs=60000]
 * @returns {Promise<Object[]>}
 */
async function getEndpointStats(windowMs = 60000, userId = null) {
  if (!userId) return [];

  const since = new Date(Date.now() - windowMs).toISOString();
  const params = [since, userId];

  const result = await query(
    `SELECT endpoint, COUNT(*) AS request_count
     FROM api_logs
     WHERE timestamp >= $1
       AND user_id = $2
       AND ${REGISTERED_API_FILTER}
     GROUP BY endpoint
     ORDER BY request_count DESC`,
    params
  );
  return result.rows;
}

/**
 * Retrieve top N IPs by request volume in the last window.
 * @param {number} [windowMs=60000]
 * @param {number} [limit=10]
 * @returns {Promise<Object[]>}
 */
async function getTopIps(windowMs = 60000, limit = 10, userId = null) {
  if (!userId) return [];

  const since = new Date(Date.now() - windowMs).toISOString();
  const params = [since, limit, userId];

  const result = await query(
    `SELECT ip, COUNT(*) AS request_count
     FROM api_logs
     WHERE timestamp >= $1
       AND user_id = $3
       AND ${REGISTERED_API_FILTER}
     GROUP BY ip
     ORDER BY request_count DESC
     LIMIT $2`,
    params
  );
  return result.rows;
}

/**
 * Count total requests in the last window.
 * @param {number} [windowMs=60000]
 * @returns {Promise<number>}
 */
async function countRequestsInLastWindow(windowMs = 60000, userId = null) {
  if (!userId) return 0;

  const since = new Date(Date.now() - windowMs).toISOString();
  const params = [since, userId];

  const result = await query(
    `SELECT COUNT(*) AS cnt
     FROM api_logs
     WHERE timestamp >= $1
       AND user_id = $2
       AND ${REGISTERED_API_FILTER}`,
    params
  );
  return Number.parseInt(result.rows[0].cnt, 10);
}

/**
 * Group request counts by minute for the last N minutes.
 * @param {number} [minutes=5]
 * @returns {Promise<Object[]>}  [{minute: '2026-03-06T12:01:00Z', request_count: 14}, ...]
 */
async function getTrafficByMinute(minutes = 5, userId = null) {
  if (!userId) return [];

  const since = new Date(Date.now() - minutes * 60_000).toISOString();
  const params = [since, userId];

  const result = await query(
    `SELECT
       date_trunc('minute', timestamp) AS minute,
       COUNT(*) AS request_count
     FROM api_logs
     WHERE timestamp >= $1
       AND user_id = $2
       AND ${REGISTERED_API_FILTER}
     GROUP BY minute
     ORDER BY minute ASC`,
    params
  );
  return result.rows;
}

/**
 * Group request counts by a bucket size for the last window.
 * @param {number} windowMs
 * @param {number} bucketSeconds
 * @returns {Promise<Object[]>} [{bucket: '2026-03-06T12:00:00Z', request_count: 14}, ...]
 */
async function getTrafficByBucket(windowMs, bucketSeconds, userId = null) {
  if (!userId) return [];

  const since = new Date(Date.now() - windowMs).toISOString();
  const safeBucketSeconds = Math.max(bucketSeconds, 60);
  const params = [safeBucketSeconds, since, userId];

  const result = await query(
    `WITH bounds AS (
       SELECT
         to_timestamp(floor(extract(epoch from $2::timestamptz) / $1) * $1) AS start_bucket,
         to_timestamp(floor(extract(epoch from NOW()) / $1) * $1) AS end_bucket
     ),
     traffic AS (
       SELECT
         to_timestamp(floor(extract(epoch from timestamp) / $1) * $1) AS bucket,
         COUNT(*)::int AS request_count
       FROM api_logs
       WHERE timestamp >= $2
         AND user_id = $3
         AND ${REGISTERED_API_FILTER}
       GROUP BY bucket
     )
     SELECT
       series.bucket,
       COALESCE(traffic.request_count, 0)::int AS request_count
     FROM bounds
     CROSS JOIN LATERAL generate_series(
       bounds.start_bucket,
       bounds.end_bucket,
       make_interval(secs => $1::int)
     ) AS series(bucket)
     LEFT JOIN traffic ON traffic.bucket = series.bucket
     ORDER BY series.bucket ASC`,
    params
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
  getTrafficByBucket,
};
