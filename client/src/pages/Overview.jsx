import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import pulseImg from '../assets/overview-pulse.svg';
import shieldImg from '../assets/overview-shield.svg';
import gridImg from '../assets/overview-grid.svg';
import { fetchSummary } from '../services/api';

export default function Overview() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetchSummary();
        setSummary(res || null);
        setError('');
      } catch (err) {
        setError(err.message || 'Failed to load summary.');
      }
    }
    load();
  }, []);

  const rpm = summary?.requestsPerMinute ?? '—';
  const total = summary?.requestCount ?? '—';
  const unresolved = summary?.unresolvedAlerts ?? '—';
  const topIp = summary?.topIps?.[0]?.ip ?? '—';
  const health = unresolved && unresolved !== '—' && unresolved > 0 ? 'Attention' : 'Healthy';
  const threat = summary?.threatScore ?? '—';

  return (
    <div className="space-y-8">
      <section className="glass-panel rounded-3xl p-8 lg:p-10">
        <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-sky-300/80">API Sentinel</div>
            <h1 className="mt-4 text-4xl font-semibold text-white lg:text-5xl" style={{ fontFamily: 'Playfair Display, serif' }}>
              Real-time API threat detection built for production teams.
            </h1>
            <p className="mt-4 text-base text-slate-300">
              Monitor, detect, and respond to anomalous traffic with clear, explainable signals
              across your API surface. Built for security teams, SREs, and platform engineers.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/dashboard" className="rounded-xl bg-sky-500/90 px-5 py-2 text-sm font-semibold text-white shadow-glow transition-all hover:-translate-y-[1px]">
                Open Console
              </Link>
              <Link to="/api-management" className="rounded-xl border border-white/10 bg-white/5 px-5 py-2 text-sm font-semibold text-white transition-all hover:-translate-y-[1px]">
                Register APIs
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center shadow-soft">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Live Status</div>
            <div className="mt-3 text-lg font-semibold text-white">{health}</div>
            <div className="mt-2 text-sm text-slate-400">Based on unresolved alerts.</div>
            <div className="mt-5 border-t border-white/10 pt-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Threat Score</div>
              <div className="mt-2 text-3xl font-semibold text-amber-200">{threat}</div>
            </div>
          </div>
        </div>
      </section>

      {error && <div className="text-sm text-rose-300">{error}</div>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="glass-card rounded-2xl p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Requests / min</div>
          <div className="mt-2 text-2xl font-semibold text-white">{rpm}</div>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Requests (60s)</div>
          <div className="mt-2 text-2xl font-semibold text-white">{total}</div>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Unresolved Alerts</div>
          <div className={`mt-2 text-2xl font-semibold ${unresolved > 0 ? 'text-rose-200' : 'text-white'}`}>{unresolved}</div>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Top IP</div>
          <div className="mt-2 text-lg font-semibold text-white text-mono">{topIp}</div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="glass-card rounded-3xl p-6">
          <img
            src={pulseImg}
            alt="Traffic pulse visualization"
            className="mx-auto w-full max-w-[520px] max-h-[220px] rounded-2xl border border-white/10 object-contain"
          />
          <div className="mt-4 text-lg font-semibold text-white">Traffic intelligence</div>
          <p className="mt-2 text-sm text-slate-300">
            Correlates live traffic with rule-based controls and ML scoring to identify abuse patterns
            before they impact availability.
          </p>
        </div>
        <div className="glass-card rounded-3xl p-6">
          <img
            src={shieldImg}
            alt="Automated response"
            className="mx-auto w-full max-w-[520px] max-h-[220px] rounded-2xl border border-white/10 object-contain"
          />
          <div className="mt-4 text-lg font-semibold text-white">Built-in response</div>
          <p className="mt-2 text-sm text-slate-300">
            Respond with blocking or throttling, plus forensics-ready timelines and explainability cues
            for every anomaly.
          </p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="glass-card rounded-3xl p-6 flex flex-col gap-4">
          <div className="text-lg font-semibold text-white">Operational workflows</div>
          <p className="text-sm text-slate-300">
            Use Threat Analysis to investigate spikes, review alert history, and export datasets
            for deeper ML experimentation.
          </p>
          <img
            src={pulseImg}
            alt="Operational workflows"
            className="mx-auto w-full max-w-[520px] max-h-[220px] rounded-2xl border border-white/10 object-contain"
          />
        </div>
        <div className="glass-card rounded-3xl p-6 flex flex-col gap-4">
          <div className="text-lg font-semibold text-white">API registration</div>
          <p className="text-sm text-slate-300">
            Categorize APIs as internal or external and validate endpoints before simulation and monitoring.
          </p>
          <img
            src={gridImg}
            alt="API registration"
            className="mx-auto w-full max-w-[520px] max-h-[220px] rounded-2xl border border-white/10 object-contain"
          />
        </div>
      </section>

      <footer className="text-center text-xs text-slate-500">© 2026 API Sentinel</footer>
    </div>
  );
}
