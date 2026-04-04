'use strict';

/**
 * High-Traffic Website Simulator
 *
 * Simulates a busy e-commerce / SaaS platform under realistic production load.
 *
 * Behaviour:
 *   • 40 concurrent virtual users, each running their own independent browsing session.
 *   • Every user cycles through realistic page flows: browse → search → login → dashboard.
 *   • Requests fire in parallel across all users — produces 40–80 req/min at baseline.
 *   • Every 2 minutes a "rush hour" spikes concurrency for 20 seconds.
 *   • Diverse IPs drawn from a large pool to simulate a real user base.
 *   • Realistic browser User-Agent strings included on every request.
 *
 * Usage:  node normalTraffic.js
 * Env:    API_URL=http://... (default: http://localhost:4000)
 *         USERS=40           (concurrent virtual users, default: 40)
 */

const axios = require('axios');

const BASE_URL    = process.env.API_URL || 'http://localhost:4000';
const CONCURRENCY = parseInt(process.env.USERS || '40', 10);

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

// ─── Browsing flows ───────────────────────────────────────────────────────────
// weight controls how often virtual users pick this flow (out of 100).
const FLOWS = [
  // Heavy read traffic — product browsing
  {
    weight: 35,
    steps: [
      { method: 'GET',  path: '/api/products',  label: 'browse products' },
      { method: 'GET',  path: '/api/search',    label: 'search',           thinkMs: 800 },
      { method: 'GET',  path: '/api/products',  label: 'refine browse' },
      { method: 'GET',  path: '/api/dashboard', label: 'view dashboard' },
    ],
  },
  // Authenticated session — login then use the app
  {
    weight: 25,
    steps: [
      { method: 'POST', path: '/api/login',     label: 'login (success)',
        data: { username: 'admin', password: 'secret' } },
      { method: 'GET',  path: '/api/dashboard', label: 'post-login dashboard' },
      { method: 'GET',  path: '/api/users',     label: 'user list',        thinkMs: 1000 },
      { method: 'GET',  path: '/api/products',  label: 'browse after login' },
    ],
  },
  // Search-heavy user
  {
    weight: 20,
    steps: [
      { method: 'GET', path: '/api/search',   label: 'search query 1',  thinkMs: 1200 },
      { method: 'GET', path: '/api/search',   label: 'search query 2',  thinkMs: 900  },
      { method: 'GET', path: '/api/products', label: 'view result' },
      { method: 'GET', path: '/api/search',   label: 'search query 3',  thinkMs: 1500 },
    ],
  },
  // Mobile app polling
  {
    weight: 15,
    steps: [
      { method: 'GET', path: '/api/dashboard', label: 'mobile poll' },
      { method: 'GET', path: '/api/products',  label: 'mobile products' },
    ],
  },
  // Admin / internal user
  {
    weight: 5,
    steps: [
      { method: 'POST', path: '/api/login',     label: 'admin login',
        data: { username: 'admin', password: 'secret' } },
      { method: 'GET',  path: '/api/users',     label: 'admin: users' },
      { method: 'GET',  path: '/api/dashboard', label: 'admin: dashboard' },
      { method: 'GET',  path: '/api/search',    label: 'admin: search' },
      { method: 'GET',  path: '/api/products',  label: 'admin: products' },
    ],
  },
];

// Build a weighted array for fast O(1) random selection.
const WEIGHTED_FLOWS = FLOWS.flatMap((f) => Array(f.weight).fill(f));

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pick(arr)           { return arr[Math.floor(Math.random() * arr.length)]; }
function sleep(ms)           { return new Promise((r) => setTimeout(r, ms)); }
function jitter(base, extra) { return base + Math.random() * (extra || base); }

let totalRequests = 0;
const startTime   = Date.now();

async function sendRequest(ip, userAgent, step) {
  try {
    const res = await axios({
      method: step.method,
      url:    `${BASE_URL}${step.path}`,
      data:   step.data,
      headers: { 'X-Forwarded-For': ip, 'User-Agent': userAgent },
      validateStatus: () => true,
      timeout: 5000,
    });

    totalRequests++;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const rpm     = ((totalRequests / (Date.now() - startTime)) * 60000).toFixed(1);

    console.log(
      `[${String(elapsed).padStart(5)}s | ${String(rpm).padStart(5)} rpm]  ` +
      `${step.label.padEnd(26)} | ${ip.padEnd(15)} | ` +
      `${step.method} ${step.path} → ${res.status}`
    );
  } catch (_) {
    // Silently absorb timeouts & connection resets — a real website has these.
  }
}

/**
 * One virtual user: loops forever, each iteration picks a random flow
 * and executes its steps with realistic think-time pauses between them.
 */
async function virtualUser(id) {
  // Stagger startup so all users don't hammer at t=0.
  await sleep(Math.random() * 8000);

  const ip        = pick(IP_POOL);
  const userAgent = pick(USER_AGENTS);

  while (true) {
    const flow = pick(WEIGHTED_FLOWS);

    for (const step of flow.steps) {
      await sendRequest(ip, userAgent, step);
      // Think time: 300ms base + step-specific extra (simulates reading a page).
      await sleep(jitter(300, step.thinkMs || 1000));
    }

    // Session gap: 2–10s before starting a new browsing session.
    await sleep(jitter(2000, 8000));
  }
}

/**
 * Rush-hour manager: every 2 minutes, spawn extra users for 20 seconds
 * to simulate a flash sale / marketing email blast hitting the site.
 */
async function rushHourManager() {
  while (true) {
    await sleep(120_000);

    const extra = Math.floor(CONCURRENCY / 2);
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  RUSH HOUR — +${extra} users for 20s (flash sale simulation)`);
    console.log(`${'─'.repeat(60)}\n`);

    // Launch extra sessions; they will naturally complete their first flow and stop.
    const burst = Array.from({ length: extra }, (_, i) => {
      return (async () => {
        const ip        = pick(IP_POOL);
        const userAgent = pick(USER_AGENTS);
        const flow      = pick(WEIGHTED_FLOWS);
        for (const step of flow.steps) {
          await sendRequest(ip, userAgent, step);
          await sleep(jitter(100, 400));   // faster during rush
        }
      })();
    });

    await Promise.race([Promise.all(burst), sleep(20_000)]);

    console.log('\n  Rush hour ended — back to normal load.\n');
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────────
async function run() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  High-Traffic Website Simulator`);
  console.log(`  Target  : ${BASE_URL}`);
  console.log(`  Users   : ${CONCURRENCY} concurrent virtual users`);
  console.log(`  Expected: ~40–80 req/min (spikes to ~120 during rush hour)`);
  console.log(`${'═'.repeat(60)}\n`);

  const workers = [
    ...Array.from({ length: CONCURRENCY }, (_, i) => virtualUser(i)),
    rushHourManager(),
  ];

  await Promise.all(workers);
}

run().catch((err) => {
  console.error('[Simulator] Fatal:', err.message);
  process.exit(1);
});
