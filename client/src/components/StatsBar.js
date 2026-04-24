import React from 'react';
import PropTypes from 'prop-types';
import DashboardCard from './DashboardCard';

export default function StatsBar({ summary, threatLevel }) {
  const rpm = summary?.requestsPerMinute ?? '—';
  const total = summary?.requestCount ?? '—';
  const alerts = summary?.unresolvedAlerts ?? '—';
  const threat = summary?.threatScore ?? '—';
  const topIp = summary?.topIps?.[0]?.ip || summary?.top_attackers?.[0]?.ip || '—';

  const numericRpm = Number(rpm);
  const numericAlerts = Number(alerts);
  const numericThreat = Number(threat);

  function deriveThreatLevel() {
    if (Number.isFinite(numericAlerts) && numericAlerts > 0) return 'High';
    if (Number.isFinite(numericThreat) && numericThreat >= 25) return 'High';
    if (Number.isFinite(numericThreat) && numericThreat >= 10) return 'Medium';
    if (Number.isFinite(numericThreat) && numericThreat >= 0) return 'Low';
    return '—';
  }

  const threatLabel = threatLevel || deriveThreatLevel();
  const threatMeta = threatLabel === '—' ? 'Awaiting telemetry' : `${threatLabel} posture`;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
      <DashboardCard title="Threat Level" value={threatLabel} meta={threatMeta} />
      <DashboardCard title="Requests / min (avg 5m)" value={rpm} meta={numericRpm > 50 ? 'High volume' : 'Stable'} />
      <DashboardCard title="Requests (60s)" value={total} meta="Last minute" />
      <DashboardCard title="Unresolved Alerts" value={alerts} meta={numericAlerts > 0 ? 'Needs attention' : 'All clear'} />
      <DashboardCard title="Threat Score" value={threat} meta={numericThreat > 20 ? 'Elevated' : 'Normal'} />
      <DashboardCard title="Top IP" value={topIp} meta="Most active" />
    </div>
  );
}

StatsBar.propTypes = {
  summary: PropTypes.shape({
    requestsPerMinute: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    requestCount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    unresolvedAlerts: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    threatScore: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    topIps: PropTypes.arrayOf(
      PropTypes.shape({
        ip: PropTypes.string,
      })
    ),
    top_attackers: PropTypes.arrayOf(
      PropTypes.shape({
        ip: PropTypes.string,
      })
    ),
  }),
  threatLevel: PropTypes.string,
};
