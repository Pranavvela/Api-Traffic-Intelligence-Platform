//normalTraffic.js - Simulates realistic normal traffic patterns against registered APIs, with dynamic flow generation and a large IP pool.

'use strict';

/**
 * Dynamic Normal-Traffic Simulator
 *
 * Pulls registered APIs from the backend and generates realistic traffic
 * without hardcoding any endpoints.
 *
 * Usage:  node normalTraffic.js
 * Env:    API_URL=http://... (default: http://localhost:4000)
 *         USERS=40           (concurrent virtual users, default: 40)
 */

const axios = require('axios');
const {
  BASE_URL,
  REQUEST_TIMEOUT_MS,
  USERS,
  MAX_IN_FLIGHT,
  ENABLE_RUSH_HOUR,
  ALLOW_WRITE_NORMAL,
  SAFE_MODE,
  EXCLUDED_ENDPOINT_PATTERNS,
  SIMULATOR_SOURCE,
  SIMULATOR_IP_FALLBACK,
  SIM_AUTH_HEADER,
  SIM_AUTH_TOKEN,
} = require('./config');

// ─── Realistic browser user agents ───────────────────────────────────────────
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.105 Mobile Safari/537.36',
  'Mozilla/5.0 (iPad; CPU OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/122.0.6261.89 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:122.0) Gecko/20100101 Firefox/122.0',
];

// ─── Large diverse IP pool — simulates a real user base ──────────────────────
const IP_POOL = [
  ...Array.from({ length: 30 }, (_, i) => `203.0.113.${i + 1}`),
  ...Array.from({ length: 20 }, (_, i) => `198.51.100.${i + 1}`),
  ...Array.from({ length: 20 }, (_, i) => `192.0.2.${i + 50}`),
  ...Array.from({ length: 15 }, (_, i) => `100.64.${i + 1}.1`),
  ...Array.from({ length: 15 }, (_, i) => `185.${i + 100}.10.5`),
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function pick(arr)           { return arr[Math.floor(Math.random() * arr.length)]; }
function sleep(ms)           { return new Promise((r) => setTimeout(r, ms)); }
function jitter(base, extra) { return base + Math.random() * (extra || base); }

function resolveRequestUrl(endpoint) {
  const raw = String(endpoint || '').trim();
  if (!raw) return BASE_URL;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/')) return `${BASE_URL}${raw}`;
  return `${BASE_URL}/${raw}`;
}

function isExcludedEndpoint(endpoint) {
  const value = String(endpoint || '').toLowerCase();
  return EXCLUDED_ENDPOINT_PATTERNS.some((pattern) => value.includes(String(pattern).toLowerCase()));
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
    const method = String(api.method || 'GET').toUpperCase();
    const endpoint = String(api.endpoint || '');
    const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    if (!ALLOW_WRITE_NORMAL && isWrite) return false;
    if (isExcludedEndpoint(endpoint)) return false;
    // Support both INTERNAL and EXTERNAL APIs
    return api.is_active !== false && api.validation_status !== 'INVALID' && ['INTERNAL', 'EXTERNAL'].includes(type);
  });
}

function buildFlows(apis) {
  const getApis = apis.filter((a) => a.method === 'GET');
  const postApis = ALLOW_WRITE_NORMAL ? apis.filter((a) => a.method === 'POST') : [];
  const writeApis = apis.filter((a) => ['POST', 'PUT', 'PATCH'].includes(a.method));

  const loginApi = ALLOW_WRITE_NORMAL
    ? writeApis.find((a) => /login|auth/i.test(a.endpoint)) || pick(writeApis || []) || null
    : null;

  const flowBrowse = {
    weight: 35,
    steps: [
      makeStep(pick(getApis || apis), 'browse'),
      makeStep(pick(getApis || apis), 'search', 800),
      makeStep(pick(getApis || apis), 'refine browse'),
      makeStep(pick(getApis || apis), 'dashboard view'),
    ].filter(Boolean),
  };

  const flowLogin = {
    weight: ALLOW_WRITE_NORMAL ? 25 : 0,
    steps: [
      makeStep(loginApi || pick(postApis || apis), 'login', 600, { username: 'admin', password: 'secret' }),
      makeStep(pick(getApis || apis), 'post-login'),
      makeStep(pick(getApis || apis), 'account view', 1000),
      makeStep(pick(getApis || apis), 'browse after login'),
    ].filter(Boolean),
  };

  const flowSearchHeavy = {
    weight: 20,
    steps: [
      makeStep(pick(getApis || apis), 'search query 1', 1200),
      makeStep(pick(getApis || apis), 'search query 2', 900),
      makeStep(pick(getApis || apis), 'view result'),
      makeStep(pick(getApis || apis), 'search query 3', 1500),
    ].filter(Boolean),
  };

  const flowMobile = {
    weight: 15,
    steps: [
      makeStep(pick(getApis || apis), 'mobile poll'),
      makeStep(pick(getApis || apis), 'mobile view'),
    ].filter(Boolean),
  };

  const flowAdmin = {
    weight: ALLOW_WRITE_NORMAL ? 5 : 0,
    steps: [
      makeStep(loginApi || pick(writeApis || apis), 'admin login', 500, { username: 'admin', password: 'secret' }),
      makeStep(pick(getApis || apis), 'admin list'),
      makeStep(pick(getApis || apis), 'admin dashboard'),
      makeStep(pick(getApis || apis), 'admin search'),
      makeStep(pick(getApis || apis), 'admin overview'),
    ].filter(Boolean),
  };

  const flows = [flowBrowse, flowLogin, flowSearchHeavy, flowMobile, flowAdmin]
    .filter((flow) => flow.weight > 0 && flow.steps.length > 0);

  return flows.length > 0 ? flows : [{ weight: 100, steps: apis.map((a) => makeStep(a, 'request')).filter(Boolean) }];
}

function makeStep(api, label, thinkMs, dataOverride) {
  if (!api) return null;
  const payload = dataOverride || (['POST', 'PUT', 'PATCH'].includes(api.method)
    ? { sample: true, timestamp: Date.now() }
    : undefined);

  return {
    method: api.method,
    path: api.endpoint,
    label,
    thinkMs,
    data: payload,
  };
}

async function sendRequest(ip, userAgent, step, summary, limiter, isExternal = false) {
  try {
    const simulatorIp = ip || SIMULATOR_IP_FALLBACK;

    // For external APIs, request directly; for internal, use proxy
    const requestUrl = isExternal ? resolveRequestUrl(step.path) : `${BASE_URL}/proxy/${resolveRequestUrl(step.path)}`;

    const headers = {
      'User-Agent': userAgent,
      'X-Simulator-Traffic': 'true',
      'X-Simulator-Mode': 'normal',
      'X-Simulator-Source': SIMULATOR_SOURCE,
      'X-Simulator-Ip': simulatorIp,
    };

    // Only add internal-specific headers for internal APIs
    if (!isExternal) {
      headers['X-Forwarded-For'] = simulatorIp;
      Object.assign(headers, buildAuthHeaders());
    }

    await limiter.withLimit(() => axios({
      method: step.method,
      url: requestUrl,
      data: step.data,
      headers,
      validateStatus: () => true,
      timeout: REQUEST_TIMEOUT_MS,
    }));

    if (summary) {
      summary.requests += 1;
      summary.endpoints.add(step.path);
    }

  } catch {}
}

/**
 * One virtual user: loops forever, each iteration picks a random flow
 * and executes its steps with realistic think-time pauses between them.
 */
async function virtualUser(flowPool, summary, limiter, shouldStop, apiTypeMap = {}) {
  await sleep(Math.random() * 8000);

  const ip = pick(IP_POOL);
  const userAgent = pick(USER_AGENTS);

  while (!shouldStop()) {
    const flow = pick(flowPool);

    for (const step of flow.steps) {
      if (shouldStop()) break;
      const isExternal = apiTypeMap[step.path] === 'EXTERNAL';
      await sendRequest(ip, userAgent, step, summary, limiter, isExternal);
      await sleep(jitter(300, step.thinkMs || 1000));
    }

    await sleep(jitter(2000, 8000));
  }
}

/**
 * Rush-hour manager: every 2 minutes, spawn extra users for 20 seconds
 * to simulate a short-lived spike.
 */
async function rushHourManager(flowPool, concurrency, summary, limiter, shouldStop, apiTypeMap = {}) {
  while (!shouldStop()) {
    await sleep(120_000);
    if (shouldStop()) break;

    const extra = Math.floor(concurrency / 2);
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  RUSH HOUR — +${extra} users for 20s (flash spike)`);
    console.log(`${'─'.repeat(60)}\n`);

    const burst = Array.from({ length: extra }, () => {
      return (async () => {
        const ip = pick(IP_POOL);
        const userAgent = pick(USER_AGENTS);
        const flow = pick(flowPool);
        for (const step of flow.steps) {
          if (shouldStop()) break;
          const isExternal = apiTypeMap[step.path] === 'EXTERNAL';
          await sendRequest(ip, userAgent, step, summary, limiter, isExternal);
          await sleep(jitter(100, 400));
        }
      })();
    });

    await Promise.race([Promise.all(burst), sleep(20_000)]);

    console.log('\n  Rush hour ended — back to normal load.\n');
  }
}

async function run(options = {}) {
  const summary = options.summary || null;
  const limiter = createLimiter(Math.max(1, MAX_IN_FLIGHT));
  const shouldStop = typeof options.shouldStop === 'function' ? options.shouldStop : () => false;
  const apis = await fetchRegisteredApis();
  if (apis.length === 0) {
    console.error('[Simulator] No eligible registered APIs found. Register safe endpoints first.');
    return;
  }

  // Build map of endpoint -> api type for sendRequest to handle correctly
  const apiTypeMap = {};
  apis.forEach((api) => {
    apiTypeMap[api.endpoint] = api.api_type || 'INTERNAL';
  });

  const flows = buildFlows(apis);
  const weightedFlows = flows.flatMap((f) => new Array(f.weight).fill(f));

  const internalCount = apis.filter((a) => a.api_type === 'INTERNAL').length;
  const externalCount = apis.filter((a) => a.api_type === 'EXTERNAL').length;

  console.log(`\n${'═'.repeat(60)}`);
  console.log('  Dynamic Normal-Traffic Simulator');
  console.log(`  Target  : ${BASE_URL}`);
  console.log(`  Users   : ${USERS} concurrent virtual users`);
  console.log(`  Safe    : ${SAFE_MODE ? 'ON' : 'OFF'}`);
  console.log(`  Writes  : ${ALLOW_WRITE_NORMAL ? 'ENABLED' : 'DISABLED'}`);
  console.log(`  InFlight: ${MAX_IN_FLIGHT}`);
  console.log(`  APIs    : ${apis.length} registered (${internalCount} internal, ${externalCount} external)`);
  console.log(`${'═'.repeat(60)}\n`);

  const workers = Array.from({ length: USERS }, () => virtualUser(weightedFlows, summary, limiter, shouldStop, apiTypeMap));
  if (ENABLE_RUSH_HOUR) {
    workers.push(rushHourManager(weightedFlows, USERS, summary, limiter, shouldStop, apiTypeMap));
  }

  await Promise.all(workers);
}

if (require.main === module) {
  run().catch((err) => {
    console.error('[Simulator] Fatal:', err.message);
    process.exit(1);
  });
}

module.exports = { run };
