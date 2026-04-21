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
    userId,
    ruleTriggered,
    ip,
    endpoint,
    reason,
    severity,
    source,
    anomalyScore,
    mlExplainability,
    mlLabel,
    firstSeen,
    lastSeen,
    alertState,
    confidenceScore,
    timeline,
  } = alert;

  const result = await query(
    `INSERT INTO alerts
       (request_id, user_id, rule_triggered, ip, endpoint, reason, severity, source, anomaly_score, ml_explainability, ml_label,
        first_seen, last_seen, alert_state, confidence_score, timeline)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
             $11, $12, $13, $14, $15, $16)
     RETURNING *`,
    [
      requestId || null,
      userId || null,
      ruleTriggered,
      ip,
      endpoint,
      reason,
      severity || 'medium',
      source || 'RULE',
      anomalyScore ?? null,
      mlExplainability ?? null,
      mlLabel || null,
      firstSeen || null,
      lastSeen || null,
      alertState || 'ACTIVE',
      confidenceScore ?? null,
      timeline ?? null,
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
async function getAlerts({ unresolvedOnly = false, limit = 50, offset = 0, userId = null } = {}) {
  if (!userId) return [];

  const params = [limit, offset];
  const clauses = [];

  if (unresolvedOnly) {
    clauses.push('resolved = FALSE');
  }

  params.push(userId);
  clauses.push(`user_id = $${params.length}`);

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await query(
    `SELECT * FROM alerts
     ${where}
     ORDER BY timestamp DESC
     LIMIT $1 OFFSET $2`,
    params
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
    `UPDATE alerts SET resolved = TRUE, alert_state = 'RESOLVED', resolved_at = NOW() WHERE id = $1 RETURNING *`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Fetch an alert by id.
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
async function getAlertById(id, userId = null) {
  if (!userId) return null;

  const result = await query(
    `SELECT * FROM alerts WHERE id = $1 AND user_id = $2`,
    [id, userId]
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
         mitigation_action = $3,
         alert_state = 'RESOLVED'
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
async function countUnresolved(userId = null) {
  if (!userId) return 0;

  const params = [userId];
  const clauses = ['resolved = FALSE', 'user_id = $1'];

  const result = await query(
    `SELECT COALESCE(SUM(alert_count), 0) AS cnt FROM alerts WHERE ${clauses.join(' AND ')}`,
    params
  );
  return Number.parseInt(result.rows[0].cnt, 10);
}

/**
 * Count alerts grouped by rule in the last window.
 * @param {number} [windowMs=3600000]  Default: last hour
 * @returns {Promise<Object[]>}
 */
async function getAlertsByRule(windowMs = 3600000, userId = null) {
  if (!userId) return [];

  const since = new Date(Date.now() - windowMs).toISOString();
  const params = [since, userId];
  const clauses = ['timestamp >= $1', 'user_id = $2'];

  const result = await query(
    `SELECT rule_triggered, COUNT(*) AS cnt
     FROM alerts
     WHERE ${clauses.join(' AND ')}
     GROUP BY rule_triggered
     ORDER BY cnt DESC`,
    params
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
async function findRecentDuplicate(ip, endpoint, ruleTriggered, windowMs = 30_000, userId = null) {
  if (!userId) return null;

  const since = new Date(Date.now() - windowMs).toISOString();
  const params = [ip, endpoint, ruleTriggered, since, userId];
  const clauses = [
    'ip = $1',
    'endpoint = $2',
    'rule_triggered = $3',
    'resolved = FALSE',
    '(last_seen IS NULL OR last_seen >= $4)',
    'user_id = $5',
  ];

  const result = await query(
    `SELECT * FROM alerts
     WHERE ${clauses.join(' AND ')}
     ORDER BY COALESCE(last_seen, timestamp) DESC
     LIMIT 1`,
    params
  );
  return result.rows[0] || null;
}

/**
 * Find an active alert group by grouping key (ip + endpoint + rule).
 * @param {string} ip
 * @param {string} endpoint
 * @param {string} ruleTriggered
 * @returns {Promise<Object|null>}
 */
async function findActiveGroup(ip, endpoint, ruleTriggered, userId = null) {
  if (!userId) return null;

  const params = [ip, endpoint, ruleTriggered, userId];
  const clauses = [
    'ip = $1',
    'endpoint = $2',
    'rule_triggered = $3',
    'resolved = FALSE',
    'user_id = $4',
  ];

  const result = await query(
    `SELECT * FROM alerts
     WHERE ${clauses.join(' AND ')}
     ORDER BY COALESCE(last_seen, timestamp) DESC
     LIMIT 1`,
    params
  );
  return result.rows[0] || null;
}

/**
 * Aggregate and update an existing alert group.
 * @param {number} id
 * @param {Object} update
 * @returns {Promise<Object|null>}
 */
async function updateAlertAggregation(id, update = {}) {
  const result = await query(
    `UPDATE alerts
     SET alert_count = alert_count + $2,
         last_seen = $3,
         severity = $4,
         confidence_score = $5,
         timeline = $6,
         alert_state = $7
     WHERE id = $1
     RETURNING *`,
    [
      id,
      update.alertCountIncrement || 1,
      update.lastSeen || new Date().toISOString(),
      update.severity || 'medium',
      update.confidenceScore ?? null,
      update.timeline ?? null,
      update.alertState || 'ACTIVE',
    ]
  );
  return result.rows[0] || null;
}

/**
 * Update the lifecycle state for an alert without marking it resolved.
 * @param {number} id
 * @param {Object} update
 * @returns {Promise<Object|null>}
 */
async function updateAlertState(id, update = {}) {
  const result = await query(
    `UPDATE alerts
     SET alert_state = $2,
         mitigation_action = $3
     WHERE id = $1
     RETURNING *`,
    [id, update.alertState || 'ACTIVE', update.mitigationAction || null]
  );
  return result.rows[0] || null;
}

/**
 * Auto-resolve an alert after inactivity.
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
async function autoResolveAlert(id) {
  const result = await query(
    `UPDATE alerts
     SET resolved = TRUE,
         resolved_at = NOW(),
         resolved_by = 'auto',
         alert_state = 'RESOLVED'
     WHERE id = $1
     RETURNING *`,
    [id]
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
async function getResolvedAlerts({ limit = 100, offset = 0, userId = null } = {}) {
  if (!userId) return [];

  const params = [limit, offset];
  const clauses = ['resolved = TRUE'];

  params.push(userId);
  clauses.push(`user_id = $${params.length}`);

  const result = await query(
    `SELECT * FROM alerts
     WHERE ${clauses.join(' AND ')}
     ORDER BY timestamp DESC
     LIMIT $1 OFFSET $2`,
    params
  );
  return result.rows;
}

/**
 * Delete all alerts (resets timeline and unresolved counts).
 * @returns {Promise<void>}
 */
async function clearAllAlerts(userId = null) {
  if (!userId) return;
  await query('DELETE FROM alerts WHERE user_id = $1', [userId]);
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
  findActiveGroup,
  incrementAlertCount,
  updateAlertAggregation,
  updateAlertState,
  autoResolveAlert,
  getResolvedAlerts,
  clearAllAlerts,
};
