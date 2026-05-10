'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
// load the server db config
const db = require(path.join(__dirname, '..', 'src', 'config', 'db'));

async function main() {
  try {
    console.log('Connecting to DB...');

    // Delete any blocked_ips rows for user 999
    const del = await db.query(
      'DELETE FROM blocked_ips WHERE user_id = $1 RETURNING *;',
      [999]
    );

    console.log(`Removed ${del.rowCount} blocked_ips rows for user 999`);

    // Ensure user_settings exists for user 999; if not, create with sensible defaults
    const settings = await db.query('SELECT * FROM user_settings WHERE user_id = $1 LIMIT 1;', [999]);
    if (!settings.rows[0]) {
      await db.query(
        `INSERT INTO user_settings (user_id, rate_limit_threshold, brute_force_threshold, endpoint_flood_threshold, burst_multiplier, sliding_window_seconds, throttle_duration_minutes, auto_block_enabled)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (user_id) DO NOTHING;`,
        [999, 100, 10, 50, 2.0, 60, 5, false]
      );
      console.log('Created default user_settings for user 999 with auto_block_enabled=false');
    } else {
      // Update auto_block_enabled = false
      await db.query('UPDATE user_settings SET auto_block_enabled = $1, updated_at = NOW() WHERE user_id = $2;', [false, 999]);
      console.log('Updated user_settings for user 999: auto_block_enabled=false');
    }

    // Also update global settings row if needed (id=1)
    try {
      await db.query('UPDATE settings SET auto_block_enabled = $1, updated_at = NOW() WHERE id = 1;', [false]);
      console.log('Updated global settings.auto_block_enabled=false');
    } catch (e) {
      console.log('Failed to update global settings (may not exist):', e.message);
    }

    // Show remaining blocked rows for user 999
    const remaining = await db.query('SELECT * FROM blocked_ips WHERE user_id = $1;', [999]);
    console.log('Remaining blocked rows for user 999:', remaining.rows.length);

    process.exit(0);
  } catch (err) {
    console.error('Error during unblock operation:', err && err.stack ? err.stack : err);
    process.exit(1);
  }
}

main();
