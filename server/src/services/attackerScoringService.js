'use strict';

const { query } = require('../config/db');

/**
 * Severity weights for computing an attacker score.
 * These can be extended or loaded from config later.
 */
const SEVERITY_WEIGHTS = {
  low:      1,
  medium:   2,
  high:     3,
  critical: 5,
};

/**
 * Rule weights for computing an attacker score.
 */
const RULE_WEIGHTS = {
  RATE_LIMIT_VIOLATION:   1,
  BURST_DETECTION:        2,
  BURST_TRAFFIC:          2,
  ENDPOINT_FLOODING:      2,
  ENDPOINT_FLOOD:         2,
  REPEATED_LOGIN_FAILURE: 3,
};

/**
 * Compute attacker scores for all IPs that have triggered alerts.
 *
 * Score formula per alert:
 *   rule_weight * severity_weight * alert_count
 *
 * @param {number} [windowMs=3600000]  Look-back window (default: last hour).
 * @param {number} [limit=10]          Top N attackers to return.
 * @returns {Promise<Object[]>}
 */
async function getTopAttackers(windowMs = 3_600_000, limit = 10) {
  const since = new Date(Date.now() - windowMs).toISOString();

  const result = await query(
    `SELECT
       ip,
       COUNT(*)::int                        AS alert_count,
       SUM(alert_count)::int                AS total_occurrences,
       array_agg(DISTINCT rule_triggered)   AS rules_triggered,
       array_agg(DISTINCT severity)         AS severities,
       MAX(timestamp)                       AS last_seen
     FROM alerts
     WHERE timestamp >= $1
     GROUP BY ip
     ORDER BY alert_count DESC
     LIMIT $2`,
    [since, limit]
  );

  // Enrich with computed score.
  return result.rows.map((row) => {
    let score = 0;
    for (const rule of row.rules_triggered) {
      const rw = RULE_WEIGHTS[rule] ?? 1;
      for (const sev of row.severities) {
        const sw = SEVERITY_WEIGHTS[sev] ?? 1;
        score += rw * sw * (row.total_occurrences || 1);
      }
    }
    return { ...row, score };
  }).sort((a, b) => b.score - a.score);
}

module.exports = { getTopAttackers };
