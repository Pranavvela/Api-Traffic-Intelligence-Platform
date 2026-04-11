'use strict';

const { query } = require('../config/db');

async function getSettingsRow() {
  const result = await query(
    `SELECT * FROM settings WHERE id = 1`
  );
  return result.rows[0] || null;
}

async function updateSettingsRow(row) {
  const result = await query(
    `UPDATE settings
     SET rate_limit_threshold = $1,
         brute_force_threshold = $2,
         endpoint_flood_threshold = $3,
         burst_multiplier = $4,
         sliding_window_seconds = $5,
         throttle_duration_minutes = $6,
         auto_block_enabled = $7,
         updated_at = NOW()
     WHERE id = 1
     RETURNING *`,
    [
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
