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
                <th>IP</th>
                <th>Endpoint</th>
                <th>Count</th>
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
                  <td style={{ fontFamily: 'monospace', color: '#94a3b8' }}>{alert.ip}</td>
                  <td style={{ fontFamily: 'monospace' }}>{alert.endpoint}</td>
                  <td style={{ color: '#fbbf24', fontWeight: 600 }}>
                    {alert.alert_count > 1 ? `×${alert.alert_count}` : '—'}
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
