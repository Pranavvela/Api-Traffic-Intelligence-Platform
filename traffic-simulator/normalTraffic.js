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
const { BASE_URL, REQUEST_TIMEOUT_MS, USERS } = require('./config');

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

async function fetchRegisteredApis() {
  const res = await axios.get(`${BASE_URL}/api/list`, { timeout: REQUEST_TIMEOUT_MS });
  const list = res.data?.data || [];
  return list.filter((api) => {
    const type = String(api.api_type || 'INTERNAL').toUpperCase();
    return api.is_active !== false && api.validation_status !== 'INVALID' && type === 'INTERNAL';
  });
}

function buildFlows(apis) {
  const getApis = apis.filter((a) => a.method === 'GET');
  const postApis = apis.filter((a) => a.method === 'POST');
  const writeApis = apis.filter((a) => ['POST', 'PUT', 'PATCH'].includes(a.method));

  const loginApi = writeApis.find((a) => /login|auth/i.test(a.endpoint)) || pick(writeApis || []) || null;

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
    weight: 25,
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
    weight: 5,
    steps: [
      makeStep(loginApi || pick(writeApis || apis), 'admin login', 500, { username: 'admin', password: 'secret' }),
      makeStep(pick(getApis || apis), 'admin list'),
      makeStep(pick(getApis || apis), 'admin dashboard'),
      makeStep(pick(getApis || apis), 'admin search'),
      makeStep(pick(getApis || apis), 'admin overview'),
    ].filter(Boolean),
  };

  const flows = [flowBrowse, flowLogin, flowSearchHeavy, flowMobile, flowAdmin]
    .filter((flow) => flow.steps.length > 0);

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

async function sendRequest(ip, userAgent, step, summary) {
  try {
    const res = await axios({
      method: step.method,
      url: `${BASE_URL}${step.path}`,
      data: step.data,
      headers: { 'X-Forwarded-For': ip, 'User-Agent': userAgent },
      validateStatus: () => true,
      timeout: REQUEST_TIMEOUT_MS,
    });

    if (summary) {
      summary.requests += 1;
      summary.endpoints.add(step.path);
      if (!summary.startTime) summary.startTime = Date.now();
    }

    const startTime = summary?.startTime || Date.now();
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const rpm = summary
      ? ((summary.requests / (Date.now() - startTime)) * 60000).toFixed(1)
      : '0.0';

    console.log(
      `[${String(elapsed).padStart(5)}s | ${String(rpm).padStart(5)} rpm]  ` +
      `${step.label.padEnd(20)} | ${ip.padEnd(15)} | ` +
      `${step.method} ${step.path} → ${res.status}`
    );
  } catch (_) {
    // Silently absorb timeouts & connection resets.
  }
}

/**
 * One virtual user: loops forever, each iteration picks a random flow
 * and executes its steps with realistic think-time pauses between them.
 */
async function virtualUser(flowPool, summary) {
  await sleep(Math.random() * 8000);

  const ip = pick(IP_POOL);
  const userAgent = pick(USER_AGENTS);

  while (true) {
    const flow = pick(flowPool);

    for (const step of flow.steps) {
      await sendRequest(ip, userAgent, step, summary);
      await sleep(jitter(300, step.thinkMs || 1000));
    }

    await sleep(jitter(2000, 8000));
  }
}

/**
 * Rush-hour manager: every 2 minutes, spawn extra users for 20 seconds
 * to simulate a short-lived spike.
 */
async function rushHourManager(flowPool, concurrency, summary) {
  while (true) {
    await sleep(120_000);

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
          await sendRequest(ip, userAgent, step, summary);
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
  const apis = await fetchRegisteredApis();
  if (apis.length === 0) {
    console.error('[Simulator] No registered APIs found. Register endpoints first.');
    process.exit(1);
  }

  const flows = buildFlows(apis);
  const weightedFlows = flows.flatMap((f) => Array(f.weight).fill(f));

  console.log(`\n${'═'.repeat(60)}`);
  console.log('  Dynamic Normal-Traffic Simulator');
  console.log(`  Target  : ${BASE_URL}`);
  console.log(`  Users   : ${USERS} concurrent virtual users`);
  console.log(`  APIs    : ${apis.length} registered endpoints`);
  console.log(`${'═'.repeat(60)}\n`);

  const workers = [
    ...Array.from({ length: USERS }, () => virtualUser(weightedFlows, summary)),
    rushHourManager(weightedFlows, USERS, summary),
  ];

  await Promise.all(workers);
}

if (require.main === module) {
  run().catch((err) => {
    console.error('[Simulator] Fatal:', err.message);
    process.exit(1);
  });
}

module.exports = { run };
