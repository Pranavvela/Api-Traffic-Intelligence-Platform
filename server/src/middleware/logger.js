'use strict';

const { v4: uuidv4 } = require('uuid');
const { insertLog } = require('../models/logModel');
const detectionService = require('../services/detectionService');
const blocklist = require('../services/blocklistService');
const throttling = require('../services/throttlingService');
const config = require('../config/config');
const logger = require('../utils/logger');

const EXCLUDED_PREFIXES = ['/api/logs', '/api/alerts', '/api/stats', '/api/block-ip', '/health'];

function isInternalRoute(path) {
  const prefixes = config.allowlist.internalPrefixes || [];
  return prefixes.some((prefix) => path.startsWith(prefix));
}

function requestLogger(req, res, next) {
  const isExcluded = EXCLUDED_PREFIXES.some((prefix) => req.path.startsWith(prefix));
  if (isExcluded) return next();

  const ip = normaliseIp(req);

  const isProxyRequest = req.originalUrl.startsWith('/proxy');
  const isApiRequest = req.originalUrl.startsWith('/api');
  const isInternal = isInternalRoute(req.path);

  const userId = req.user?.id || null;

  // 🔥 Skip completely unrelated routes
  if (!isProxyRequest && !isApiRequest) return next();

  // ── BLOCKING (ONLY FOR PROXY TRAFFIC) ─────────────────────────────
  if (isProxyRequest && !isInternal && blocklist.isBlocked(userId, ip)) {
    return res.status(403).json({
      success: false,
      message: 'Your IP has been blocked.',
      code: 'BLOCKED_IP',
    });
  }

  // ── THROTTLING (ONLY FOR PROXY TRAFFIC) ───────────────────────────
  if (isProxyRequest && !isInternal && throttling.isThrottled(userId, ip)) {
    const shouldReject = throttling.shouldReject(userId, ip, req.originalUrl);

    if (shouldReject) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
        code: 'RATE_LIMITED',
      });
    }
  }

  const requestId = uuidv4();
  const startTime = Date.now();

  req.requestId = requestId;

  res.on('finish', async () => {
    const responseMs = Date.now() - startTime;

    const logEntry = {
      requestId,
      userId,
      ip,
      method: req.method,
      endpoint: req.originalUrl,
      statusCode: res.statusCode,
      responseMs,
      userAgent: req.headers['user-agent'] || null,
      alertTriggered: false,
      isBlocked: false,
      timestamp: new Date(startTime).toISOString(),
    };

    try {
      const savedLog = await insertLog(logEntry);

      // 🔥 RUN DETECTION FOR BOTH API + PROXY
      if (isProxyRequest || isApiRequest) {
        detectionService.analyse(logEntry, savedLog).catch((err) => {
          logger.error('Detection error', { error: err.message, ip: logEntry.ip });
        });
      }

    } catch (err) {
      logger.error('Failed to persist log', { error: err.message, ip: logEntry.ip });
    }
  });

  next();
}

/**
 * Normalize IP address
 */
function normaliseIp(req) {
  const simulatorFlag = String(req.headers['x-simulator-traffic'] || '').toLowerCase() === 'true';
  const simulatorIpHeader = String(req.headers['x-simulator-ip'] || '').trim();
  const forwarded = req.headers['x-forwarded-for'];

  let ip = forwarded
    ? forwarded.split(',')[0].trim()
    : req.socket?.remoteAddress || req.ip || '0.0.0.0';

  // 🔥 Simulator handling
  if (simulatorFlag) {
    const fromHeader = simulatorIpHeader || ip;

    const isLocal =
      fromHeader === '127.0.0.1' ||
      fromHeader === '::1' ||
      fromHeader.startsWith('::ffff:127.0.0.1');

    if (isLocal) return '198.18.0.10';

    if (fromHeader.startsWith('::ffff:')) {
      return fromHeader.replace('::ffff:', '');
    }

    return fromHeader;
  }

  // Normal normalization
  if (ip === '::1') return '127.0.0.1';
  if (ip.startsWith('::ffff:')) return ip.replace('::ffff:', '');

  return ip;
}

module.exports = requestLogger;