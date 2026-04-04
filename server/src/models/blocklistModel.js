'use strict';

const { query } = require('../config/db');

/**
 * Add an IP to the blocked_ips table.
 * If the IP already exists, updates the reason and reset blocked_at.
 * @param {string} ip
 * @param {string} [reason]
 * @returns {Promise<Object>}
 */
async function addBlockedIp(ip, reason) {
  const result = await query(
    `INSERT INTO blocked_ips (ip, reason)
     VALUES ($1, $2)
     ON CONFLICT (ip) DO UPDATE SET reason = EXCLUDED.reason, blocked_at = NOW()
     RETURNING *`,
    [ip, reason || null]
  );
  return result.rows[0];
}

/**
 * Remove an IP from the blocklist.
 * @param {string} ip
 * @returns {Promise<boolean>}
 */
async function removeBlockedIp(ip) {
  await query(`DELETE FROM blocked_ips WHERE ip = $1`, [ip]);
  return true;
}

/**
 * Fetch all blocked IPs.
 * @returns {Promise<Object[]>}
 */
async function getAllBlockedIps() {
  const result = await query(
    `SELECT * FROM blocked_ips ORDER BY blocked_at DESC`
  );
  return result.rows;
}

module.exports = { addBlockedIp, removeBlockedIp, getAllBlockedIps };
