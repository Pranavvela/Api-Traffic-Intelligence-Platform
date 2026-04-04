'use strict';

require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  // Connect to the default 'postgres' database to create our app database.
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5433,
    database: 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  });

  try {
    const targetDb = process.env.DB_NAME || 'api_traffic_db';
    const check = await pool.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [targetDb]
    );

    if (check.rowCount === 0) {
      // Database names cannot be parameterised in CREATE DATABASE.
      await pool.query(`CREATE DATABASE "${targetDb}"`);
      console.log(`[Setup] Database "${targetDb}" created.`);
    } else {
      console.log(`[Setup] Database "${targetDb}" already exists.`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[Setup] Error:', err.message);
  process.exit(1);
});
