'use strict';

// dotenv is loaded once in server.js before this module is required.
// The call below is a safety fallback for tests or direct imports.
if (!process.env.PORT) require('dotenv').config();

module.exports = {
  server: {
    port: parseInt(process.env.PORT, 10) || 4000,
    nodeEnv: process.env.NODE_ENV || 'development',
  },

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME || 'api_traffic_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: 20,              // max pool connections
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },

  detection: {
    windowSizeMs: parseInt(process.env.WINDOW_SIZE_MS, 10) || 60000,
    rateLimitThreshold: parseInt(process.env.RATE_LIMIT_THRESHOLD, 10) || 10,
    loginFailureThreshold: parseInt(process.env.LOGIN_FAILURE_THRESHOLD, 10) || 5,
    floodThreshold: parseInt(process.env.FLOOD_THRESHOLD, 10) || 15,
    burstMultiplier: parseFloat(process.env.BURST_MULTIPLIER) || 3,
  },

  throttling: {
    durationMs: parseInt(process.env.THROTTLE_DURATION_MS, 10) || 300000,
    windowMs: parseInt(process.env.THROTTLE_WINDOW_MS, 10) || 60000,
    threshold: parseInt(process.env.THROTTLE_THRESHOLD, 10) || (parseInt(process.env.RATE_LIMIT_THRESHOLD, 10) || 10),
  },

  ml: {
    serviceUrl: process.env.ML_SERVICE_URL || '',
  },

  cors: {
    clientOrigin: process.env.CLIENT_ORIGIN || 'http://api-sentinel.local:8080',
  },
};
