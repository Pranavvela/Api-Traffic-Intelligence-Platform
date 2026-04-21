'use strict';

require('dotenv').config();

const app = require('./src/app');
const { initDb, pool } = require('./src/config/db');
const config = require('./src/config/config');
const blocklist = require('./src/services/blocklistService');
const settingsService = require('./src/services/settingsService');
const mlService = require('./src/services/mlService');
const mlModelRepository = require('./src/models/mlModelRepository');
const logger = require('./src/utils/logger');

const PORT = config.server.port;
const HOST = config.server.host;
let serverRef = null;

async function start() {
  try {
    // Initialise the database schema before accepting traffic.
    await initDb();

    // Seed the in-memory blocklist from the database.
    await blocklist.seedCache();

    // Seed settings cache from the database.
    await settingsService.loadSettings();

    // Load the previously trained ML model from the database
    await loadMlModel();

    serverRef = app.listen(PORT, HOST, () => {
      const envStr = config.server.nodeEnv;
      const dbStr = `${config.db.host}:${config.db.port}`;
      logger.info('Server listening', {
        host: HOST,
        port: PORT,
        env: envStr,
        db: dbStr,
      });
    });
  } catch (err) {
    logger.error('Fatal startup error', { error: err.message });
    process.exit(1);
  }
}

/**
 * Load the most recently trained ML model from the database.
 * This restores the model state across server restarts.
 */
async function loadMlModel() {
  try {
    const modelData = await mlModelRepository.loadLatestModel('zscore');
    
    if (modelData) {
      mlService.loadModel(modelData);
      logger.info('ML model loaded');
    } else {
      logger.info('No ML model found; running without ML');
    }
  } catch (err) {
    logger.warn('Could not load ML model', { error: err.message });
    logger.info('Continuing without ML; model can be trained later');
  }
}

async function shutdown(signal) {
  logger.info('Shutdown signal received', { signal });

  if (serverRef) {
    await new Promise((resolve) => serverRef.close(resolve));
  }

  try {
    await pool.end();
    logger.info('Database pool closed');
  } catch (err) {
    logger.warn('Failed to close DB pool', { error: err.message });
  }

  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start();
