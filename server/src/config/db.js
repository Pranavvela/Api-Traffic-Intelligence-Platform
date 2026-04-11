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
      alert_triggered BOOLEAN NOT NULL DEFAULT FALSE,
      is_blocked  BOOLEAN     NOT NULL DEFAULT FALSE,
      timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_api_logs_ip_endpoint_ts
      ON api_logs (ip, endpoint, timestamp DESC);
  `);

  // ── Migrations ────────────────────────────────────────────────────────────
  await query(`
    ALTER TABLE api_logs
      ADD COLUMN IF NOT EXISTS alert_triggered BOOLEAN NOT NULL DEFAULT FALSE;
  `);

  await query(`
    ALTER TABLE api_logs
      ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT FALSE;
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
      source         VARCHAR(16) NOT NULL DEFAULT 'RULE',
      anomaly_score  NUMERIC(8,4),
      ml_explainability JSONB,
      ml_label       VARCHAR(16),
      resolved       BOOLEAN     NOT NULL DEFAULT FALSE,
      resolved_at    TIMESTAMPTZ,
      resolved_by    VARCHAR(64),
      mitigation_action VARCHAR(32),
      timestamp      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_alerts_ip_ts
      ON alerts (ip, timestamp DESC);
  `);

  // alert_count  — how many times this dedup alert was incremented
  await query(`
    ALTER TABLE alerts
      ADD COLUMN IF NOT EXISTS alert_count INTEGER NOT NULL DEFAULT 1;
  `);

  // alert resolution metadata
  await query(`
    ALTER TABLE alerts
      ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
  `);

  await query(`
    ALTER TABLE alerts
      ADD COLUMN IF NOT EXISTS resolved_by VARCHAR(64);
  `);

  await query(`
    ALTER TABLE alerts
      ADD COLUMN IF NOT EXISTS mitigation_action VARCHAR(32);
  `);

  await query(`
    ALTER TABLE alerts
      ADD COLUMN IF NOT EXISTS source VARCHAR(16) NOT NULL DEFAULT 'RULE';
  `);

  await query(`
    ALTER TABLE alerts
      ADD COLUMN IF NOT EXISTS anomaly_score NUMERIC(8,4);
  `);

  await query(`
    ALTER TABLE alerts
      ADD COLUMN IF NOT EXISTS ml_explainability JSONB;
  `);

  await query(`
    ALTER TABLE alerts
      ADD COLUMN IF NOT EXISTS ml_label VARCHAR(16);
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

  // registered_apis — user-defined API registry
  await query(`
    CREATE TABLE IF NOT EXISTS registered_apis (
      id         SERIAL PRIMARY KEY,
      endpoint   TEXT        NOT NULL,
      method     VARCHAR(10) NOT NULL,
      threshold  INTEGER     NOT NULL,
      is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
      api_type   VARCHAR(16) NOT NULL DEFAULT 'INTERNAL',
      validation_status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
      last_checked_at TIMESTAMPTZ,
      validation_message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_registered_apis_active
      ON registered_apis (is_active, created_at DESC);
  `);

  await query(`
    ALTER TABLE registered_apis
      ADD COLUMN IF NOT EXISTS api_type VARCHAR(16) NOT NULL DEFAULT 'INTERNAL';
  `);

  await query(`
    ALTER TABLE registered_apis
      ADD COLUMN IF NOT EXISTS validation_status VARCHAR(16) NOT NULL DEFAULT 'PENDING';
  `);

  await query(`
    ALTER TABLE registered_apis
      ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;
  `);

  await query(`
    ALTER TABLE registered_apis
      ADD COLUMN IF NOT EXISTS validation_message TEXT;
  `);

  // settings — platform configuration (single row)
  await query(`
    CREATE TABLE IF NOT EXISTS settings (
      id                       INTEGER PRIMARY KEY DEFAULT 1,
      rate_limit_threshold     INTEGER     NOT NULL,
      brute_force_threshold    INTEGER     NOT NULL,
      endpoint_flood_threshold INTEGER     NOT NULL,
      burst_multiplier         NUMERIC(6,2) NOT NULL,
      sliding_window_seconds   INTEGER     NOT NULL,
      throttle_duration_minutes INTEGER    NOT NULL,
      auto_block_enabled       BOOLEAN     NOT NULL DEFAULT TRUE,
      updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    INSERT INTO settings (
      id,
      rate_limit_threshold,
      brute_force_threshold,
      endpoint_flood_threshold,
      burst_multiplier,
      sliding_window_seconds,
      throttle_duration_minutes,
      auto_block_enabled
    )
    SELECT 1,
      $1, $2, $3, $4, $5, $6, $7
    WHERE NOT EXISTS (SELECT 1 FROM settings WHERE id = 1);
  `, [
    config.detection.rateLimitThreshold,
    config.detection.loginFailureThreshold,
    config.detection.floodThreshold,
    config.detection.burstMultiplier,
    Math.round(config.detection.windowSizeMs / 1000),
    Math.round(config.throttling.durationMs / 60000),
    true,
  ]);

  console.log('[DB] Schema initialised');
}

module.exports = { query, initDb, pool };
