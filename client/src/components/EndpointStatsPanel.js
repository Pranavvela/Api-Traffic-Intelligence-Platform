import React from 'react';

export default function EndpointStatsPanel({ endpoints }) {
  const max = endpoints[0]?.request_count || 1;

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">Endpoint Traffic (last 60s)</span>
        <span className="panel-count">{endpoints.length} endpoints</span>
      </div>
      <div className="panel-body">
        {endpoints.length === 0 ? (
          <div className="empty">No endpoint data yet.</div>
        ) : (
          <div className="bar-list">
            {endpoints.map((item) => {
              const pct = Math.round((item.request_count / max) * 100);
              return (
                <div className="bar-item" key={item.endpoint}>
                  <div className="bar-label">
                    <span style={{ fontFamily: 'monospace' }}>{item.endpoint}</span>
                    <span style={{ color: '#94a3b8' }}>{item.request_count} req</span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
