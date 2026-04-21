'use strict';

const { query } = require('../config/db');

async function getSettingsRow(userId) {
  if (!userId) return null;

  const result = await query(
    `SELECT * FROM user_settings WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function updateSettingsRow(userId, row) {
  if (!userId) return null;

  const result = await query(
    `INSERT INTO user_settings (
       user_id,
       rate_limit_threshold,
       brute_force_threshold,
       endpoint_flood_threshold,
       burst_multiplier,
       sliding_window_seconds,
       throttle_duration_minutes,
       auto_block_enabled
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (user_id) DO UPDATE SET
       rate_limit_threshold = EXCLUDED.rate_limit_threshold,
       brute_force_threshold = EXCLUDED.brute_force_threshold,
       endpoint_flood_threshold = EXCLUDED.endpoint_flood_threshold,
       burst_multiplier = EXCLUDED.burst_multiplier,
       sliding_window_seconds = EXCLUDED.sliding_window_seconds,
       throttle_duration_minutes = EXCLUDED.throttle_duration_minutes,
       auto_block_enabled = EXCLUDED.auto_block_enabled,
       updated_at = NOW()
     RETURNING *`,
    [
      userId,
      row.rate_limit_threshold,
      row.brute_force_threshold,
      row.endpoint_flood_threshold,
      row.burst_multiplier,
      row.sliding_window_seconds,
      row.throttle_duration_minutes,
      row.auto_block_enabled,
    ]
  );
  return result.rows[0] || null;
}

module.exports = { getSettingsRow, updateSettingsRow };
