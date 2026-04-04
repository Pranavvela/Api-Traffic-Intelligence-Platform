'use strict';

const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool(config.db);

pool.on('connect', () => {
  if (config.server.nodeEnv !== 'test') {
    console.log('[DB] PostgreSQL client connected');
  }
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client:', err.message);
  process.exit(1);
});

/**
 * Execute a parameterised query against the pool.
 * @param {string} text   SQL statement
 * @param {Array}  params Bound parameters
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;

  if (config.server.nodeEnv === 'development') {
    console.log(`[DB] query (${duration}ms): ${text.substring(0, 80)}`);
  }

  return result;
}

/**
 * Initialise the database schema (idempotent — safe to call on startup).
 */
async function initDb() {
  await query(`
    CREATE TABLE IF NOT EXISTS api_logs (
      id          SERIAL PRIMARY KEY,
      request_id  UUID        NOT NULL UNIQUE,
      ip          VARCHAR(45) NOT NULL,
      method      VARCHAR(10) NOT NULL,
      endpoint    TEXT        NOT NULL,
      status_code INTEGER     NOT NULL,
      response_ms INTEGER,
      user_agent  TEXT,
      timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_api_logs_ip_endpoint_ts
      ON api_logs (ip, endpoint, timestamp DESC);
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS alerts (
      id             SERIAL PRIMARY KEY,
      request_id     UUID        REFERENCES api_logs(request_id) ON DELETE SET NULL,
      rule_triggered VARCHAR(64) NOT NULL,
      ip             VARCHAR(45) NOT NULL,
      endpoint       TEXT        NOT NULL,
      reason         TEXT        NOT NULL,
      severity       VARCHAR(16) NOT NULL DEFAULT 'medium',
      resolved       BOOLEAN     NOT NULL DEFAULT FALSE,
      timestamp      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_alerts_ip_ts
      ON alerts (ip, timestamp DESC);
  `);

  // ── Migrations ────────────────────────────────────────────────────────────
  // alert_count  — how many times this dedup alert was incremented
  await query(`
    ALTER TABLE alerts
      ADD COLUMN IF NOT EXISTS alert_count INTEGER NOT NULL DEFAULT 1;
  `);

  // blocked_ips — persistent blocklist
  await query(`
    CREATE TABLE IF NOT EXISTS blocked_ips (
      id         SERIAL PRIMARY KEY,
      ip         VARCHAR(45) NOT NULL UNIQUE,
      reason     TEXT,
      blocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip ON blocked_ips (ip);
  `);

  console.log('[DB] Schema initialised');
}

module.exports = { query, initDb, pool };
