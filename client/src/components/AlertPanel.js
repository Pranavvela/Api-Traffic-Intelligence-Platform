import React from 'react';
import { resolveAlert, blockIp } from '../services/api';

const SEVERITY_CLASS = {
  critical: 'badge-critical',
  high:     'badge-high',
  medium:   'badge-medium',
  low:      'badge-low',
};

const RULE_LABELS = {
  RATE_LIMIT_VIOLATION:    'Rate Limit',
  REPEATED_LOGIN_FAILURE:  'Brute Force',
  ENDPOINT_FLOODING:       'Flooding',
  BURST_DETECTION:         'Burst',
  BURST_TRAFFIC:           'Burst Traffic',
  ENDPOINT_FLOOD:          'Endpoint Flood',
};

export default function AlertPanel({ alerts, onResolved }) {
  const active = alerts.filter((a) => !a.resolved);

  async function handleResolve(id) {
    try {
      await resolveAlert(id);
      onResolved();
    } catch (err) {
      console.error('Failed to resolve alert:', err.message);
    }
  }

  async function handleBlock(ip, alertId) {
    try {
      await blockIp(ip, `Blocked from dashboard alert #${alertId}.`);
      await resolveAlert(alertId);
      onResolved();
    } catch (err) {
      console.error('Failed to block IP:', err.message);
    }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">Active Alerts</span>
        <span className="panel-count">{active.length} unresolved</span>
      </div>
      <div className="panel-body">
        {active.length === 0 ? (
          <div className="empty">No active alerts — system healthy.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Rule</th>
                <th>Severity</th>
                <th>IP</th>
                <th>Endpoint</th>
                <th>Count</th>
                <th>Reason</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {active.map((alert) => (
                <tr key={alert.id}>
                  <td title={alert.timestamp}>{fmtTime(alert.timestamp)}</td>
                  <td>
                    <span className={`badge ${SEVERITY_CLASS[alert.severity] || 'badge-medium'}`}>
                      {RULE_LABELS[alert.rule_triggered] || alert.rule_triggered}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${SEVERITY_CLASS[alert.severity] || ''}`}>
                      {alert.severity}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'monospace', color: '#f87171' }}>{alert.ip}</td>
                  <td style={{ fontFamily: 'monospace' }}>{alert.endpoint}</td>
                  <td style={{ color: '#fbbf24', fontWeight: 600 }}>
                    {alert.alert_count > 1 ? `×${alert.alert_count}` : '—'}
                  </td>
                  <td title={alert.reason} style={{ maxWidth: 220 }}>{alert.reason}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn-resolve" onClick={() => handleResolve(alert.id)}>
                      Resolve
                    </button>
                    <button
                      className="btn-block"
                      onClick={() => handleBlock(alert.ip, alert.id)}
                      title={`Block ${alert.ip}`}
                    >
                      Block IP
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function fmtTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
