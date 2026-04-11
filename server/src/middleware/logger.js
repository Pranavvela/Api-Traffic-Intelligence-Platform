'use strict';

const { v4: uuidv4 } = require('uuid');
const { insertLog } = require('../models/logModel');
const detectionService = require('../services/detectionService');
const blocklist = require('../services/blocklistService');
const throttling = require('../services/throttlingService');

// These internal monitoring routes must NOT log themselves — doing so creates
// an infinite feedback loop where dashboard polling floods the database.
const EXCLUDED_PREFIXES = ['/api/logs', '/api/alerts', '/api/stats', '/api/block-ip', '/health'];

/**
 * Express middleware that:
 *  1. Attaches a unique request ID to each request.
 *  2. Records response timing.
 *  3. Persists the log entry to PostgreSQL after the response is sent.
 *  4. Triggers the detection pipeline asynchronously.
 *
 * Monitoring routes (/api/logs, /api/alerts, /api/stats, /health) are excluded
 * to prevent self-referential logging.
 */
function requestLogger(req, res, next) {
  const isExcluded = EXCLUDED_PREFIXES.some((prefix) => req.path.startsWith(prefix));
  if (isExcluded) return next();

  const ip = normaliseIp(req);

  // ── IP blocking check ─────────────────────────────────────────────────────
  if (blocklist.isBlocked(ip)) {
    // Log the blocked attempt then deny.
    const blockedEntry = {
      requestId: uuidv4(),
      ip,
      method: req.method,
      endpoint: req.path,
      statusCode: 403,
      responseMs: 0,
      userAgent: req.headers['user-agent'] || null,
      alertTriggered: false,
      isBlocked: true,
      timestamp: new Date().toISOString(),
    };
    insertLog(blockedEntry).catch((err) =>
      console.error('[Logger] Failed to log blocked request:', err.message)
    );
    return res.status(403).json({ success: false, message: 'Your IP has been blocked.' });
  }

  // ── Throttling check ─────────────────────────────────────────────────────
  if (throttling.isThrottled(ip)) {
    const shouldReject = throttling.shouldReject(ip);
    if (shouldReject) {
      const throttledEntry = {
        requestId: uuidv4(),
        ip,
        method: req.method,
        endpoint: req.path,
        statusCode: 429,
        responseMs: 0,
        userAgent: req.headers['user-agent'] || null,
        alertTriggered: false,
        isBlocked: false,
        timestamp: new Date().toISOString(),
      };

      insertLog(throttledEntry).catch((err) =>
        console.error('[Logger] Failed to log throttled request:', err.message)
      );

      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
      });
    }
  }

  const requestId = uuidv4();
  const startTime = Date.now();

  req.requestId = requestId;
  req.requestStartTime = startTime;

  // Capture the response finish event so we have the final status code.
  res.on('finish', async () => {
    const responseMs = Date.now() - startTime;

    const logEntry = {
      requestId,
      ip,
      method: req.method,
      endpoint: req.path,
      statusCode: res.statusCode,
      responseMs,
      userAgent: req.headers['user-agent'] || null,
      alertTriggered: false,
      isBlocked: false,
      timestamp: new Date(startTime).toISOString(),
    };

    try {
      const savedLog = await insertLog(logEntry);
      // Fire detection asynchronously — do NOT await here to avoid blocking the event loop.
      detectionService.analyse(logEntry, savedLog).catch((err) => {
        console.error('[Logger] Detection error:', err.message);
      });
    } catch (err) {
      console.error('[Logger] Failed to persist log:', err.message);
    }
  });

  next();
}

/**
 * Resolve the real client IP, respecting common proxy headers.
 * @param {import('express').Request} req
 * @returns {string}
 */
function normaliseIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || '0.0.0.0';
}

module.exports = requestLogger;
