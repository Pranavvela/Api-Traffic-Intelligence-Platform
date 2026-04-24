import React from 'react';
import PropTypes from 'prop-types';
import InfoTooltip from './InfoTooltip';

export default function TopIpsPanel({ topIps }) {
  const max = topIps[0]?.request_count || 1;

  return (
    <section className="glass-panel rounded-2xl">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Top IPs</span>
            <InfoTooltip 
              title="Top IPs" 
              description="IP addresses with the highest request volume in the last 60 seconds. High request counts (>10) are highlighted in red." 
            />
          </div>
          <div className="text-lg font-semibold text-white">Most Active (60s)</div>
        </div>
        <div className="text-sm text-slate-400">{topIps.length} IPs</div>
      </div>
      <div className="p-4 space-y-4">
        {topIps.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-400">
            No traffic recorded yet.
          </div>
        ) : (
          topIps.map((item) => {
            const pct = Math.round((item.request_count / max) * 100);
            const isDanger = item.request_count > 10;
            return (
              <div key={item.ip} className="space-y-2">
                <div className="flex items-center justify-between gap-3 min-w-0 text-xs text-slate-300">
                  <span
                    className={`min-w-0 flex-1 truncate text-mono ${
                      isDanger ? 'text-rose-200' : 'text-slate-300'
                    }`}
                    title={item.ip}
                  >
                    {item.ip}
                  </span>
                  <span className="shrink-0 text-slate-400">{item.request_count} req</span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/5">
                  <div
                    className={`h-2 rounded-full ${isDanger ? 'bg-rose-400/70' : 'bg-sky-400/70'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

TopIpsPanel.propTypes = {
  topIps: PropTypes.arrayOf(
    PropTypes.shape({
      ip: PropTypes.string,
      request_count: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    })
  ).isRequired,
};
