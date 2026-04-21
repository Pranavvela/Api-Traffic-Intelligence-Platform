'use strict';

const { query } = require('../config/db');

async function getAlertSummary(windowMs, userId = null) {
  if (!userId) {
    return {
      total_alerts: 0,
      ml_alerts: 0,
      rule_alerts: 0,
      critical_alerts: 0,
      last_alert_at: null,
    };
  }

  const since = new Date(Date.now() - windowMs).toISOString();
  const params = [since, userId];

  const result = await query(
    `SELECT
       COUNT(*)::int AS total_alerts,
       COUNT(*) FILTER (WHERE source = 'ML')::int AS ml_alerts,
       COUNT(*) FILTER (WHERE source = 'RULE')::int AS rule_alerts,
       COUNT(*) FILTER (WHERE severity = 'critical')::int AS critical_alerts,
       MAX(timestamp) AS last_alert_at
     FROM alerts
     WHERE timestamp >= $1 AND user_id = $2`,
    params
  );
  return result.rows[0] || null;
}

async function getRuleBreakdown(windowMs, userId = null) {
  if (!userId) return [];

  const since = new Date(Date.now() - windowMs).toISOString();
  const params = [since, userId];

  const result = await query(
    `SELECT rule_triggered, source, COUNT(*)::int AS cnt
     FROM alerts
     WHERE timestamp >= $1 AND user_id = $2
     GROUP BY rule_triggered, source
     ORDER BY cnt DESC`,
    params
  );
  return result.rows;
}

async function getTimeline(limit = 100, userId = null, source = null) {
  if (!userId) return [];

  const params = [limit];
  const clauses = ['user_id = $2'];

  params.push(userId);

  if (source) {
    params.push(source);
    clauses.push(`source = $${params.length}`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await query(
    `SELECT id, rule_triggered, ip, endpoint, reason, severity, source, anomaly_score, ml_explainability,
            ml_label, alert_count, mitigation_action, resolved, timestamp
     FROM alerts
     ${where}
     ORDER BY timestamp DESC
     LIMIT $1`,
    params
  );
  return result.rows;
}

module.exports = { getAlertSummary, getRuleBreakdown, getTimeline };
