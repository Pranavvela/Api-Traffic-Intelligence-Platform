const { Pool } = require('pg');
(async () => {
  const pool = new Pool({
    host: 'localhost',
    port: 5433,
    database: 'api_traffic_db',
    user: 'postgres',
    password: '1234567890',
  });
  try {
    const users = await pool.query('SELECT id, email FROM users ORDER BY id');
    const apis = await pool.query('SELECT id, user_id, endpoint, method, api_type FROM registered_apis ORDER BY user_id');
    console.log('=== USERS ===');
    console.log(JSON.stringify(users.rows, null, 2));
    console.log('\n=== REGISTERED APIS ===');
    console.log(JSON.stringify(apis.rows, null, 2));
  } catch(err) { console.error(err.message); } 
  finally { await pool.end(); }
})();
