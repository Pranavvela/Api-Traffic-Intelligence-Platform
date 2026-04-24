import React, { useEffect, useRef, useState, useCallback } from 'react';
import StatsBar from '../components/StatsBar';
import AlertPanel from '../components/AlertPanel';
import AlertHistory from '../components/AlertHistory';
import LogTable from '../components/LogTable';
import TopIpsPanel from '../components/TopIpsPanel';
import EndpointStatsPanel from '../components/EndpointStatsPanel';
import TrafficGraph from '../components/TrafficGraph';
import TopAttackersPanel from '../components/TopAttackersPanel';
import {
  fetchLogs,
  fetchAlerts,
  fetchSummary,
  fetchAlertHistory,
  fetchTrafficGraph,
  fetchAttackers,
} from '../services/api';

// Slightly slower polling improves UI stability during operator actions.
const POLL_INTERVAL_MS = 4000;

function alertKey(alert, index) {
  if (alert?.id !== undefined && alert?.id !== null) return String(alert.id);
  return `${alert?.ip || 'unknown'}|${alert?.timestamp || ''}|${index}`;
}

function alertDigest(alert) {
  return [
    alert?.resolved,
    alert?.severity,
    alert?.source,
    alert?.alert_count,
    alert?.last_seen || alert?.timestamp,
    alert?.mitigation_action,
    alert?.alert_state,
    alert?.confidence_score,
  ].join('|');
}

function reconcileAlerts(prevAlerts, nextAlerts) {
  const previous = Array.isArray(prevAlerts) ? prevAlerts : [];
  const incoming = Array.isArray(nextAlerts) ? nextAlerts : [];

  const prevMap = new Map(previous.map((item, index) => [alertKey(item, index), item]));
  let changed = previous.length !== incoming.length;

  const merged = incoming.map((item, index) => {
    const key = alertKey(item, index);
    const prevItem = prevMap.get(key);
    if (!prevItem) {
      changed = true;
      return item;
    }
    if (alertDigest(prevItem) !== alertDigest(item)) {
      changed = true;
      return item;
    }
    return prevItem;
  });

  return changed ? merged : previous;
}

export default function Dashboard() {
  const [logs, setLogs] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [alertHistory, setAlertHistory] = useState([]);
  const [trafficGraph, setTrafficGraph] = useState([]);
  const [attackers, setAttackers] = useState([]);
  const [trafficRange, setTrafficRange] = useState('5m');
  const [activeTab, setActiveTab] = useState('alerts');
  const pollRef = useRef(null);
  const isFetchingRef = useRef(false); // 🔥 prevents overlapping calls

  const loadAll = useCallback(async () => {
  if (isFetchingRef.current) return;
  isFetchingRef.current = true;

  try {
    const [
      logsRes,
      alertsRes,
      summaryRes,
      historyRes,
      trafficRes,
      attackersRes,
    ] = await Promise.all([
      fetchLogs(100),
      fetchAlerts(false),
      fetchSummary(),
      fetchAlertHistory(50),
      fetchTrafficGraph({ range: trafficRange }),
      fetchAttackers(),
    ]);

    setLogs(Array.isArray(logsRes) ? logsRes : []);
    setAlerts((prev) => reconcileAlerts(prev, alertsRes));
    setSummary(summaryRes || null);
    setAlertHistory(Array.isArray(historyRes) ? historyRes : []);
    setTrafficGraph(Array.isArray(trafficRes) ? trafficRes : []);
    setAttackers(Array.isArray(attackersRes) ? attackersRes : []);

  } catch (err) {
    console.error('Dashboard fetch failed:', err.message);
  } finally {
    isFetchingRef.current = false;
  }
}, [trafficRange]);
  // 🔥 CLEAN LIVE POLLING
  useEffect(() => {
    loadAll();

    pollRef.current = setInterval(() => {
      loadAll();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(pollRef.current);
  }, [loadAll]);

  const topIps = summary?.topIps || [];
  const endpoints = summary?.endpointStats || [];
  const unresolvedAlerts = Number(summary?.unresolvedAlerts ?? 0);
  const activeAlertsCount = Number.isFinite(unresolvedAlerts) ? unresolvedAlerts : 0;
  const threatScoreValue = Number(summary?.threatScore || 0);
  let threatLevel = 'Low';
  if (unresolvedAlerts > 0 || threatScoreValue >= 25) {
    threatLevel = 'High';
  } else if (threatScoreValue >= 10) {
    threatLevel = 'Medium';
  }

  return (
    <div className="space-y-6">

      {/* ───────────── HEADER ───────────── */}
      <section className="glass-panel rounded-3xl p-6">
        <div className="flex justify-between">
          <div>
            <div className="text-xs text-sky-300">Threat Dashboard</div>
            <div className="text-2xl font-semibold text-white mt-2">
              Live API Monitoring
            </div>
            <div className="text-sm text-slate-400 mt-1">
              Real-time logs, alerts, and anomaly detection
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-slate-400">Active Alerts</div>
            <div className="text-3xl text-red-400 font-bold">
              {activeAlertsCount}
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── STATS ───────────── */}
      <StatsBar summary={{ ...summary, top_attackers: attackers }} threatLevel={threatLevel} />

      {/* ───────────── GRAPH ───────────── */}
      <TrafficGraph
        data={trafficGraph}
        range={trafficRange}
        onRangeChange={setTrafficRange}
      />

      {/* ───────────── PANELS WITH TAB NAVIGATION ───────────── */}
      <div className="glass-panel rounded-3xl overflow-hidden">
        
        {/* Tab Navbar */}
        <div className="flex border-b border-slate-600">
          <button
            onClick={() => setActiveTab('alerts')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'alerts'
                ? 'bg-sky-500/20 text-sky-300 border-b-2 border-sky-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Live Alerts
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'logs'
                ? 'bg-sky-500/20 text-sky-300 border-b-2 border-sky-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Recent Logs
          </button>
          <button
            onClick={() => setActiveTab('ips-endpoints')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'ips-endpoints'
                ? 'bg-sky-500/20 text-sky-300 border-b-2 border-sky-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Top IPs & Endpoints
          </button>
          <button
            onClick={() => setActiveTab('attackers')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'attackers'
                ? 'bg-sky-500/20 text-sky-300 border-b-2 border-sky-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Top Attackers
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'history'
                ? 'bg-sky-500/20 text-sky-300 border-b-2 border-sky-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Resolved Alerts
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'alerts' && (
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-white">Live Alerts</h3>
                <p className="text-sm text-slate-400 mt-1">Active threats requiring attention</p>
              </div>
              <AlertPanel alerts={alerts} onResolved={loadAll} />
            </div>
          )}

          {activeTab === 'logs' && (
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-white">Recent Logs</h3>
                <p className="text-sm text-slate-400 mt-1">Latest API activity and requests</p>
              </div>
              <LogTable logs={logs} />
            </div>
          )}

          {activeTab === 'ips-endpoints' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Top IPs</h3>
                <TopIpsPanel topIps={topIps} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Endpoints</h3>
                <EndpointStatsPanel endpoints={endpoints} />
              </div>
            </div>
          )}

          {activeTab === 'attackers' && (
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-white">Top Attackers</h3>
                <p className="text-sm text-slate-400 mt-1">Most active threat sources</p>
              </div>
              <TopAttackersPanel attackers={attackers} />
            </div>
          )}

          {activeTab === 'history' && (
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-white">Resolved Alerts</h3>
                <p className="text-sm text-slate-400 mt-1">Previously addressed security events</p>
              </div>
              <AlertHistory alerts={alertHistory} />
            </div>
          )}
        </div>

      </div>
    </div>
  );
}