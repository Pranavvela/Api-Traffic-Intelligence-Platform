'use strict';

const { addBlockedIp, removeBlockedIp, getAllBlockedIps } = require('../models/blocklistModel');

/**
 * In-memory cache of blocked IPs for fast middleware lookups.
 * Seeded from the database on startup via seedCache().
 */
const blockedSet = new Set();

/**
 * Seed the in-memory set from the database.
 * Call once during application startup.
 */
async function seedCache() {
  try {
    const rows = await getAllBlockedIps();
    rows.forEach((row) => blockedSet.add(row.ip));
    console.log(`[Blocklist] Cache seeded — ${blockedSet.size} blocked IP(s).`);
  } catch (err) {
    console.error('[Blocklist] Failed to seed cache:', err.message);
  }
}

/**
 * Check whether an IP is currently blocked.
 * @param {string} ip
 * @returns {boolean}
 */
function isBlocked(ip) {
  return blockedSet.has(ip);
}

/**
 * Block an IP — updates both the DB and the in-memory cache.
 * @param {string} ip
 * @param {string} [reason]
 * @returns {Promise<Object>}
 */
async function blockIp(ip, reason) {
  const row = await addBlockedIp(ip, reason);
  blockedSet.add(ip);
  console.log(`[Blocklist] Blocked IP: ${ip} — ${reason || 'no reason given'}.`);
  return row;
}

/**
 * Unblock an IP — updates both the DB and the in-memory cache.
 * @param {string} ip
 * @returns {Promise<boolean>}
 */
async function unblockIp(ip) {
  await removeBlockedIp(ip);
  blockedSet.delete(ip);
  console.log(`[Blocklist] Unblocked IP: ${ip}.`);
  return true;
}

/**
 * Return all blocked IPs from the database.
 * @returns {Promise<Object[]>}
 */
async function listBlockedIps() {
  return getAllBlockedIps();
}

module.exports = { seedCache, isBlocked, blockIp, unblockIp, listBlockedIps };
