'use strict';

const { query } = require('../config/db');

/**
 * Add an IP to the blocked_ips table.
 * If the IP already exists, updates the reason and reset blocked_at.
 * @param {string} ip
 * @param {string} [reason]
 * @returns {Promise<Object>}
 */
async function addBlockedIp(userId, ip, reason) {
  if (!userId) return null;

  await query(
    `UPDATE blocked_ips
     SET reason = $3,
         blocked_at = NOW()
     WHERE user_id = $1 AND ip = $2`,
    [userId, ip, reason || null]
  );

  const existing = await query(
    `SELECT * FROM blocked_ips WHERE user_id = $1 AND ip = $2 LIMIT 1`,
    [userId, ip]
  );

  if (existing.rows[0]) {
    return existing.rows[0];
  }

  const result = await query(
    `INSERT INTO blocked_ips (user_id, ip, reason)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [userId, ip, reason || null]
  );
  return result.rows[0];
}

/**
 * Remove an IP from the blocklist.
 * @param {string} ip
 * @returns {Promise<boolean>}
 */
async function removeBlockedIp(userId, ip) {
  if (!userId) return false;
  await query(`DELETE FROM blocked_ips WHERE user_id = $1 AND ip = $2`, [userId, ip]);
  return true;
}

/**
 * Fetch all blocked IPs.
 * @returns {Promise<Object[]>}
 */
async function getAllBlockedIps(userId) {
  if (!userId) return [];

  const result = await query(
    `SELECT * FROM blocked_ips WHERE user_id = $1 ORDER BY blocked_at DESC`,
    [userId]
  );
  return result.rows;
}

module.exports = { addBlockedIp, removeBlockedIp, getAllBlockedIps };
