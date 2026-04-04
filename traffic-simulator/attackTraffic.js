'use strict';

/**
 * Attack Traffic Simulator
 *
 * Simulates four categories of malicious API usage designed to trigger
 * the detection rules defined in ruleEngine.js.
 *
 * Attacks:
 *   1. brute-force  — many failed login attempts from one IP
 *   2. flood        — hundreds of rapid requests to one endpoint
 *   3. burst        — sudden spike after a quiet period
 *   4. distributed  — moderate abuse from multiple IPs simultaneously
 *
 * Usage:
 *   node attackTraffic.js                   (runs all attacks sequentially)
 *   ATTACK=brute-force node attackTraffic.js  (runs a single attack)
 */

const axios = require('axios');

const BASE_URL = process.env.API_URL || 'http://localhost:4000';
const ATTACK_TYPE = process.env.ATTACK;  // optional override

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendRequest(method, path, opts = {}) {
  const { ip = '10.0.0.1', data, label = '' } = opts;
  try {
    const response = await axios({
      method,
      url: `${BASE_URL}${path}`,
      data,
      headers: { 'X-Forwarded-For': ip },
      validateStatus: () => true,
    });
    console.log(
      `[Attack] ${label.padEnd(22)} | IP: ${ip.padEnd(15)} | ${method} ${path} → ${response.status}`
    );
    return response.status;
  } catch (err) {
    console.error(`[Attack] Network error on ${path}: ${err.message}`);
    return null;
  }
}

// ── Attack 1: Brute-Force Login ───────────────────────────────────────────────
async function bruteForceLogin() {
  console.log('\n[Attack] ━━━ BRUTE-FORCE LOGIN (targeting /api/login) ━━━\n');
  const attackerIp = '192.168.100.50';
  const passwords = ['password', '123456', 'admin', 'letmein', 'qwerty', 'monkey', 'dragon'];

  for (let i = 0; i < 15; i++) {
    const pwd = passwords[i % passwords.length];
    await sendRequest('POST', '/api/login', {
      ip: attackerIp,
      data: { username: 'admin', password: pwd },
      label: `brute-force login #${i + 1}`,
    });
    await sleep(100);  // Fast — will exceed loginFailureThreshold
  }
}

// ── Attack 2: Endpoint Flooding ───────────────────────────────────────────────
async function endpointFlooding() {
  console.log('\n[Attack] ━━━ ENDPOINT FLOODING (targeting /api/users) ━━━\n');
  const attackerIp = '172.16.50.20';

  for (let i = 0; i < 25; i++) {
    await sendRequest('GET', '/api/users', {
      ip: attackerIp,
      label: `flood request #${i + 1}`,
    });
    await sleep(50);  // Very fast — will exceed both floodThreshold and rateLimitThreshold
  }
}

// ── Attack 3: Traffic Burst ───────────────────────────────────────────────────
async function trafficBurst() {
  console.log('\n[Attack] ━━━ TRAFFIC BURST (targeting /api/search) ━━━\n');
  const attackerIp = '10.20.30.40';

  // Step 1: Establish a low baseline over ~30 seconds (send 3 requests).
  console.log('[Attack] Phase 1: establishing baseline (3 slow requests)...');
  for (let i = 0; i < 3; i++) {
    await sendRequest('GET', '/api/search', { ip: attackerIp, label: `baseline #${i + 1}` });
    await sleep(5000);
  }

  // Step 2: Burst — 20 requests in 2 seconds.
  console.log('[Attack] Phase 2: burst (20 rapid requests)...');
  const burstPromises = [];
  for (let i = 0; i < 20; i++) {
    burstPromises.push(
      sendRequest('GET', '/api/search', { ip: attackerIp, label: `burst #${i + 1}` })
    );
  }
  await Promise.all(burstPromises);
}

// ── Attack 4: Distributed Abuse ───────────────────────────────────────────────
async function distributedAbuse() {
  console.log('\n[Attack] ━━━ DISTRIBUTED ABUSE (/api/dashboard from 5 IPs) ━━━\n');
  const attackerIps = [
    '192.0.2.10',
    '192.0.2.11',
    '192.0.2.12',
    '192.0.2.13',
    '192.0.2.14',
  ];

  // Each IP sends 12 requests rapidly — each individual IP exceeds rateLimitThreshold.
  const allRequests = attackerIps.flatMap((ip) =>
    Array.from({ length: 12 }, (_, i) =>
      sendRequest('GET', '/api/dashboard', { ip, label: `distributed #${i + 1}` })
    )
  );

  // Fire all in parallel.
  await Promise.all(allRequests);
}

// ── Main Orchestrator ─────────────────────────────────────────────────────────
const attacks = {
  'brute-force': bruteForceLogin,
  flood: endpointFlooding,
  burst: trafficBurst,
  distributed: distributedAbuse,
};

async function run() {
  console.log(`\n[Attack Traffic Simulator] Target: ${BASE_URL}`);

  if (ATTACK_TYPE) {
    const fn = attacks[ATTACK_TYPE];
    if (!fn) {
      console.error(`[Attack] Unknown attack type: "${ATTACK_TYPE}". Valid: ${Object.keys(attacks).join(', ')}`);
      process.exit(1);
    }
    await fn();
  } else {
    // Run all attacks sequentially with a pause between each.
    for (const [name, fn] of Object.entries(attacks)) {
      console.log(`\n\n[Attack] ════════════════ Starting: ${name} ════════════════`);
      await fn();
      console.log(`\n[Attack] ════════════════ Completed: ${name} ════════════════`);
      await sleep(5000);  // 5s cooldown between attacks
    }
  }

  console.log('\n[Attack Traffic Simulator] Done.\n');
}

run().catch((err) => {
  console.error('[Attack] Fatal:', err.message);
  process.exit(1);
});
