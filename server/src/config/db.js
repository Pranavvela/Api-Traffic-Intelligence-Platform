'use strict';

const { Pool } = require('pg');
const config = require('./config');
const logger = require('../utils/logger');

const pool = new Pool(config.db);

pool.on('connect', () => {
  if (config.server.nodeEnv !== 'test') {
    logger.info('PostgreSQL client connected');
  }
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', { error: err.message });
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
    logger.debug('DB query', { durationMs: duration, sql: text.substring(0, 80) });
  }

  return result;
}

/**
 * Initialise the database schema (idempotent — safe to call on startup).
 */
async function initDb() {
  // users — authentication identities
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      email      VARCHAR(255) NOT NULL UNIQUE,
      password   TEXT         NOT NULL,
      created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS api_logs (
      id          SERIAL PRIMARY KEY,
      request_id  UUID        NOT NULL UNIQUE,
      user_id     INTEGER     REFERENCES users(id) ON DELETE SET NULL,
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

  await query(`
    ALTER TABLE api_logs
      ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_api_logs_user_ts
      ON api_logs (user_id, timestamp DESC);
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
      user_id        INTEGER     REFERENCES users(id) ON DELETE SET NULL,
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

  await query(`
    ALTER TABLE alerts
      ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_alerts_user_ts
      ON alerts (user_id, timestamp DESC);
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

  await query(`
    ALTER TABLE alerts
      ADD COLUMN IF NOT EXISTS first_seen TIMESTAMPTZ;
  `);

  await query(`
    ALTER TABLE alerts
      ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;
  `);

  await query(`
    ALTER TABLE alerts
      ADD COLUMN IF NOT EXISTS alert_state VARCHAR(16) NOT NULL DEFAULT 'ACTIVE';
  `);

  await query(`
    ALTER TABLE alerts
      ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(4,3);
  `);

  await query(`
    ALTER TABLE alerts
      ADD COLUMN IF NOT EXISTS timeline JSONB;
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
    ALTER TABLE blocked_ips
      ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip ON blocked_ips (ip);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_blocked_ips_user_ip ON blocked_ips (user_id, ip);
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_blocked_ips_user_ip ON blocked_ips (user_id, ip);
  `);

  // registered_apis — user-defined API registry
  await query(`
    CREATE TABLE IF NOT EXISTS registered_apis (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER     REFERENCES users(id) ON DELETE SET NULL,
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
      ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_registered_apis_user
      ON registered_apis (user_id, created_at DESC);
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

  // user_settings — tenant-scoped configuration
  await query(`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id                  INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      rate_limit_threshold     INTEGER      NOT NULL,
      brute_force_threshold    INTEGER      NOT NULL,
      endpoint_flood_threshold INTEGER      NOT NULL,
      burst_multiplier         NUMERIC(6,2) NOT NULL,
      sliding_window_seconds   INTEGER      NOT NULL,
      throttle_duration_minutes INTEGER     NOT NULL,
      auto_block_enabled       BOOLEAN      NOT NULL DEFAULT TRUE,
      updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );
  `);

  // ml_model — persistent ML model storage
  await query(`
    CREATE TABLE IF NOT EXISTS ml_model (
      id         SERIAL PRIMARY KEY,
      model_data JSONB       NOT NULL,
      engine     VARCHAR(32) NOT NULL DEFAULT 'zscore',
      model_version INTEGER,
      is_active  BOOLEAN     NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    ALTER TABLE ml_model
      ADD COLUMN IF NOT EXISTS model_version INTEGER;
  `);

  await query(`
    ALTER TABLE ml_model
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT FALSE;
  `);

  await query(`
    UPDATE ml_model target
    SET model_version = versions.version_number
    FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY engine ORDER BY created_at ASC, id ASC) AS version_number
      FROM ml_model
    ) AS versions
    WHERE target.id = versions.id
      AND target.model_version IS NULL;
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_ml_model_created_at
      ON ml_model (created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_ml_model_engine_version
      ON ml_model (engine, model_version DESC);
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_ml_model_engine_version
      ON ml_model (engine, model_version);
  `);

  await query(`
    UPDATE ml_model
      SET is_active = TRUE
      WHERE id IN (
        SELECT DISTINCT ON (engine) id
        FROM ml_model
        ORDER BY engine, is_active DESC, created_at DESC, id DESC
      );
  `);

  logger.info('Schema initialised');
}

module.exports = { query, initDb, pool };
