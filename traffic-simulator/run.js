// run.js - Main entry point for the traffic simulator, orchestrating normal and attack traffic generation based on the selected mode.
'use strict';

const { SUMMARY_INTERVAL_MS, ATTACK_INTERVAL_MS, RUN_DURATION_MS, SAFE_MODE } = require('./config');
const normal = require('./normalTraffic');
const attack = require('./attackTraffic');

const modeArg = process.argv[2];
const MODE = (modeArg || process.env.MODE || 'normal').toLowerCase();

function createSummary(mode) {
  return {
    mode,
    requests: 0,
    endpoints: new Set(),
    attackTypes: new Set(),
    startTime: Date.now(),
  };
}

function printSummary(summary) {
  const elapsedSec = Math.max(Math.floor((Date.now() - summary.startTime) / 1000), 1);
  const rpm = ((summary.requests / elapsedSec) * 60).toFixed(1);
  const endpoints = Array.from(summary.endpoints).slice(0, 10).join(', ');
  const attackTypes = Array.from(summary.attackTypes).join(', ') || 'none';

  console.log('\n[Simulator Summary]');
  console.log(`Mode            : ${summary.mode}`);
  console.log(`Requests sent   : ${summary.requests}`);
  console.log(`Requests/min    : ${rpm}`);
  console.log(`Attack types    : ${attackTypes}`);
  console.log(`Endpoints used  : ${endpoints || 'none'}`);
  if (summary.endpoints.size > 10) {
    console.log(`Endpoints total : ${summary.endpoints.size}`);
  }
  console.log('');
}

async function run() {
  const summary = createSummary(MODE);
  const runStart = Date.now();
  const shouldStop = () => Date.now() - runStart >= RUN_DURATION_MS;

  const intervalId = setInterval(() => printSummary(summary), SUMMARY_INTERVAL_MS);

  const shutdown = () => {
    clearInterval(intervalId);
    printSummary(summary);
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log(`[Simulator] Mode=${MODE} | Safe=${SAFE_MODE ? 'ON' : 'OFF'} | Duration=${Math.round(RUN_DURATION_MS / 1000)}s`);

  if (MODE === 'normal') {
    await normal.run({ summary, shouldStop });
    shutdown();
    return;
  }

  if (MODE === 'attack') {
    await attack.run({ summary, shouldStop });
    shutdown();
    return;
  }

  if (MODE === 'mixed') {
    await Promise.all([
      normal.run({ summary, shouldStop }),
      attack.run({ summary, shouldStop, loop: true, intervalMs: ATTACK_INTERVAL_MS }),
    ]);
    shutdown();
    return;
  }

  console.error(`[Simulator] Unknown mode: "${MODE}". Use normal, attack, or mixed.`);
  process.exit(1);
}

run().catch((err) => {
  console.error('[Simulator] Fatal:', err.message);
  process.exit(1);
});
