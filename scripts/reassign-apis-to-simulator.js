#!/usr/bin/env node
'use strict';

const path = require('path');
const dotenv = require(path.join(__dirname, '../server/node_modules/dotenv'));
const pg = require(path.join(__dirname, '../server/node_modules/pg'));

dotenv.config({ path: path.join(__dirname, '../server/.env') });
const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'api_traffic_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  ssl: process.env.DB_SSL === 'true',
});

console.log(`Connecting to DB: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);

async function reassignApisToSimulator() {
  try {
    console.log('Reassigning registered APIs from user 3 to user 999 (simulator)...');

    // Reassign all APIs from user 3 to user 999
    const result = await pool.query(
      'UPDATE registered_apis SET user_id = $1 WHERE user_id = $2',
      [999, 3]
    );

    console.log(`✓ Reassigned ${result.rowCount} APIs to simulator user (999)`);

    // Verify
    const verify = await pool.query(
      'SELECT COUNT(*) as cnt FROM registered_apis WHERE user_id = $1',
      [999]
    );

    console.log(`✓ Simulator now owns ${verify.rows[0].cnt} registered APIs`);

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('✗ Error:', err.message);
    await pool.end();
    process.exit(1);
  }
}

reassignApisToSimulator();
