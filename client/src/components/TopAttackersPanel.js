import React from 'react';

/**
 * TopAttackersPanel — shows IPs ranked by attacker score.
 */
export default function TopAttackersPanel({ attackers }) {
  const maxScore = attackers.length > 0 ? attackers[0].score : 1;

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">Top Attackers</span>
        <span className="panel-count">{attackers.length} IPs</span>
      </div>
      <div className="panel-body">
        {attackers.length === 0 ? (
          <div className="empty">No attacker data yet.</div>
        ) : (
          <div className="bar-list">
            {attackers.map((a) => {
              const pct = Math.round((a.score / maxScore) * 100);
              return (
                <div className="bar-item" key={a.ip}>
                  <div className="bar-label">
                    <span style={{ fontFamily: 'monospace', color: '#f87171' }}>{a.ip}</span>
                    <span style={{ color: '#94a3b8', fontSize: 11 }}>
                      score&nbsp;
                      <strong style={{ color: '#fbbf24' }}>{a.score}</strong>
                      &nbsp;·&nbsp;{a.alert_count} alert{a.alert_count === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill danger" style={{ width: `${pct}%` }} />
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>
                    Rules: {(a.rules_triggered || []).join(', ')}
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
