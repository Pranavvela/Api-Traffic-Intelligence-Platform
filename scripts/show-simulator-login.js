#!/usr/bin/env node
'use strict';

const path = require('path');
const jwt = require(path.join(__dirname, '../server/node_modules/jsonwebtoken'));
const dotenv = require(path.join(__dirname, '../server/node_modules/dotenv'));

dotenv.config({ path: path.join(__dirname, '../server/.env') });
const serverConfig = require(path.join(__dirname, '../server/src/config/config'));

const secret = serverConfig.auth.jwtSecret || 'change_me';
const token = jwt.sign(
  { email: 'simulator@traffic-intel.local' },
  secret,
  { subject: '999', expiresIn: '1d' }
);

console.log('\n========================================');
console.log('🔐 SIMULATOR USER LOGIN');
console.log('========================================\n');
console.log('Email:    simulator@traffic-intel.local');
console.log('User ID:  999');
console.log('\nTo login:');
console.log('1. Open browser console (F12 or Ctrl+Shift+I)');
console.log('2. Paste this command:\n');
console.log(`localStorage.setItem('auth_token', '${token}');`);
console.log('\n3. Refresh the page (F5)');
console.log('\nOR open this link in a new tab:\n');
console.log(`data:text/html,<script>localStorage.setItem('auth_token','${token}');window.location='http://localhost:3000'</script>`);
console.log('\n========================================\n');
