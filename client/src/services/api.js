import axios from 'axios';

const BASE = process.env.REACT_APP_API_URL || '';

const client = axios.create({ baseURL: BASE });

/**
 * Fetch recent API logs.
 * @param {number} limit
 */
export async function fetchLogs(limit = 100) {
  const { data } = await client.get(`/api/logs?limit=${limit}`);
  return data;
}

/**
 * Fetch alerts.
 * @param {boolean} unresolvedOnly
 */
export async function fetchAlerts(unresolvedOnly = false) {
  const { data } = await client.get(`/api/alerts?unresolved=${unresolvedOnly}&limit=50`);
  return data;
}

/**
 * Resolve a single alert by ID.
 * @param {number} id
 */
export async function resolveAlert(id) {
  const { data } = await client.patch(`/api/alerts/${id}/resolve`);
  return data;
}

/**
 * Fetch dashboard summary stats.
 */
export async function fetchSummary() {
  const { data } = await client.get('/api/stats/summary');
  return data;
}

/**
 * Fetch alert history (resolved alerts).
 * @param {number} limit
 */
export async function fetchAlertHistory(limit = 100) {
  const { data } = await client.get(`/api/alerts/history?limit=${limit}`);
  return data;
}

/**
 * Block an IP address.
 * @param {string} ip
 * @param {string} [reason]
 */
export async function blockIp(ip, reason) {
  const { data } = await client.post('/api/block-ip', { ip, reason });
  return data;
}

/**
 * Unblock an IP address.
 * @param {string} ip
 */
export async function unblockIp(ip) {
  const { data } = await client.delete(`/api/block-ip/${encodeURIComponent(ip)}`);
  return data;
}

/**
 * Fetch all blocked IPs.
 */
export async function fetchBlockedIps() {
  const { data } = await client.get('/api/block-ip');
  return data;
}

/**
 * Fetch traffic graph data (requests per minute, last 5 minutes).
 * @param {number} minutes
 */
export async function fetchTrafficGraph(minutes = 5) {
  const { data } = await client.get(`/api/stats/traffic?minutes=${minutes}`);
  return data;
}

/**
 * Fetch top attacker scores.
 */
export async function fetchAttackers() {
  const { data } = await client.get('/api/stats/attackers');
  return data;
}
