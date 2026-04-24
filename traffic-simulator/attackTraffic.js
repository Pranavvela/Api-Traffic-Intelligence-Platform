// attackTraffic.js - Simulates various attack patterns against registered APIs for testing detection capabilities.
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
const {
  BASE_URL,
  REQUEST_TIMEOUT_MS,
  MAX_IN_FLIGHT,
  SAFE_MODE,
  ENABLE_BRUTE_FORCE,
  ATTACK_SCALE,
  ATTACK_PACING_MS,
  EXCLUDED_ENDPOINT_PATTERNS,
  SIMULATOR_SOURCE,
  SIMULATOR_IP_FALLBACK,
  SIM_AUTH_HEADER,
  SIM_AUTH_TOKEN,
} = require('./config');

const ATTACK_TYPE = process.env.ATTACK; // optional override

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createLimiter(limit) {
  let active = 0;
  const queue = [];

  async function withLimit(task) {
    if (active >= limit) {
      await new Promise((resolve) => queue.push(resolve));
    }

    active += 1;
    try {
      return await task();
    } finally {
      active -= 1;
      const next = queue.shift();
      if (next) next();
    }
  }

  return { withLimit };
}

function isExcludedEndpoint(endpoint) {
  const value = String(endpoint || '').toLowerCase();
  return EXCLUDED_ENDPOINT_PATTERNS.some((pattern) => value.includes(String(pattern).toLowerCase()));
}

function buildAuthHeaders() {
  if (!SIM_AUTH_TOKEN) return {};
  const token = SIM_AUTH_TOKEN.startsWith('Bearer ') ? SIM_AUTH_TOKEN : `Bearer ${SIM_AUTH_TOKEN}`;
  return { [SIM_AUTH_HEADER]: token };
}

async function fetchRegisteredApis() {
  let res;
  try {
    res = await axios.get(`${BASE_URL}/api/list`, {
      timeout: REQUEST_TIMEOUT_MS,
      headers: buildAuthHeaders(),
    });
  } catch (err) {
    if (err?.response?.status === 401 || err?.response?.status === 403) {
      throw new Error('Unauthorized to list registered APIs. Set SIM_AUTH_TOKEN (JWT) in traffic-simulator/.env.');
    }
    throw err;
  }
  const list = res.data?.data || [];
  return list.filter((api) => {
    const type = String(api.api_type || 'INTERNAL').toUpperCase();
    const endpoint = String(api.endpoint || '');
    if (isExcludedEndpoint(endpoint)) return false;
    // Support both INTERNAL and EXTERNAL APIs
    return api.is_active !== false && api.validation_status !== 'INVALID' && ['INTERNAL', 'EXTERNAL'].includes(type);
  });
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function findLoginEndpoint(apis) {
  const writeApis = apis.filter((a) => ['POST', 'PUT', 'PATCH'].includes(a.method));
  return writeApis.find((a) => /login|auth/i.test(a.endpoint)) || writeApis[0] || null;
}

function resolveRequestUrl(endpoint) {
  const raw = String(endpoint || '').trim();
  if (!raw) return BASE_URL;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/')) return `${BASE_URL}${raw}`;
  return `${BASE_URL}/${raw}`;
}

function isProxyStyleEndpoint(endpoint) {
  const raw = String(endpoint || '').trim().toLowerCase();
  if (!raw) return false;
  if (raw.startsWith('/proxy/')) return true;
  return raw.includes('/proxy/');
}

async function sendRequest(api, opts, summary, limiter, isExternal = false) {
  const safeOpts = opts || {};
  const { ip = '10.0.0.1', data, label = '' } = safeOpts;
  const simulatorIp = ip || SIMULATOR_IP_FALLBACK;
  const targetUrl = resolveRequestUrl(api.endpoint);
  const requestUrl = isExternal || isProxyStyleEndpoint(api.endpoint)
    ? targetUrl
    : `${BASE_URL}/proxy/${targetUrl}`;
  try {
    const headers = {
      'X-Simulator-Traffic': 'true',
      'X-Simulator-Mode': 'attack',
      'X-Simulator-Source': SIMULATOR_SOURCE,
      'X-Simulator-Ip': simulatorIp,
    };

    // Only add auth header for internal APIs
    if (!isExternal) {
      headers['X-Forwarded-For'] = simulatorIp;
      Object.assign(headers, buildAuthHeaders());
    }

    const response = await limiter.withLimit(() => axios({
      method: api.method,
      url: requestUrl,
      data,
      headers,
      validateStatus: () => true,
      timeout: REQUEST_TIMEOUT_MS,
    }));

    if (summary) {
      summary.requests += 1;
      summary.endpoints.add(api.endpoint);
      if (!summary.startTime) summary.startTime = Date.now();
    }

    console.log(
      `[Attack] ${label.padEnd(22)} | IP: ${ip.padEnd(15)} | ${api.method} ${requestUrl} → ${response.status}`
    );
    return response.status;
  } catch (err) {
    console.error(`[Attack] Network error on ${requestUrl}: ${err.message}`);
    return null;
  }
}

// ── Attack 1: Brute-Force Login ─────────────────────────────────────────────
async function bruteForceLogin(apis, summary, apiTypeMap = {}) {
  if (!ENABLE_BRUTE_FORCE) {
    console.log('[Attack] Brute-force scenario skipped (ENABLE_BRUTE_FORCE=false).');
    return;
  }

  const loginApi = findLoginEndpoint(apis);
  if (!loginApi) {
    console.error('[Attack] No writable endpoints available for brute-force.');
    return;
  }

  console.log(`\n[Attack] ━━━ BRUTE-FORCE LOGIN (targeting ${loginApi.endpoint}) ━━━\n`);
  const attackerIp = '192.168.100.50';
  const passwords = ['password', '123456', 'admin', 'letmein', 'qwerty', 'monkey', 'dragon'];
  const isExternal = apiTypeMap[loginApi.endpoint] === 'EXTERNAL';

  for (let i = 0; i < 10 * ATTACK_SCALE; i++) {
    const pwd = passwords[i % passwords.length];
    await sendRequest(loginApi, {
      ip: attackerIp,
      data: { username: 'admin', password: pwd },
      label: `brute-force #${i + 1}`,
    }, summary, bruteForceLogin.limiter, isExternal);
    await sleep(ATTACK_PACING_MS);
  }
}

// ── Attack 2: Endpoint Flooding ─────────────────────────────────────────────
async function endpointFlooding(apis, summary, apiTypeMap = {}) {
  const getApis = apis.filter((a) => a.method === 'GET');
  const target = getApis[0] || apis[0];
  if (!target) {
    console.error('[Attack] No endpoints available for flooding.');
    return;
  }

  console.log(`\n[Attack] ━━━ ENDPOINT FLOODING (targeting ${target.endpoint}) ━━━\n`);
  const attackerIp = '172.16.50.20';
  const isExternal = apiTypeMap[target.endpoint] === 'EXTERNAL';

  for (let i = 0; i < 12 * ATTACK_SCALE; i++) {
    await sendRequest(target, {
      ip: attackerIp,
      label: `flood request #${i + 1}`,
    }, summary, endpointFlooding.limiter, isExternal);
    await sleep(ATTACK_PACING_MS);
  }
}

// ── Attack 3: Traffic Burst ─────────────────────────────────────────────────
async function trafficBurst(apis, summary, apiTypeMap = {}) {
  const getApis = apis.filter((a) => a.method === 'GET');
  const target = getApis[0] || apis[0];
  if (!target) {
    console.error('[Attack] No endpoints available for burst.');
    return;
  }

  console.log(`\n[Attack] ━━━ TRAFFIC BURST (targeting ${target.endpoint}) ━━━\n`);
  const attackerIp = '10.20.30.40';
  const isExternal = apiTypeMap[target.endpoint] === 'EXTERNAL';

  console.log('[Attack] Phase 1: establishing baseline (3 slow requests)...');
  for (let i = 0; i < 3; i++) {
    await sendRequest(target, { ip: attackerIp, label: `baseline #${i + 1}` }, summary, trafficBurst.limiter, isExternal);
    await sleep(5000);
  }

  console.log(`[Attack] Phase 2: burst (${10 * ATTACK_SCALE} paced requests)...`);
  const burstPromises = [];
  for (let i = 0; i < 10 * ATTACK_SCALE; i++) {
    burstPromises.push(
      sendRequest(target, { ip: attackerIp, label: `burst #${i + 1}` }, summary, trafficBurst.limiter, isExternal)
    );
    if (SAFE_MODE) {
      await sleep(ATTACK_PACING_MS);
    }
  }
  await Promise.all(burstPromises);
}

// ── Attack 4: Distributed Abuse ─────────────────────────────────────────────
async function distributedAbuse(apis, summary, apiTypeMap = {}) {
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
  const isExternal = apiTypeMap[target.endpoint] === 'EXTERNAL';

  const allRequests = attackerIps.flatMap((ip) =>
    Array.from({ length: 6 * ATTACK_SCALE }, (_, i) =>
      sendRequest(target, { ip, label: `distributed #${i + 1}` }, summary, distributedAbuse.limiter, isExternal)
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
    console.error('[Attack] No eligible registered APIs available for attack simulation.');
    return;
  }

  // Build map of endpoint -> api type for sendRequest to handle correctly
  const apiTypeMap = {};
  apis.forEach((api) => {
    apiTypeMap[api.endpoint] = api.api_type || 'INTERNAL';
  });

  const summary = options.summary || null;
  const limiter = createLimiter(Math.max(1, MAX_IN_FLIGHT));
  const shouldStop = typeof options.shouldStop === 'function' ? options.shouldStop : () => false;
  const attackType = options.attackType || ATTACK_TYPE;
  const loop = Boolean(options.loop);
  const intervalMs = options.intervalMs || 5000;

  // Attach limiter references used by individual scenarios.
  bruteForceLogin.limiter = limiter;
  endpointFlooding.limiter = limiter;
  trafficBurst.limiter = limiter;
  distributedAbuse.limiter = limiter;

  const internalCount = apis.filter((a) => a.api_type === 'INTERNAL').length;
  const externalCount = apis.filter((a) => a.api_type === 'EXTERNAL').length;

  console.log(`\n[Attack Traffic Simulator] Target: ${BASE_URL}`);
  console.log(`[Attack Traffic Simulator] APIs: ${apis.length} registered (${internalCount} internal, ${externalCount} external)`);
  console.log(`[Attack Traffic Simulator] Safe: ${SAFE_MODE ? 'ON' : 'OFF'} | InFlight: ${MAX_IN_FLIGHT} | Scale: ${ATTACK_SCALE}`);

  async function runOnce(name, fn) {
    if (summary) summary.attackTypes.add(name);
    await fn(apis, summary, apiTypeMap);
  }

  if (attackType) {
    const fn = attacks[attackType];
    if (!fn) {
      console.error(`[Attack] Unknown attack type: "${attackType}". Valid: ${Object.keys(attacks).join(', ')}`);
      process.exit(1);
    }
    if (loop) {
      while (!shouldStop()) {
        await runOnce(attackType, fn);
        if (shouldStop()) break;
        await sleep(intervalMs);
      }
    } else {
      await runOnce(attackType, fn);
    }
  } else {
    if (loop) {
      while (!shouldStop()) {
        for (const [name, fn] of Object.entries(attacks)) {
          if (shouldStop()) break;
          console.log(`\n\n[Attack] ════════════════ Starting: ${name} ════════════════`);
          await runOnce(name, fn);
          console.log(`\n[Attack] ════════════════ Completed: ${name} ════════════════`);
          if (shouldStop()) break;
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
