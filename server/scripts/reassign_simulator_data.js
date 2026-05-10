'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = require('pg');

const fromUserId = Number.parseInt(process.argv[2], 10) || 999;
const toUserId = Number.parseInt(process.argv[3], 10) || 3;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number.parseInt(process.env.DB_PORT, 10) || 5433,
  database: process.env.DB_NAME || 'api_traffic_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

async function countRows(client, table, userId) {
  const result = await client.query(`SELECT COUNT(*)::int AS cnt FROM ${table} WHERE user_id = $1`, [userId]);
  return Number(result.rows[0]?.cnt || 0);
}

async function updateTable(client, table, fromId, toId) {
  const before = await countRows(client, table, fromId);
  if (before === 0) {
    return { table, before: 0, after: 0 };
  }

  const result = await client.query(
    `UPDATE ${table}
     SET user_id = $2
     WHERE user_id = $1`,
    [fromId, toId]
  );

  const after = await countRows(client, table, toId);
  return { table, before, moved: result.rowCount, after };
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log(`Reassigning simulator-owned data from user ${fromUserId} to user ${toUserId}...`);

    const tables = [
      'registered_apis',
      'api_logs',
      'alerts',
      'blocked_ips',
      'ml_detection_results',
    ];

    const summary = [];
    for (const table of tables) {
      summary.push(await updateTable(client, table, fromUserId, toUserId));
    }

    const settingsSource = await client.query(
      `SELECT rate_limit_threshold, brute_force_threshold, endpoint_flood_threshold,
              burst_multiplier, sliding_window_seconds, throttle_duration_minutes, auto_block_enabled
       FROM user_settings
       WHERE user_id = $1
       LIMIT 1`,
      [fromUserId]
    );

    if (settingsSource.rows[0]) {
      const source = settingsSource.rows[0];
      await client.query(
        `INSERT INTO user_settings (
           user_id,
           rate_limit_threshold,
           brute_force_threshold,
           endpoint_flood_threshold,
           burst_multiplier,
           sliding_window_seconds,
           throttle_duration_minutes,
           auto_block_enabled,
           updated_at
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           rate_limit_threshold = EXCLUDED.rate_limit_threshold,
           brute_force_threshold = EXCLUDED.brute_force_threshold,
           endpoint_flood_threshold = EXCLUDED.endpoint_flood_threshold,
           burst_multiplier = EXCLUDED.burst_multiplier,
           sliding_window_seconds = EXCLUDED.sliding_window_seconds,
           throttle_duration_minutes = EXCLUDED.throttle_duration_minutes,
           auto_block_enabled = EXCLUDED.auto_block_enabled,
           updated_at = NOW()`,
        [
          toUserId,
          source.rate_limit_threshold,
          source.brute_force_threshold,
          source.endpoint_flood_threshold,
          source.burst_multiplier,
          source.sliding_window_seconds,
          source.throttle_duration_minutes,
          source.auto_block_enabled,
        ]
      );

      await client.query('DELETE FROM user_settings WHERE user_id = $1', [fromUserId]);
      summary.push({
        table: 'user_settings',
        before: 1,
        moved: 1,
        after: 1,
      });
    } else {
      summary.push({
        table: 'user_settings',
        before: 0,
        moved: 0,
        after: 0,
      });
    }

    await client.query('COMMIT');

    console.table(summary);
    console.log('Done. Re-run the ML report and threat analysis using user 3.');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('Reassignment failed:', err && err.stack ? err.stack : err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
