import axios from 'axios';
import { getToken, clearToken } from './auth';

const BASE = process.env.REACT_APP_API_URL || '';

const client = axios.create({ baseURL: BASE });

// ───────────── AUTH INTERCEPTORS ─────────────

client.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      clearToken();
      window.location.assign('/login');
    }
    return Promise.reject(err);
  }
);

// 🔥 NORMALIZER (KEY FIX)
const extract = (res) => {
  if (!res) return null;
  if (res.data?.data !== undefined) return res.data.data;
  return res.data;
};

// 🔥 CACHE BUSTER
const noCache = () => `_=${Date.now()}`;

// ───────────── LOGS / STATS ─────────────

export const fetchLogs = async (limit = 100) =>
  extract(await client.get(`/api/logs?limit=${limit}&${noCache()}`));

export const fetchAlerts = async (unresolvedOnly = false) =>
  extract(await client.get(`/api/alerts?unresolved=${unresolvedOnly}&limit=50&${noCache()}`));

export const fetchSummary = async () =>
  extract(await client.get(`/api/stats/summary?${noCache()}`));

export const fetchTrafficGraph = async ({ range = '5m' } = {}) =>
  extract(await client.get(`/api/stats/traffic?range=${range}&${noCache()}`));

export const fetchAttackers = async () =>
  extract(await client.get(`/api/stats/attackers?${noCache()}`));

export const fetchAlertHistory = async (limit = 50) =>
  extract(await client.get(`/api/alerts/history?limit=${limit}&${noCache()}`));

// ───────────── ALERT ACTIONS ─────────────

export const resolveAlert = (id) =>
  client.patch(`/api/alerts/${id}/resolve`);

export const blockIp = (ip) =>
  client.post(`/api/block-ip`, { ip });

// ───────────── API MANAGEMENT ─────────────

export const fetchRegisteredApis = async () =>
  extract(await client.get(`/api/registered-apis`));

export const registerApi = (data) =>
  client.post(`/api/registered-apis`, data);

export const deleteRegisteredApi = (id) =>
  client.delete(`/api/registered-apis/${id}`);

export const updateRegisteredApi = (id, data) =>
  client.patch(`/api/registered-apis/${id}`, data);

export const validateRegisteredApi = (id) =>
  client.post(`/api/registered-apis/${id}/validate`);

// ───────────── BLOCKED IPS ─────────────

export const fetchBlockedIps = async () =>
  extract(await client.get(`/api/blocked-ips`));

export const unblockIp = (ip) =>
  client.post(`/api/unblock-ip`, { ip });

// ───────────── SETTINGS ─────────────

export const fetchSettings = async () =>
  extract(await client.get(`/api/settings`));

export const updateSettings = (data) =>
  client.patch(`/api/settings`, data);

export const resetAlerts = () =>
  client.post(`/api/alerts/reset`);

// ───────────── AUTH ─────────────

// 🔥 IMPORTANT: Ensure correct payload
export const login = async ({ email, password }) => {
  const res = await client.post(`/api/login`, { email, password });
  return extract(res);
};

export const registerUser = async ({ email, password }) => {
  const res = await client.post(`/api/register`, { email, password });
  return extract(res);
};

// ───────────── ML ─────────────

export const fetchMlStatus = async () =>
  extract(await client.get(`/ml/status`));

export const fetchMlModels = async () =>
  extract(await client.get(`/ml/models`));

export const trainMl = () =>
  client.post(`/ml/train`);

export const detectMl = async () =>
  extract(await client.get(`/ml/detect`));

export const activateMlModel = (id) =>
  client.post(`/ml/models/${id}/activate`);

// ───────────── THREAT ANALYSIS ─────────────

export const fetchThreatSummary = async () =>
  extract(await client.get(`/api/threat-summary`));

export const fetchThreatRules = async () =>
  extract(await client.get(`/api/threat-rules`));

export const fetchThreatTimeline = async () =>
  extract(await client.get(`/api/threat-timeline`));