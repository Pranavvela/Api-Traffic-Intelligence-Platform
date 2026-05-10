'use strict';

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'api_traffic_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  ssl: process.env.DB_SSL === 'true',
});

async function test() {
  try {
    console.log(`Attempting connection to ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME} as ${process.env.DB_USER}...`);
    const result = await pool.query('SELECT NOW()');
    console.log('✓ Database connected successfully');
    console.log('Current time from DB:', result.rows[0].now);
    
    // Check tables
    const tablesResult = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log('\n✓ Tables in database:');
    tablesResult.rows.forEach(row => console.log(`  - ${row.table_name}`));
    
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('✗ Database connection failed:');
    console.error(`  Error: ${err.message}`);
    console.error(`  Code: ${err.code}`);
    if (err.code === 'ECONNREFUSED') {
      console.error('\n  → PostgreSQL is not running or not reachable at the configured host/port');
    }
    if (err.code === 'ENOTFOUND') {
      console.error('\n  → The configured host name cannot be resolved');
    }
    await pool.end();
    process.exit(1);
  }
}

test();
