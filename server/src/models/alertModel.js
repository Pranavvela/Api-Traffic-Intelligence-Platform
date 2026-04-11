'use strict';

const { query } = require('../config/db');

/**
 * Persist a new alert.
 * @param {Object} alert
 * @returns {Promise<Object>} Inserted row
 */
async function insertAlert(alert) {
  const {
    requestId,
    ruleTriggered,
    ip,
    endpoint,
    reason,
    severity,
    source,
    anomalyScore,
    mlExplainability,
    mlLabel,
  } = alert;

  const result = await query(
    `INSERT INTO alerts
       (request_id, rule_triggered, ip, endpoint, reason, severity, source, anomaly_score, ml_explainability, ml_label)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      requestId || null,
      ruleTriggered,
      ip,
      endpoint,
      reason,
      severity || 'medium',
      source || 'RULE',
      anomalyScore ?? null,
      mlExplainability ?? null,
      mlLabel || null,
    ]
  );

  return result.rows[0];
}

/**
 * Fetch alerts with optional filters.
 * @param {Object}  [opts]
 * @param {boolean} [opts.unresolvedOnly=false]
 * @param {number}  [opts.limit=50]
 * @param {number}  [opts.offset=0]
 * @returns {Promise<Object[]>}
 */
async function getAlerts({ unresolvedOnly = false, limit = 50, offset = 0 } = {}) {
  const conditions = unresolvedOnly ? 'WHERE resolved = FALSE' : '';
  const result = await query(
    `SELECT * FROM alerts
     ${conditions}
     ORDER BY timestamp DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return result.rows;
}

/**
 * Mark an alert as resolved.
 * @param {number} id  Alert primary key
 * @returns {Promise<Object|null>}
 */
async function resolveAlert(id) {
  const result = await query(
    `UPDATE alerts SET resolved = TRUE WHERE id = $1 RETURNING *`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Fetch an alert by id.
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
async function getAlertById(id) {
  const result = await query(
    `SELECT * FROM alerts WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Resolve an alert with mitigation metadata.
 * @param {number} id
 * @param {Object} opts
 * @param {string} [opts.resolvedBy]
 * @param {string} [opts.mitigationAction]
 * @returns {Promise<Object|null>}
 */
async function resolveAlertWithMitigation(id, opts = {}) {
  const { resolvedBy, mitigationAction } = opts;
  const result = await query(
    `UPDATE alerts
     SET resolved = TRUE,
         resolved_at = NOW(),
         resolved_by = $2,
         mitigation_action = $3
     WHERE id = $1
     RETURNING *`,
    [id, resolvedBy || null, mitigationAction || null]
  );
  return result.rows[0] || null;
}

/**
 * Count unresolved alerts.
 * @returns {Promise<number>}
 */
async function countUnresolved() {
  const result = await query(
    `SELECT COALESCE(SUM(alert_count), 0) AS cnt FROM alerts WHERE resolved = FALSE`
  );
  return parseInt(result.rows[0].cnt, 10);
}

/**
 * Count alerts grouped by rule in the last window.
 * @param {number} [windowMs=3600000]  Default: last hour
 * @returns {Promise<Object[]>}
 */
async function getAlertsByRule(windowMs = 3600000) {
  const since = new Date(Date.now() - windowMs).toISOString();
  const result = await query(
    `SELECT rule_triggered, COUNT(*) AS cnt
     FROM alerts
     WHERE timestamp >= $1
     GROUP BY rule_triggered
     ORDER BY cnt DESC`,
    [since]
  );
  return result.rows;
}

/**
 * Find a recent unresolved duplicate alert (same IP + endpoint + rule within windowMs).
 * @param {string} ip
 * @param {string} endpoint
 * @param {string} ruleTriggered
 * @param {number} [windowMs=30000]
 * @returns {Promise<Object|null>}
 */
async function findRecentDuplicate(ip, endpoint, ruleTriggered, windowMs = 30_000) {
  const since = new Date(Date.now() - windowMs).toISOString();
  const result = await query(
    `SELECT * FROM alerts
     WHERE ip = $1
       AND endpoint = $2
       AND rule_triggered = $3
       AND resolved = FALSE
       AND timestamp >= $4
     ORDER BY timestamp DESC
     LIMIT 1`,
    [ip, endpoint, ruleTriggered, since]
  );
  return result.rows[0] || null;
}

/**
 * Increment the alert_count of an existing alert.
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
async function incrementAlertCount(id) {
  const result = await query(
    `UPDATE alerts SET alert_count = alert_count + 1 WHERE id = $1 RETURNING *`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Fetch resolved (historical) alerts.
 * @param {number} [limit=100]
 * @param {number} [offset=0]
 * @returns {Promise<Object[]>}
 */
async function getResolvedAlerts({ limit = 100, offset = 0 } = {}) {
  const result = await query(
    `SELECT * FROM alerts
     WHERE resolved = TRUE
     ORDER BY timestamp DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return result.rows;
}

/**
 * Delete all alerts (resets timeline and unresolved counts).
 * @returns {Promise<void>}
 */
async function clearAllAlerts() {
  await query('TRUNCATE TABLE alerts RESTART IDENTITY');
}

module.exports = {
  insertAlert,
  getAlerts,
  resolveAlert,
  getAlertById,
  resolveAlertWithMitigation,
  countUnresolved,
  getAlertsByRule,
  findRecentDuplicate,
  incrementAlertCount,
  getResolvedAlerts,
  clearAllAlerts,
};
