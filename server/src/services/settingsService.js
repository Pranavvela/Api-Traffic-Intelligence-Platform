// settingsService.js - Manages detection and throttling settings, with caching for performance and database persistence.
'use strict';

const config = require('../config/config');
const { getSettingsRow, updateSettingsRow } = require('../models/settingsModel');

const cachedByUser = new Map();

function runtimeAdaptiveConfig() {
  return {
    suspicionTtlSeconds: Number.parseInt(process.env.SUSPICION_TTL_SECONDS, 10) || 120,
    repeatWindowSeconds: Number.parseInt(process.env.REPEAT_WINDOW_SECONDS, 10) || 180,
    blockCooldownMinutes: Number.parseInt(process.env.BLOCK_COOLDOWN_MINUTES, 10) || 10,
    throttleScoreThreshold: Number.parseInt(process.env.THROTTLE_SCORE_THRESHOLD, 10) || 40,
    blockScoreThreshold: Number.parseInt(process.env.BLOCK_SCORE_THRESHOLD, 10) || 70,
  };
}

function defaults() {
  return {
    rateLimitThreshold: config.detection.rateLimitThreshold,
    bruteForceThreshold: config.detection.loginFailureThreshold,
    endpointFloodThreshold: config.detection.floodThreshold,
    burstMultiplier: config.detection.burstMultiplier,
    slidingWindowSeconds: Math.round(config.detection.windowSizeMs / 1000),
    throttleDurationMinutes: Math.round(config.throttling.durationMs / 60000),
    autoBlockEnabled: true,
    ...runtimeAdaptiveConfig(),
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
    ...runtimeAdaptiveConfig(),
    updatedAt: row.updated_at,
  };
}

async function loadSettings(userId = null) {
  if (!userId) return defaults();

  const row = await getSettingsRow(userId);
  const mapped = row ? mapRow(row) : defaults();
  cachedByUser.set(userId, mapped);
  return mapped;
}

function getSettings(userId = null) {
  if (!userId) return defaults();
  return cachedByUser.get(userId) || defaults();
}

async function updateSettings(userId, partial) {
  if (!userId) return defaults();

  const current = cachedByUser.get(userId) || await loadSettings(userId);
  const merged = {
    ...current,
    ...partial,
  };

  const row = await updateSettingsRow(userId, {
    rate_limit_threshold: merged.rateLimitThreshold,
    brute_force_threshold: merged.bruteForceThreshold,
    endpoint_flood_threshold: merged.endpointFloodThreshold,
    burst_multiplier: merged.burstMultiplier,
    sliding_window_seconds: merged.slidingWindowSeconds,
    throttle_duration_minutes: merged.throttleDurationMinutes,
    auto_block_enabled: merged.autoBlockEnabled,
  });

  const next = row ? mapRow(row) : merged;
  cachedByUser.set(userId, next);
  return next;
}

module.exports = { loadSettings, getSettings, updateSettings };
