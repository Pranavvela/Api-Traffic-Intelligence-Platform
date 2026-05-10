#!/usr/bin/env node
'use strict';

// Generates a JWT using the server config's secret so tokens verify with the running server.
// Usage:
//  node scripts/generate_jwt.js --sub=999 --email=simulator@traffic-intel.local --expires=30d

const path = require('path');
const jwt = require(path.join(__dirname, '../server/node_modules/jsonwebtoken'));
const dotenv = require(path.join(__dirname, '../server/node_modules/dotenv'));
let argv;
try {
	argv = require('minimist')(process.argv.slice(2));
} catch (e) {
	// fallback simple parser: --key=value or --key value
	argv = {};
	const parts = process.argv.slice(2);
	for (let i = 0; i < parts.length; i++) {
		const p = parts[i];
		if (p.startsWith('--')) {
			const eq = p.indexOf('=');
			if (eq > -1) {
				const k = p.substring(2, eq);
				const v = p.substring(eq + 1);
				argv[k] = v;
			} else {
				const k = p.substring(2);
				const v = parts[i + 1] && !parts[i + 1].startsWith('--') ? parts[i + 1] : true;
				argv[k] = v;
			}
		}
	}
}

// load server .env and config
dotenv.config({ path: path.join(__dirname, '../server/.env') });
const serverConfig = require(path.join(__dirname, '../server/src/config/config'));

const secret = (serverConfig && serverConfig.auth && serverConfig.auth.jwtSecret) || process.env.JWT_SECRET || 'change_me';

const sub = argv.sub || argv.id || '999';
const email = argv.email || argv.e || 'simulator@traffic-intel.local';
const expiresIn = argv.expires || '30d';

const payload = { email };

const token = jwt.sign(payload, secret, { subject: String(sub), expiresIn });

console.log('Generated JWT:');
console.log('================================');
console.log(token);
console.log('================================');
console.log(`sub: ${sub}`);
console.log(`email: ${email}`);
console.log(`expiresIn: ${expiresIn}`);

process.exit(0);
