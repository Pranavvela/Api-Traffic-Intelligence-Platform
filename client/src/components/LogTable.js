import React from 'react';

export default function LogTable({ logs }) {
  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">Live API Logs</span>
        <span className="panel-count">{logs.length} entries</span>
      </div>
      <div className="panel-body">
        {logs.length === 0 ? (
          <div className="empty">No log entries yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Method</th>
                <th>Endpoint</th>
                <th>Status</th>
                <th>IP</th>
                <th>Resp (ms)</th>
                <th>User Agent</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.request_id}>
                  <td>{fmtTime(log.timestamp)}</td>
                  <td style={{ fontWeight: 600 }}>{log.method}</td>
                  <td style={{ fontFamily: 'monospace' }}>{log.endpoint}</td>
                  <td>
                    <span className={`badge ${statusClass(log.status_code)}`}>
                      {log.status_code}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'monospace', color: '#94a3b8' }}>{log.ip}</td>
                  <td>{log.response_ms ?? '—'}</td>
                  <td
                    title={log.user_agent || ''}
                    style={{ maxWidth: 160, color: '#64748b', fontSize: 11 }}
                  >
                    {log.user_agent ? log.user_agent.substring(0, 40) + (log.user_agent.length > 40 ? '…' : '') : '—'}
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

function statusClass(code) {
  if (!code) return '';
  if (code < 300) return 'badge-ok';
  if (code < 400) return 'badge-low';
  if (code < 500) return 'badge-err';
  return 'badge-critical';
}

function fmtTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
