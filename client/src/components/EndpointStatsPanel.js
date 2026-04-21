import React from 'react';
import PropTypes from 'prop-types';

export default function EndpointStatsPanel({ endpoints }) {
  const max = endpoints[0]?.request_count || 1;

  return (
    <section className="glass-panel rounded-2xl">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Endpoint Traffic</div>
          <div className="text-lg font-semibold text-white">Top Endpoints (60s)</div>
        </div>
        <div className="text-sm text-slate-400">{endpoints.length} endpoints</div>
      </div>
      <div className="p-4 space-y-4">
        {endpoints.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-400">
            No endpoint data yet.
          </div>
        ) : (
          endpoints.map((item) => {
            const pct = Math.round((item.request_count / max) * 100);
            return (
              <div key={item.endpoint} className="space-y-2">
                <div className="flex items-center justify-between gap-3 min-w-0 text-xs text-slate-300">
                  <span className="min-w-0 flex-1 truncate text-mono" title={item.endpoint}>
                    {item.endpoint}
                  </span>
                  <span className="shrink-0 text-slate-400">{item.request_count} req</span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/5">
                  <div
                    className="h-2 rounded-full bg-emerald-400/70"
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

EndpointStatsPanel.propTypes = {
  endpoints: PropTypes.arrayOf(
    PropTypes.shape({
      endpoint: PropTypes.string,
      request_count: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    })
  ).isRequired,
};
