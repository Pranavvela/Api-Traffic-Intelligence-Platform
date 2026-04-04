'use strict';

const { blockIp, unblockIp, listBlockedIps } = require('../services/blocklistService');

/**
 * POST /api/block-ip
 * Body: { ip: string, reason?: string }
 */
async function blockIpHandler(req, res, next) {
  try {
    const { ip, reason } = req.body;
    if (!ip || typeof ip !== 'string') {
      return res.status(400).json({ success: false, message: 'ip is required.' });
    }
    const row = await blockIp(ip.trim(), reason || `Manually blocked via dashboard.`);
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
    const ip = decodeURIComponent(req.params.ip);
    await unblockIp(ip);
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
    const data = await listBlockedIps();
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
}

module.exports = { blockIpHandler, unblockIpHandler, listBlockedIpsHandler };
