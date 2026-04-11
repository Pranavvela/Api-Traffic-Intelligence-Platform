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

const POLL_INTERVAL_MS = 5000; // Poll every 5 seconds

export default function Dashboard() {
  const [logs, setLogs] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [alertHistory, setAlertHistory] = useState([]);
  const [trafficGraph, setTrafficGraph] = useState([]);
  const [attackers, setAttackers] = useState([]);
  const [lastSync, setLastSync] = useState(null);
  const [error, setError] = useState(null);

  const pollRef = useRef(null);

  const loadAll = useCallback(async () => {
    try {
      const [logsRes, alertsRes, summaryRes, historyRes, trafficRes, attackersRes] =
        await Promise.all([
          fetchLogs(100),
          fetchAlerts(false),
          fetchSummary(),
          fetchAlertHistory(50),
          fetchTrafficGraph(5),
          fetchAttackers(),
        ]);

      setLogs(logsRes.data || []);
      setAlerts(alertsRes.data || []);
      setSummary(summaryRes.data || null);
      setAlertHistory(historyRes.data || []);
      setTrafficGraph(trafficRes.data || []);
      setAttackers(attackersRes.data || []);
      setLastSync(new Date().toLocaleTimeString());
      setError(null);
    } catch (err) {
      setError(`Failed to reach server: ${err.message}`);
    }
  }, []);

  // Initial load + polling
  useEffect(() => {
    loadAll();
    pollRef.current = setInterval(loadAll, POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
  }, [loadAll]);

  const topIps = summary?.topIps || [];
  const endpoints = summary?.endpointStats || [];

  return (
    <div className="app">
      {/* Main content */}
      <main className="main">
        {/* Row 1: KPI stats */}
        <StatsBar summary={summary} />

        {/* Row 2: Traffic graph (full width) */}
        <TrafficGraph data={trafficGraph} />

        {/* Row 3: Alerts + Logs */}
        <div className="panels">
          <AlertPanel alerts={alerts} onResolved={loadAll} />
          <LogTable logs={logs} />
        </div>

        {/* Row 4: Top IPs + Endpoint stats */}
        <div className="bottom-panels">
          <TopIpsPanel topIps={topIps} />
          <EndpointStatsPanel endpoints={endpoints} />
        </div>

        {/* Row 5: Top Attackers + Alert History */}
        <div className="bottom-panels">
          <TopAttackersPanel attackers={attackers} />
          <AlertHistory alerts={alertHistory} />
        </div>
      </main>
    </div>
  );
}
