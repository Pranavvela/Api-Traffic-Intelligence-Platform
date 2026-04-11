import React from 'react';

export default function StatsBar({ summary, loading }) {
  const rpm    = summary?.requestsPerMinute  ?? '—';
  const total  = summary?.requestCount       ?? '—';
  const alerts = summary?.unresolvedAlerts   ?? '—';
  const threat = summary?.threatScore        ?? '—';
  const topIp  = summary?.topIps?.[0]?.ip    ?? '—';

  return (
    <div className="stats-bar">
      <StatCard label="Requests / min (avg 5m)" value={rpm} colorClass={rpm > 50 ? 'danger' : 'accent'} />
      <StatCard label="Requests (60s)"    value={total}  colorClass="accent" />
      <StatCard label="Unresolved Alerts" value={alerts} colorClass={alerts > 0 ? 'danger' : ''} />
      <StatCard label="Threat Score"      value={threat} colorClass={threat > 20 ? 'danger' : 'warning'} />
      <StatCard label="Top IP"            value={topIp}  colorClass={topIp !== '—' ? 'warning' : ''} isSmall />
    </div>
  );
}

function StatCard({ label, value, colorClass, isSmall }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${colorClass || ''}`} style={isSmall ? { fontSize: 16, marginTop: 10 } : {}}>
        {value}
      </div>
    </div>
  );
}
