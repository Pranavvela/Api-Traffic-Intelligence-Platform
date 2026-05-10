#!/usr/bin/env node
/**
 * Script to seed registered_apis table with sample endpoints.
 * Run from repo root: node server/scripts/seed_registered_apis.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DB_URL || `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'postgres'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5433}/${process.env.DB_NAME || 'api_traffic'}`,
});

async function seed() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      INSERT INTO registered_apis (user_id, endpoint, method, threshold, is_active, api_type, validation_status)
      VALUES (NULL, '/simulator/test', 'POST', 100, true, 'INTERNAL', 'PENDING')
      ON CONFLICT DO NOTHING
      RETURNING id, endpoint, method;
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Inserted registered_api:', result.rows[0]);
    } else {
      console.log('ℹ️  Endpoint already exists or skipped');
    }
    
    const check = await client.query('SELECT id, endpoint, method, is_active FROM registered_apis WHERE is_active=true;');
    console.log('Current registered_apis:');
    console.table(check.rows);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
