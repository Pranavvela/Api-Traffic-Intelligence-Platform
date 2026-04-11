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
 * Clear all alerts (unresolved + history).
 */
export async function resetAlerts() {
  const { data } = await client.post('/api/alerts/reset');
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
  const { data } = await client.post('/api/unblock-ip', { ip });
  return data;
}

/**
 * Fetch all blocked IPs.
 */
export async function fetchBlockedIps() {
  const { data } = await client.get('/api/blocked-ips');
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

/**
 * Register a new API endpoint.
 * @param {Object} payload
 */
export async function registerApi(payload) {
  const { data } = await client.post('/api/register', payload);
  return data;
}

/**
 * Fetch all registered APIs.
 */
export async function fetchRegisteredApis() {
  const { data } = await client.get('/api/list');
  return data;
}

/**
 * Delete a registered API by id.
 * @param {number} id
 */
export async function deleteRegisteredApi(id) {
  const { data } = await client.delete(`/api/${id}`);
  return data;
}

/**
 * Validate a registered API by id.
 * @param {number} id
 */
export async function validateRegisteredApi(id) {
  const { data } = await client.post(`/api/validate/${id}`);
  return data;
}

/**
 * Fetch platform settings.
 */
export async function fetchSettings() {
  const { data } = await client.get('/api/settings');
  return data;
}

/**
 * Update platform settings.
 * @param {Object} payload
 */
export async function updateSettings(payload) {
  const { data } = await client.put('/api/settings', payload);
  return data;
}

/**
 * Train ML model.
 * @param {Object} payload
 */
export async function trainMl(payload) {
  const { data } = await client.post('/ml/train', payload);
  return data;
}

/**
 * Fetch ML detection results.
 * @param {Object} params
 */
export async function detectMl(params = {}) {
  const { data } = await client.get('/ml/detect', { params });
  return data;
}

/**
 * Fetch ML model status.
 */
export async function fetchMlStatus() {
  const { data } = await client.get('/ml/status');
  return data;
}

/**
 * Export ML dataset.
 * @param {Object} params
 */
export async function exportMlDataset(params = {}) {
  const { data } = await client.get('/ml/export', { params });
  return data;
}

/**
 * Threat analysis summary.
 */
export async function fetchThreatSummary(params = {}) {
  const { data } = await client.get('/api/threat-analysis/summary', { params });
  return data;
}

/**
 * Threat analysis rule breakdown.
 */
export async function fetchThreatRules(params = {}) {
  const { data } = await client.get('/api/threat-analysis/rules', { params });
  return data;
}

/**
 * Threat analysis timeline.
 */
export async function fetchThreatTimeline(params = {}) {
  const { data } = await client.get('/api/threat-analysis/timeline', { params });
  return data;
}
