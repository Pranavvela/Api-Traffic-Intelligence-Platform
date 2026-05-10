'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require(path.join(__dirname, '..', 'src', 'config', 'db'));

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i += 1) {
    const part = args[i];
    if (!part.startsWith('--')) continue;
    const eqIndex = part.indexOf('=');
    if (eqIndex > -1) {
      parsed[part.slice(2, eqIndex)] = part.slice(eqIndex + 1);
    } else {
      parsed[part.slice(2)] = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
    }
  }
  return parsed;
}

async function main() {
  try {
    console.log('Checking ML detection pipeline...\n');

    const args = parseArgs();
    let userId = Number.parseInt(args['user-id'], 10);

    if (!Number.isFinite(userId) && args.email) {
      const userRow = await db.query('SELECT id FROM users WHERE email = $1 LIMIT 1;', [args.email]);
      userId = Number.parseInt(userRow.rows[0]?.id, 10);
    }

    if (!Number.isFinite(userId)) {
      userId = 3;
    }

    // Check if ml_detection_results table exists
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'ml_detection_results'
      ) AS table_exists;
    `);

    if (tableCheck.rows[0].table_exists) {
      console.log('✅ ml_detection_results table EXISTS');

      // Check schema
      const schemaCheck = await db.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'ml_detection_results'
        ORDER BY ordinal_position;
      `);

      console.log('\nTable schema:');
      schemaCheck.rows.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type})`);
      });

      // Count rows
      const countCheck = await db.query('SELECT COUNT(*) AS cnt FROM ml_detection_results WHERE user_id = $1;', [userId]);
      const count = countCheck.rows[0].cnt;
      console.log(`\n📊 ML detection results for user ${userId}: ${count} rows`);

      if (count > 0) {
        console.log('✅ ML detection IS working (data being inserted)\n');
        const recent = await db.query(`
          SELECT y_pred, y_true, anomaly_score, created_at
          FROM ml_detection_results 
          WHERE user_id = $1
          ORDER BY created_at DESC 
          LIMIT 5;
        `, [userId]);
        console.log('Latest 5 records:');
        recent.rows.forEach(r => {
          console.log(`  - pred=${r.y_pred}, true=${r.y_true}, score=${r.anomaly_score}, at=${r.created_at}`);
        });
      } else {
        console.log(`⚠️  No ML detection results found for user ${userId}`);
        console.log('   This means the ML detection pipeline is NOT running.\n');
        console.log('To fix:');
        console.log('   1. Restart server: npm start');
        console.log('   2. Run traffic simulator: cd traffic-simulator && npm run normal:safe');
        console.log('   3. Wait 60 seconds for ML detection to process');
        console.log('   4. Re-run this check script');
      }
    } else {
      console.log('❌ ml_detection_results table DOES NOT EXIST');
      console.log('\nTo fix:');
      console.log('   1. Run: psql -h localhost -p 5433 -U postgres -d api_traffic_db -f server/scripts/add-ml-metrics-table.sql');
      console.log('   2. Restart server: npm start');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err && err.stack ? err.stack : err);
    process.exit(1);
  }
}

main();
