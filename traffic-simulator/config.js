'use strict';

require('dotenv').config({ path: require('node:path').resolve(__dirname, '.env') });

function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBool(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function toList(value, fallback) {
  const source = value === undefined || value === null || value === '' ? fallback : value;
  return String(source)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const BASE_URL = process.env.API_URL || 'http://localhost:4000';
const REQUEST_TIMEOUT_MS = toInt(process.env.REQUEST_TIMEOUT_MS, 5000);
const USERS = toInt(process.env.USERS, 40);
const SUMMARY_INTERVAL_MS = toInt(process.env.SUMMARY_INTERVAL_MS, 60000);
const ATTACK_INTERVAL_MS = toInt(process.env.ATTACK_INTERVAL_MS, 300000);

// Safety defaults are strict so simulator traffic does not disrupt normal app usage.
const SAFE_MODE = toBool(process.env.SAFE_MODE, true);
const RUN_DURATION_MS = toInt(process.env.RUN_DURATION_MS, 180000);
const MAX_IN_FLIGHT = toInt(process.env.MAX_IN_FLIGHT, SAFE_MODE ? 8 : 40);
const ENABLE_RUSH_HOUR = toBool(process.env.ENABLE_RUSH_HOUR, false);
const ALLOW_WRITE_NORMAL = toBool(process.env.ALLOW_WRITE_NORMAL, !SAFE_MODE);
const ENABLE_BRUTE_FORCE = toBool(process.env.ENABLE_BRUTE_FORCE, !SAFE_MODE);
const ATTACK_SCALE = Math.max(1, toInt(process.env.ATTACK_SCALE, SAFE_MODE ? 1 : 2));
const ATTACK_PACING_MS = toInt(process.env.ATTACK_PACING_MS, SAFE_MODE ? 120 : 50);
const SIMULATOR_SOURCE = process.env.SIMULATOR_SOURCE || 'traffic-simulator';
const SIMULATOR_IP_FALLBACK = process.env.SIMULATOR_IP_FALLBACK || '198.18.0.10';
const SIM_AUTH_HEADER = process.env.SIM_AUTH_HEADER || 'Authorization';
const SIM_AUTH_TOKEN = process.env.SIM_AUTH_TOKEN || '';
const EXCLUDED_ENDPOINT_PATTERNS = toList(
  process.env.EXCLUDED_ENDPOINT_PATTERNS,
  '/api/auth/register,/api/settings,/api/block-ip,/api/unblock-ip,/api/alerts/reset'
);

module.exports = {
  BASE_URL,
  REQUEST_TIMEOUT_MS,
  USERS,
  SUMMARY_INTERVAL_MS,
  ATTACK_INTERVAL_MS,
  SAFE_MODE,
  RUN_DURATION_MS,
  MAX_IN_FLIGHT,
  ENABLE_RUSH_HOUR,
  ALLOW_WRITE_NORMAL,
  ENABLE_BRUTE_FORCE,
  ATTACK_SCALE,
  ATTACK_PACING_MS,
  SIMULATOR_SOURCE,
  SIMULATOR_IP_FALLBACK,
  SIM_AUTH_HEADER,
  SIM_AUTH_TOKEN,
  EXCLUDED_ENDPOINT_PATTERNS,
};
