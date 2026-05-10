#!/usr/bin/env node
/**
 * Generate a fresh JWT token for the traffic simulator.
 * Usage: node get-simulator-token.js [email]
 * Default email: simulator@traffic-intel.local
 */
const jwt = require('jsonwebtoken');
// Use server config so the same JWT secret is used as the running server
const serverConfig = require('./server/src/config/config');

const JWT_SECRET = (serverConfig && serverConfig.auth && serverConfig.auth.jwtSecret)
  ? serverConfig.auth.jwtSecret
  : (process.env.JWT_SECRET || 'change_me');
const email = process.argv[2] || 'simulator@traffic-intel.local';

// Create a token valid for 30 days
const token = jwt.sign(
  { email, sub: '999' }, // sub=999 is a reserved simulator user ID
  JWT_SECRET,
  { expiresIn: '30d' }
);

console.log('Generated Simulator JWT Token:');
console.log('================================');
console.log(token);
console.log('================================');
console.log(`Valid for: 30 days`);
console.log(`Email: ${email}`);
console.log('\nUpdate traffic-simulator/.env with:');
console.log(`SIM_AUTH_TOKEN=${token}`);
