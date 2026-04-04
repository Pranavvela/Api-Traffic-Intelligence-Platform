'use strict';

require('dotenv').config();

const app = require('./src/app');
const { initDb } = require('./src/config/db');
const config = require('./src/config/config');
const blocklist = require('./src/services/blocklistService');

const PORT = config.server.port;

async function start() {
  try {
    // Initialise the database schema before accepting traffic.
    await initDb();

    // Seed the in-memory blocklist from the database.
    await blocklist.seedCache();

    app.listen(PORT, () => {
      const envStr  = config.server.nodeEnv;
      const dbStr   = `${config.db.host}:${config.db.port}`;
      console.log(`\n┌──────────────────────────────────────────────────────┐`);
      console.log(`│   API Traffic Intelligence Platform — Server          │`);
      console.log(`│   Listening : http://localhost:${String(PORT).padEnd(22)}│`);
      console.log(`│   Environment: ${envStr.padEnd(37)}│`);
      console.log(`│   DB         : ${dbStr.padEnd(37)}│`);
      console.log(`└──────────────────────────────────────────────────────┘\n`);
    });
  } catch (err) {
    console.error('[Server] Fatal startup error:', err.message);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] SIGINT received — shutting down gracefully.');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[Server] SIGTERM received — shutting down gracefully.');
  process.exit(0);
});

start();
