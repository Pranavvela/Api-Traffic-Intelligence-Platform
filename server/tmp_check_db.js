'use strict';

// Quick DB connectivity check using server config
const config = require('./src/config/config');
const { Pool } = require('pg');

(async function(){
  const pool = new Pool(config.db);
  try{
    console.log('Using DB config:', { host: config.db.host, port: config.db.port, database: config.db.database, user: config.db.user });
    const res = await pool.query('SELECT NOW() as now');
    console.log('DB OK:', res.rows[0]);
    await pool.end();
    process.exit(0);
  }catch(err){
    console.error('DB ERROR:', err && err.message, err && err.code);
    try{ await pool.end(); }catch(e){}
    process.exit(2);
  }
})();
