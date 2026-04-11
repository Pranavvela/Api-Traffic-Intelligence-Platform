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

const MITIGATION_CLASS = {
  BLOCKED: 'badge-blocked',
  THROTTLED: 'badge-throttled',
  MONITORED: 'badge-monitored',
  NONE: 'badge-none',
};

const SOURCE_CLASS = {
  RULE: 'badge-rule',
  ML: 'badge-ml',
};

const THREAT_WEIGHTS = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 5,
};

export default function AlertPanel({ alerts, onResolved }) {
  const active = alerts.filter((a) => !a.resolved);
  const totalOccurrences = active.reduce((sum, alert) => sum + (alert.alert_count || 1), 0);
  const [actionError, setActionError] = React.useState('');

  async function handleResolve(id) {
    try {
      setActionError('');
      await resolveAlert(id);
      onResolved();
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to resolve alert.';
      setActionError(message);
      console.error('Failed to resolve alert:', message);
    }
  }

  async function handleBlock(ip, alertId) {
    try {
      setActionError('');
      await blockIp(ip, `Blocked from dashboard alert #${alertId}.`);
      await resolveAlert(alertId);
      onResolved();
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to block IP.';
      setActionError(message);
      console.error('Failed to block IP:', message);
    }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">Active Alerts</span>
        <span className="panel-count">{totalOccurrences} unresolved</span>
      </div>
      {actionError && <div className="form-error" style={{ margin: '8px 16px 0' }}>{actionError}</div>}
      <div className="panel-body">
        {active.length === 0 ? (
          <div className="empty">No active alerts — system healthy.</div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Rule</th>
                  <th>Severity</th>
                  <th>Source</th>
                  <th>IP</th>
                  <th>Endpoint</th>
                  <th>Count</th>
                  <th>Score</th>
                  <th>Mitigation</th>
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
                    <td>
                      <span className={`badge ${SOURCE_CLASS[alert.source] || 'badge-none'}`}>
                        {alert.source || 'RULE'}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace', color: '#f87171' }}>{alert.ip}</td>
                    <td style={{ fontFamily: 'monospace' }}>{alert.endpoint}</td>
                    <td style={{ color: '#fbbf24', fontWeight: 600 }}>
                      {alert.alert_count > 1 ? `×${alert.alert_count}` : '—'}
                    </td>
                    <td style={{ color: '#fbbf24', fontWeight: 600 }}>
                      {formatThreatScore(alert)}
                    </td>
                    <td>
                      <span className={`badge ${MITIGATION_CLASS[alert.mitigation_action] || 'badge-none'}`}>
                        {alert.mitigation_action || 'NONE'}
                      </span>
                    </td>
                    <td title={alert.reason} style={{ maxWidth: 220 }}>{alert.reason}</td>
                    <td className="table-actions">
                      <div className="action-buttons">
                        <button className="btn-resolve" onClick={() => handleResolve(alert.id)}>
                          Resolve & Mitigate
                        </button>
                        <button
                          className="btn-block"
                          onClick={() => handleBlock(alert.ip, alert.id)}
                          title={`Block ${alert.ip}`}
                        >
                          Block IP
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

function formatThreatScore(alert) {
  if (alert.source === 'ML' && alert.anomaly_score !== null && alert.anomaly_score !== undefined) {
    return Number(alert.anomaly_score).toFixed(2);
  }
  const weight = THREAT_WEIGHTS[alert.severity] || 1;
  const count = alert.alert_count || 1;
  return weight * count;
}
