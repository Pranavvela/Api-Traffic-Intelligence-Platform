import React from 'react';

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

/**
 * AlertHistory — displays resolved (historical) alerts.
 */
export default function AlertHistory({ alerts }) {
  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">Alert History</span>
        <span className="panel-count">{alerts.length} resolved</span>
      </div>
      <div className="panel-body">
        {alerts.length === 0 ? (
          <div className="empty">No resolved alerts yet.</div>
        ) : (
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
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
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
                  <td style={{ fontFamily: 'monospace', color: '#94a3b8' }}>{alert.ip}</td>
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
                  <td title={alert.reason} style={{ maxWidth: 240 }}>{alert.reason}</td>
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
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatThreatScore(alert) {
  if (alert.source === 'ML' && alert.anomaly_score !== null && alert.anomaly_score !== undefined) {
    return Number(alert.anomaly_score).toFixed(2);
  }
  const weight = THREAT_WEIGHTS[alert.severity] || 1;
  const count = alert.alert_count || 1;
  return weight * count;
}
