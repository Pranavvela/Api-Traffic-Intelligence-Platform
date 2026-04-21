'use strict';

const { addBlockedIp, removeBlockedIp, getAllBlockedIps } = require('../models/blocklistModel');
const { createSetStore } = require('./store');
const logger = require('../utils/logger');

const blockedSet = createSetStore();

function scopedKey(userId, ip) {
  return `${userId}:${normalizeIp(ip)}`;
}

async function seedCache() {
  try {
    // Tenant rows are lazily warmed per user during requests.
    logger.info('Blocklist cache seed skipped (tenant-scoped mode)');
  } catch (err) {
    logger.error('Blocklist cache seed failed', { error: err.message });
  }
}

function isBlocked(userId, ip) {
  if (!userId) return false;
  return blockedSet.has(scopedKey(userId, ip));
}

async function blockIp(userId, ip, reason) {
  if (!userId) return null;

  const normalizedIp = normalizeIp(ip);

  const row = await addBlockedIp(userId, normalizedIp, reason);
  blockedSet.add(scopedKey(userId, normalizedIp));

  logger.warn('Blocked IP', { userId, ip: normalizedIp, reason: reason || null });
  return row;
}

async function unblockIp(userId, ip) {
  if (!userId) return false;

  const normalizedIp = normalizeIp(ip);

  await removeBlockedIp(userId, normalizedIp);
  blockedSet.delete(scopedKey(userId, normalizedIp));

  logger.info('Unblocked IP', { userId, ip: normalizedIp });
  return true;
}

async function listBlockedIps(userId) {
  if (!userId) return [];

  const rows = await getAllBlockedIps(userId);
  rows.forEach((row) => blockedSet.add(scopedKey(userId, row.ip)));
  return rows;
}

/**
 * Ensure consistency between stored IPs and middleware IPs
 */
function normalizeIp(ip) {
  if (ip === '::1') return '127.0.0.1';
  if (ip.startsWith('::ffff:')) return ip.replace('::ffff:', '');
  return ip;
}

module.exports = {
  seedCache,
  isBlocked,
  blockIp,
  unblockIp,
  listBlockedIps,
};