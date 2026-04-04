import React from 'react';

export default function TopIpsPanel({ topIps }) {
  const max = topIps[0]?.request_count || 1;

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">Top IPs (last 60s)</span>
        <span className="panel-count">{topIps.length} IPs</span>
      </div>
      <div className="panel-body">
        {topIps.length === 0 ? (
          <div className="empty">No traffic recorded yet.</div>
        ) : (
          <div className="bar-list">
            {topIps.map((item) => {
              const pct = Math.round((item.request_count / max) * 100);
              const isDanger = item.request_count > 10;
              return (
                <div className="bar-item" key={item.ip}>
                  <div className="bar-label">
                    <span style={{ fontFamily: 'monospace', color: isDanger ? '#f87171' : undefined }}>
                      {item.ip}
                    </span>
                    <span style={{ color: '#94a3b8' }}>{item.request_count} req</span>
                  </div>
                  <div className="bar-track">
                    <div
                      className={`bar-fill ${isDanger ? 'danger' : ''}`}
                      style={{ width: `${pct}%` }}
                    />
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
