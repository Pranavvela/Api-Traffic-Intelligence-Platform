'use strict';

// dotenv is loaded once in server.js before this module is required.
// The call below is a safety fallback for tests or direct imports.
if (!process.env.PORT) require('dotenv').config();

module.exports = {
  server: {
    port: Number.parseInt(process.env.PORT, 10) || 4000,
    nodeEnv: process.env.NODE_ENV || 'development',
    requestBodyLimit: process.env.REQUEST_BODY_LIMIT || '1mb',
    host: process.env.HOST || '0.0.0.0',
  },

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number.parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME || 'api_traffic_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: Number.parseInt(process.env.DB_POOL_MAX, 10) || 20,
    idleTimeoutMillis: Number.parseInt(process.env.DB_POOL_IDLE_MS, 10) || 30000,
    connectionTimeoutMillis: Number.parseInt(process.env.DB_POOL_CONNECT_MS, 10) || 2000,
  },

  detection: {
    windowSizeMs: Number.parseInt(process.env.WINDOW_SIZE_MS, 10) || 60000,
    rateLimitThreshold: Number.parseInt(process.env.RATE_LIMIT_THRESHOLD, 10) || 10,
    loginFailureThreshold: Number.parseInt(process.env.LOGIN_FAILURE_THRESHOLD, 10) || 5,
    floodThreshold: Number.parseInt(process.env.FLOOD_THRESHOLD, 10) || 15,
    burstMultiplier: Number.parseFloat(process.env.BURST_MULTIPLIER) || 3,
  },

  throttling: {
    durationMs: Number.parseInt(process.env.THROTTLE_DURATION_MS, 10) || 300000,
    windowMs: Number.parseInt(process.env.THROTTLE_WINDOW_MS, 10) || 60000,
    threshold: Number.parseInt(process.env.THROTTLE_THRESHOLD, 10)
      || (Number.parseInt(process.env.RATE_LIMIT_THRESHOLD, 10) || 10),
  },

  ml: {
    serviceUrl: process.env.ML_SERVICE_URL || '',
  },

  cors: {
    clientOrigin: process.env.CLIENT_ORIGIN || '',
  },
  health: {
    includeDbStatus: process.env.HEALTH_INCLUDE_DB === 'true',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'dev_change_me',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
    allowRegister: process.env.AUTH_ALLOW_REGISTER === 'true',
  },
  allowlist: {
    internalPrefixes: (process.env.INTERNAL_ALLOWLIST_PREFIXES || '/health,/api,/ml')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  },
};
