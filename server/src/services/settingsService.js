'use strict';

const config = require('../config/config');
const { getSettingsRow, updateSettingsRow } = require('../models/settingsModel');

let cached = null;

function defaults() {
  return {
    rateLimitThreshold: config.detection.rateLimitThreshold,
    bruteForceThreshold: config.detection.loginFailureThreshold,
    endpointFloodThreshold: config.detection.floodThreshold,
    burstMultiplier: config.detection.burstMultiplier,
    slidingWindowSeconds: Math.round(config.detection.windowSizeMs / 1000),
    throttleDurationMinutes: Math.round(config.throttling.durationMs / 60000),
    autoBlockEnabled: true,
    updatedAt: null,
  };
}

function mapRow(row) {
  return {
    rateLimitThreshold: row.rate_limit_threshold,
    bruteForceThreshold: row.brute_force_threshold,
    endpointFloodThreshold: row.endpoint_flood_threshold,
    burstMultiplier: Number(row.burst_multiplier),
    slidingWindowSeconds: row.sliding_window_seconds,
    throttleDurationMinutes: row.throttle_duration_minutes,
    autoBlockEnabled: row.auto_block_enabled,
    updatedAt: row.updated_at,
  };
}

async function loadSettings() {
  const row = await getSettingsRow();
  cached = row ? mapRow(row) : defaults();
  return cached;
}

function getSettings() {
  return cached || defaults();
}

async function updateSettings(partial) {
  const current = cached || defaults();
  const merged = {
    ...current,
    ...partial,
  };

  const row = await updateSettingsRow({
    rate_limit_threshold: merged.rateLimitThreshold,
    brute_force_threshold: merged.bruteForceThreshold,
    endpoint_flood_threshold: merged.endpointFloodThreshold,
    burst_multiplier: merged.burstMultiplier,
    sliding_window_seconds: merged.slidingWindowSeconds,
    throttle_duration_minutes: merged.throttleDurationMinutes,
    auto_block_enabled: merged.autoBlockEnabled,
  });

  cached = row ? mapRow(row) : merged;
  return cached;
}

module.exports = { loadSettings, getSettings, updateSettings };
