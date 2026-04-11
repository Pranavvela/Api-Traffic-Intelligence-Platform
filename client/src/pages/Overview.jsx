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
        setSummary(res.data || null);
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
    <div className="page landing">
      <header className="landing-hero">
        <div className="landing-copy">
          <div className="landing-eyebrow">API Sentinel</div>
          <h1 className="landing-title">Real-time API threat detection built for production teams.</h1>
          <p className="landing-subtitle">
            Monitor, detect, and respond to anomalous traffic with clear, explainable signals
            across your API surface. Built for security teams, SREs, and platform engineers.
          </p>
          <div className="landing-cta">
            <Link to="/dashboard" className="btn-primary">Open Console</Link>
            <Link to="/api-management" className="btn-secondary">Register APIs</Link>
          </div>
        </div>
        <div className="landing-status">
          <div className="health-pill">
            <span className={`health-dot ${health === 'Healthy' ? 'ok' : 'warn'}`} />
            {health}
          </div>
          <div className="status-note">Live posture based on unresolved alerts.</div>
          <div className="status-highlight">
            <div className="status-label">Threat Score</div>
            <div className="status-value">{threat}</div>
          </div>
        </div>
      </header>

      {error && <div className="form-error">{error}</div>}

      <section className="summary-grid landing-metrics">
        <div className="stat-card">
          <div className="stat-label">Requests / min</div>
          <div className="stat-value">{rpm}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Requests (60s)</div>
          <div className="stat-value">{total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Unresolved Alerts</div>
          <div className={`stat-value ${unresolved > 0 ? 'danger' : ''}`}>{unresolved}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Top IP</div>
          <div className="stat-value" style={{ fontSize: 16, marginTop: 10 }}>{topIp}</div>
        </div>
      </section>

      <section className="landing-showcase">
        <div className="landing-showcase-card">
          <img src={pulseImg} alt="Traffic pulse visualization" className="landing-image" />
          <div className="landing-card-title">Traffic intelligence</div>
          <p className="landing-card-text">
            Correlates live traffic with rule-based controls and ML scoring to
            identify abuse patterns before they impact availability.
          </p>
        </div>
        <div className="landing-showcase-card">
          <img src={shieldImg} alt="Automated response" className="landing-image" />
          <div className="landing-card-title">Built-in response</div>
          <p className="landing-card-text">
            Respond with blocking or throttling, plus forensics-ready timelines
            and explainability cues for every anomaly.
          </p>
        </div>
      </section>

      <section className="landing-sequence">
        <div className="landing-feature">
          <div className="landing-feature-content">
            <div className="landing-feature-title">Operational workflows</div>
            <p className="landing-feature-text">
              Use Threat Analysis to investigate spikes, review alert history, and
              export datasets for deeper ML experimentation.
            </p>
          </div>
          <div className="landing-feature-media">
            <img src={pulseImg} alt="Operational workflows" className="landing-image" />
          </div>
        </div>

        <div className="landing-feature reverse">
          <div className="landing-feature-content">
            <div className="landing-feature-title">API registration</div>
            <p className="landing-feature-text">
              Categorize APIs as internal or external and validate endpoints before
              simulation and monitoring.
            </p>
          </div>
          <div className="landing-feature-media">
            <img src={gridImg} alt="API registration" className="landing-image" />
          </div>
        </div>

        <div className="landing-feature">
          <div className="landing-feature-content">
            <div className="landing-feature-title">Threat response readiness</div>
            <p className="landing-feature-text">
              Actionable alerts, threat scoring, and explainability feed on-call
              workflows and post-incident reviews.
            </p>
          </div>
          <div className="landing-feature-media">
            <img src={shieldImg} alt="Threat response readiness" className="landing-image" />
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-title">API Sentinel</div>
        <div className="landing-footer-text">
          Real-time API traffic intelligence for security and platform teams.
        </div>
        <div className="landing-footer-meta">© 2026 API Sentinel</div>
      </footer>
    </div>
  );
}
