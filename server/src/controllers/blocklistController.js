'use strict';

const { blockIp, unblockIp, listBlockedIps } = require('../services/blocklistService');

/**
 * POST /api/block-ip
 * Body: { ip: string, reason?: string }
 */
async function blockIpHandler(req, res, next) {
  try {
    const userId = req.user?.id || null;
    const { ip, reason } = req.body;
    if (!ip || typeof ip !== 'string') {
      return res.status(400).json({ success: false, message: 'ip is required.' });
    }
    const row = await blockIp(userId, ip.trim(), reason || `Manually blocked via dashboard.`);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/block-ip/:ip
 * Unblock an IP address.
 */
async function unblockIpHandler(req, res, next) {
  try {
    const userId = req.user?.id || null;
    const ip = decodeURIComponent(req.params.ip);
    await unblockIp(userId, ip);
    res.json({ success: true, message: `IP ${ip} unblocked.` });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/unblock-ip
 * Body: { ip: string }
 */
async function unblockIpBodyHandler(req, res, next) {
  try {
    const userId = req.user?.id || null;
    const { ip } = req.body;
    if (!ip || typeof ip !== 'string') {
      return res.status(400).json({ success: false, message: 'ip is required.' });
    }
    await unblockIp(userId, ip.trim());
    res.json({ success: true, message: `IP ${ip} unblocked.` });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/block-ip
 * List all blocked IPs.
 */
async function listBlockedIpsHandler(req, res, next) {
  try {
    const data = await listBlockedIps(req.user?.id || null);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
}

module.exports = { blockIpHandler, unblockIpHandler, unblockIpBodyHandler, listBlockedIpsHandler };
