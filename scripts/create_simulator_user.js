#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Manual .env parsing
const envPath = path.join(__dirname, '../server/.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
    if (key && key.trim()) process.env[key.trim()] = value;
  });
}

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DB_URL || `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'postgres'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'api_traffic'}`,
});

(async () => {
  const client = await pool.connect();
  try {
    const res = await client.query(
      'INSERT INTO users (id, email, password_hash, created_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT (id) DO NOTHING RETURNING id, email;',
      [999, 'simulator@traffic-intel.local', 'dummy_hash']
    );
    if (res.rows[0]) {
      console.log('✅ Created user 999:', res.rows[0]);
    } else {
      console.log('ℹ️ User 999 already exists');
    }
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
