'use strict';

/**
 * Dynamic Attack Traffic Simulator
 *
 * Pulls registered APIs from the backend and simulates attacks without
 * hardcoding endpoints.
 *
 * Usage:
 *   node attackTraffic.js
 *   ATTACK=brute-force node attackTraffic.js
 */

const axios = require('axios');
const { BASE_URL, REQUEST_TIMEOUT_MS } = require('./config');

const ATTACK_TYPE = process.env.ATTACK; // optional override

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchRegisteredApis() {
  const res = await axios.get(`${BASE_URL}/api/list`, { timeout: REQUEST_TIMEOUT_MS });
  const list = res.data?.data || [];
  return list.filter((api) => {
    const type = String(api.api_type || 'INTERNAL').toUpperCase();
    return api.is_active !== false && api.validation_status !== 'INVALID' && type === 'INTERNAL';
  });
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function findLoginEndpoint(apis) {
  const writeApis = apis.filter((a) => ['POST', 'PUT', 'PATCH'].includes(a.method));
  return writeApis.find((a) => /login|auth/i.test(a.endpoint)) || writeApis[0] || null;
}

async function sendRequest(api, opts = {}, summary) {
  const { ip = '10.0.0.1', data, label = '' } = opts;
  try {
    const response = await axios({
      method: api.method,
      url: `${BASE_URL}${api.endpoint}`,
      data,
      headers: { 'X-Forwarded-For': ip },
      validateStatus: () => true,
      timeout: REQUEST_TIMEOUT_MS,
    });

    if (summary) {
      summary.requests += 1;
      summary.endpoints.add(api.endpoint);
      if (!summary.startTime) summary.startTime = Date.now();
    }

    console.log(
      `[Attack] ${label.padEnd(22)} | IP: ${ip.padEnd(15)} | ${api.method} ${api.endpoint} → ${response.status}`
    );
    return response.status;
  } catch (err) {
    console.error(`[Attack] Network error on ${api.endpoint}: ${err.message}`);
    return null;
  }
}

// ── Attack 1: Brute-Force Login ─────────────────────────────────────────────
async function bruteForceLogin(apis, summary) {
  const loginApi = findLoginEndpoint(apis);
  if (!loginApi) {
    console.error('[Attack] No writable endpoints available for brute-force.');
    return;
  }

  console.log(`\n[Attack] ━━━ BRUTE-FORCE LOGIN (targeting ${loginApi.endpoint}) ━━━\n`);
  const attackerIp = '192.168.100.50';
  const passwords = ['password', '123456', 'admin', 'letmein', 'qwerty', 'monkey', 'dragon'];

  for (let i = 0; i < 15; i++) {
    const pwd = passwords[i % passwords.length];
    await sendRequest(loginApi, {
      ip: attackerIp,
      data: { username: 'admin', password: pwd },
      label: `brute-force #${i + 1}`,
    }, summary);
    await sleep(100);
  }
}

// ── Attack 2: Endpoint Flooding ─────────────────────────────────────────────
async function endpointFlooding(apis, summary) {
  const getApis = apis.filter((a) => a.method === 'GET');
  const target = getApis[0] || apis[0];
  if (!target) {
    console.error('[Attack] No endpoints available for flooding.');
    return;
  }

  console.log(`\n[Attack] ━━━ ENDPOINT FLOODING (targeting ${target.endpoint}) ━━━\n`);
  const attackerIp = '172.16.50.20';

  for (let i = 0; i < 25; i++) {
    await sendRequest(target, {
      ip: attackerIp,
      label: `flood request #${i + 1}`,
    }, summary);
    await sleep(50);
  }
}

// ── Attack 3: Traffic Burst ─────────────────────────────────────────────────
async function trafficBurst(apis, summary) {
  const getApis = apis.filter((a) => a.method === 'GET');
  const target = getApis[0] || apis[0];
  if (!target) {
    console.error('[Attack] No endpoints available for burst.');
    return;
  }

  console.log(`\n[Attack] ━━━ TRAFFIC BURST (targeting ${target.endpoint}) ━━━\n`);
  const attackerIp = '10.20.30.40';

  console.log('[Attack] Phase 1: establishing baseline (3 slow requests)...');
  for (let i = 0; i < 3; i++) {
    await sendRequest(target, { ip: attackerIp, label: `baseline #${i + 1}` }, summary);
    await sleep(5000);
  }

  console.log('[Attack] Phase 2: burst (20 rapid requests)...');
  const burstPromises = [];
  for (let i = 0; i < 20; i++) {
    burstPromises.push(
      sendRequest(target, { ip: attackerIp, label: `burst #${i + 1}` }, summary)
    );
  }
  await Promise.all(burstPromises);
}

// ── Attack 4: Distributed Abuse ─────────────────────────────────────────────
async function distributedAbuse(apis, summary) {
  const getApis = apis.filter((a) => a.method === 'GET');
  const target = getApis[0] || apis[0];
  if (!target) {
    console.error('[Attack] No endpoints available for distributed abuse.');
    return;
  }

  console.log(`\n[Attack] ━━━ DISTRIBUTED ABUSE (${target.endpoint} from 5 IPs) ━━━\n`);
  const attackerIps = [
    '192.0.2.10',
    '192.0.2.11',
    '192.0.2.12',
    '192.0.2.13',
    '192.0.2.14',
  ];

  const allRequests = attackerIps.flatMap((ip) =>
    Array.from({ length: 12 }, (_, i) =>
      sendRequest(target, { ip, label: `distributed #${i + 1}` }, summary)
    )
  );

  await Promise.all(allRequests);
}

const attacks = {
  'brute-force': bruteForceLogin,
  flood: endpointFlooding,
  burst: trafficBurst,
  distributed: distributedAbuse,
};

async function run(options = {}) {
  const apis = await fetchRegisteredApis();
  if (apis.length === 0) {
    console.error('[Attack] No INTERNAL registered APIs available for attack simulation.');
    process.exit(1);
  }

  const summary = options.summary || null;
  const attackType = options.attackType || ATTACK_TYPE;
  const loop = Boolean(options.loop);
  const intervalMs = options.intervalMs || 5000;

  console.log(`\n[Attack Traffic Simulator] Target: ${BASE_URL}`);
  console.log(`[Attack Traffic Simulator] APIs: ${apis.length} registered endpoints`);

  async function runOnce(name, fn) {
    if (summary) summary.attackTypes.add(name);
    await fn(apis, summary);
  }

  if (attackType) {
    const fn = attacks[attackType];
    if (!fn) {
      console.error(`[Attack] Unknown attack type: "${attackType}". Valid: ${Object.keys(attacks).join(', ')}`);
      process.exit(1);
    }
    if (loop) {
      while (true) {
        await runOnce(attackType, fn);
        await sleep(intervalMs);
      }
    } else {
      await runOnce(attackType, fn);
    }
  } else {
    if (loop) {
      while (true) {
        for (const [name, fn] of Object.entries(attacks)) {
          console.log(`\n\n[Attack] ════════════════ Starting: ${name} ════════════════`);
          await runOnce(name, fn);
          console.log(`\n[Attack] ════════════════ Completed: ${name} ════════════════`);
          await sleep(intervalMs);
        }
      }
    } else {
      for (const [name, fn] of Object.entries(attacks)) {
        console.log(`\n\n[Attack] ════════════════ Starting: ${name} ════════════════`);
        await runOnce(name, fn);
        console.log(`\n[Attack] ════════════════ Completed: ${name} ════════════════`);
        await sleep(5000);
      }
    }
  }

  console.log('\n[Attack Traffic Simulator] Done.\n');
}

if (require.main === module) {
  run().catch((err) => {
    console.error('[Attack] Fatal:', err.message);
    process.exit(1);
  });
}

module.exports = { run };
