'use strict';

const settingsService = require('../services/settingsService');

function parseBool(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return undefined;
}

function parsePositiveInt(value, field) {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${field} must be a positive integer.`);
  }
  return parsed;
}

function parsePositiveNumber(value, field) {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${field} must be a positive number.`);
  }
  return parsed;
}

async function getSettings(req, res, next) {
  try {
    const userId = req.user?.id || null;
    const data = await settingsService.loadSettings(userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function updateSettings(req, res, next) {
  try {
    const body = req.body || {};

    const partial = {
      rateLimitThreshold: parsePositiveInt(body.rateLimitThreshold, 'rateLimitThreshold'),
      bruteForceThreshold: parsePositiveInt(body.bruteForceThreshold, 'bruteForceThreshold'),
      endpointFloodThreshold: parsePositiveInt(body.endpointFloodThreshold, 'endpointFloodThreshold'),
      burstMultiplier: parsePositiveNumber(body.burstMultiplier, 'burstMultiplier'),
      slidingWindowSeconds: parsePositiveInt(body.slidingWindowSeconds, 'slidingWindowSeconds'),
      throttleDurationMinutes: parsePositiveInt(body.throttleDurationMinutes, 'throttleDurationMinutes'),
      autoBlockEnabled: parseBool(body.autoBlockEnabled),
    };

    Object.keys(partial).forEach((key) => {
      if (partial[key] === undefined) delete partial[key];
    });

    if (Object.keys(partial).length === 0) {
      return res.status(400).json({ success: false, message: 'No settings provided.' });
    }

    const data = await settingsService.updateSettings(req.user?.id || null, partial);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = { getSettings, updateSettings };
