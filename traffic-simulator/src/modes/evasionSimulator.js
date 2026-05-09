// evasionSimulator.js - Slow & Low evasion attack simulation
// Paper: "Adversarial Attacks Against Anomaly Detectors" (2020+)
// 
// Strategy: Generate attacks that evade rule-based detectors by:
// - Spreading traffic over longer windows (avoid rate-limit rules)
// - Using varied endpoints (avoid flood detection)
// - Mixing in legitimate requests (reduce burst detection)
// - Gradual escalation (avoid threshold triggers)

'use strict';

const axios = require('axios');

function randomUserAgent() {
  const agents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
  ];
  return agents[Math.floor(Math.random() * agents.length)];
}

function randomIPInRange(baseIP) {
  // Generate IPs in same /24 to look like distributed botnet
  const parts = baseIP.split('.');
  const lastOctet = Math.floor(Math.random() * 256);
  return `${parts[0]}.${parts[1]}.${parts[2]}.${lastOctet}`;
}

async function sendEvasionRequest(apiUrl, endpoint, attackType) {
  try {
    const config = {
      method: 'GET',
      url: `${apiUrl}${endpoint}`,
      headers: {
        'User-Agent': randomUserAgent(),
      },
      timeout: 5000,
      validateStatus: () => true,
    };

    if (attackType === 'login-evasion') {
      config.method = 'POST';
      config.data = {
        email: `attacker${Math.floor(Math.random() * 10000)}@evade.com`,
        password: 'weakpass123',
      };
    }

    if (attackType === 'brute-force-evasion') {
      config.method = 'POST';
      config.data = {
        email: `test@example.com`,
        password: `pass${Math.floor(Math.random() * 10000000)}`,
      };
    }

    const response = await axios(config);
    return {
      success: true,
      status: response.status,
      endpoint,
      attackType,
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      endpoint,
      attackType,
    };
  }
}

/**
 * Slow & Low Attack: Gradual brute-force with long intervals
 * Evades rate-limit rules by staying under threshold windows
 */
async function slowAndLowAttack(apiUrl, config = {}) {
  const duration = config.durationMs || 120000;  // 2 minutes
  const requestsPerMinute = config.requestsPerMinute || 5; // Stay low
  const interval = (60000 / requestsPerMinute);

  const startTime = Date.now();
  const results = [];

  const attackEndpoints = ['/auth/login', '/api/users', '/api/data', '/api/search'];
  let requestCount = 0;

  while (Date.now() - startTime < duration) {
    const endpoint = attackEndpoints[requestCount % attackEndpoints.length];
    const result = await sendEvasionRequest(apiUrl, endpoint, 'brute-force-evasion');
    results.push(result);
    requestCount++;

    // Sleep to space out requests
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  return {
    attack: 'SLOW_AND_LOW',
    duration_ms: Date.now() - startTime,
    requests_sent: requestCount,
    requests_per_minute: (requestCount / ((Date.now() - startTime) / 60000)).toFixed(2),
    results,
    evasion_strategy: 'Stay under rate-limit thresholds by spacing requests',
  };
}

/**
 * Distributed Attack: Same action, different IPs
 * Evades IP-based blocklists by distributing from many sources
 */
async function distributedEvasionAttack(apiUrl, config = {}) {
  const duration = config.durationMs || 60000;
  const numIPs = config.numIPs || 10;
  const requestsPerIP = config.requestsPerIP || 3;

  const startTime = Date.now();
  const results = [];

  for (let ipIdx = 0; ipIdx < numIPs; ipIdx++) {
    for (let req = 0; req < requestsPerIP; req++) {
      const endpoint = '/auth/login';
      const result = await sendEvasionRequest(apiUrl, endpoint, 'login-evasion');
      results.push({
        ...result,
        virtual_ip_idx: ipIdx,  // Simulated distributed source
      });
    }
  }

  return {
    attack: 'DISTRIBUTED_EVASION',
    duration_ms: Date.now() - startTime,
    virtual_ips: numIPs,
    total_requests: numIPs * requestsPerIP,
    results,
    evasion_strategy: 'Distribute attacks across multiple IPs to evade IP-based blocklists',
  };
}

/**
 * Burst-Hide Attack: Mix attacks with normal traffic
 * Evades burst detection by hiding spikes in normal traffic
 */
async function burstHideAttack(apiUrl, config = {}) {
  const duration = config.durationMs || 60000;
  const burstSize = config.burstSize || 20;
  const normalTrafficPercentage = config.normalTrafficPercentage || 70;

  const startTime = Date.now();
  const results = [];

  let requestCount = 0;
  const normalEndpoints = ['/api/search', '/api/stats', '/api/logs'];
  const attackEndpoint = '/auth/login';

  while (Date.now() - startTime < duration) {
    // Randomly decide: attack or normal
    const isAttack = Math.random() > (normalTrafficPercentage / 100);

    if (isAttack && requestCount % burstSize === 0) {
      // Burst window: send attack
      for (let i = 0; i < Math.min(10, burstSize); i++) {
        const result = await sendEvasionRequest(apiUrl, attackEndpoint, 'brute-force-evasion');
        results.push({ ...result, traffic_type: 'ATTACK' });
      }
    } else {
      // Normal window: send regular traffic
      const endpoint = normalEndpoints[Math.floor(Math.random() * normalEndpoints.length)];
      const result = await sendEvasionRequest(apiUrl, endpoint, undefined);
      results.push({ ...result, traffic_type: 'NORMAL' });
    }

    requestCount++;
    await new Promise(resolve => setTimeout(resolve, 500));  // 500ms between requests
  }

  return {
    attack: 'BURST_HIDE',
    duration_ms: Date.now() - startTime,
    total_requests: requestCount,
    normal_traffic_pct: normalTrafficPercentage,
    burst_size: burstSize,
    results,
    evasion_strategy: 'Mix attacks with normal traffic to hide burst patterns',
  };
}

module.exports = {
  slowAndLowAttack,
  distributedEvasionAttack,
  burstHideAttack,
};
