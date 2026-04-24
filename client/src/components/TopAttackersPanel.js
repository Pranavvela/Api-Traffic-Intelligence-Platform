import React from 'react';
import PropTypes from 'prop-types';
import InfoTooltip from './InfoTooltip';

export default function TopAttackersPanel({ attackers }) {
  const maxScore = attackers.length > 0 ? attackers[0].score : 1;

  return (
    <section className="glass-panel rounded-2xl">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Top Attackers</span>
            <InfoTooltip 
              title="Top Attackers" 
              description="IPs ranked by threat score. Score is calculated from alert frequency, rule violations, and ML anomaly detection. Higher scores indicate more dangerous sources." 
            />
          </div>
          <div className="text-lg font-semibold text-white">Ranked by Score</div>
        </div>
        <div className="text-sm text-slate-400">{attackers.length} IPs</div>
      </div>
      <div className="p-4 space-y-4">
        {attackers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-400">
            No attacker data yet.
          </div>
        ) : (
          attackers.map((a) => {
            const pct = Math.round((a.score / maxScore) * 100);
            return (
              <div key={a.ip} className="space-y-2">
                <div className="flex items-center justify-between gap-3 min-w-0 text-xs text-slate-300">
                  <span className="min-w-0 flex-1 truncate text-mono text-rose-200" title={a.ip}>
                    {a.ip}
                  </span>
                  <span className="shrink-0 text-slate-400">
                    score <span className="text-amber-200 font-semibold">{a.score}</span>
                    &nbsp;·&nbsp;{a.alert_count} alert{a.alert_count === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/5">
                  <div className="h-2 rounded-full bg-rose-400/70" style={{ width: `${pct}%` }} />
                </div>
                <div
                  className="text-[11px] text-slate-500 truncate"
                  title={(a.rules_triggered || []).join(', ')}
                >
                  Rules: {(a.rules_triggered || []).join(', ') || '—'}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

TopAttackersPanel.propTypes = {
  attackers: PropTypes.arrayOf(
    PropTypes.shape({
      ip: PropTypes.string,
      score: PropTypes.number,
      alert_count: PropTypes.number,
      rules_triggered: PropTypes.arrayOf(PropTypes.string),
    })
  ).isRequired,
};
