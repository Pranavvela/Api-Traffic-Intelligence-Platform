'use strict';

const config = require('../../config/config');

const ML_SERVICE_URL = config.ml?.serviceUrl || '';

function isExternalEnabled() {
  return Boolean(ML_SERVICE_URL);
}

async function externalRequest(path, options = {}) {
  const url = new URL(path, ML_SERVICE_URL);
  const headers = { 'Content-Type': 'application/json' };
  if (options.headers) {
    Object.assign(headers, options.headers);
  }

  if (options.engine) {
    headers['X-ML-Engine'] = options.engine;
  }

  const body = options.body
    ? JSON.stringify({ ...options.body, ...(options.engine ? { engine: options.engine } : {}) })
    : undefined;

  const response = await fetch(url.toString(), {
    method: options.method || 'GET',
    headers,
    body,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`ML service error (${response.status}): ${text || response.statusText}`);
  }

  const payload = await response.json().catch(() => ({}));
  return payload?.data ?? payload;
}

async function train(opts, engine) {
  const payload = opts || {};
  if (!isExternalEnabled()) {
    return { trained: false, reason: 'External ML service is not configured.' };
  }
  return externalRequest('/train', { method: 'POST', body: payload, engine });
}

async function detect(opts, engine) {
  const payload = opts || {};
  if (!isExternalEnabled()) {
    return { trained: false, results: [] };
  }
  return externalRequest('/detect', { method: 'POST', body: payload, engine });
}

async function status(engine) {
  if (!isExternalEnabled()) {
    return { trained: false, external: true, engine: engine || 'external' };
  }

  try {
    const remote = await externalRequest('/status', { engine });
    return {
      ...remote,
      external: true,
      engine: engine || 'external',
    };
  } catch (err) {
    return {
      trained: false,
      external: true,
      engine: engine || 'external',
      error: err.message,
    };
  }
}

async function scoreIpWindow(ip, windowMs, observationMs, engine) {
  if (!isExternalEnabled()) return null;

  const data = await externalRequest('/detect', {
    method: 'POST',
    body: { windowMs, observationMs, ip },
    engine,
  }).catch(() => null);

  const results = data?.results || data?.data || data;
  if (!Array.isArray(results) || results.length === 0) return null;

  const latest = results.at(-1);
  return {
    ip,
    window_start: latest.window_start,
    anomaly_score: latest.anomaly_score,
    ml_label: latest.ml_label,
    threshold: latest.threshold,
    explainability: latest.explainability || null,
  };
}

module.exports = { train, detect, status, scoreIpWindow, isExternalEnabled };
