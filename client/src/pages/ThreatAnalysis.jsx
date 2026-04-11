import React, { useEffect, useMemo, useState } from 'react';
import {
  detectMl,
  fetchThreatSummary,
  fetchThreatRules,
  fetchThreatTimeline,
  trainMl,
} from '../services/api';

export default function ThreatAnalysis() {
  const [summary, setSummary] = useState(null);
  const [rules, setRules] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [training, setTraining] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState(null);
  const [notes, setNotes] = useState('');
  const [sourceFilter, setSourceFilter] = useState('ALL');

  async function loadSummary() {
    try {
      const res = await fetchThreatSummary();
      setSummary(res.data || null);
    } catch (err) {
      setError(err.message || 'Failed to load summary.');
    }
  }

  async function loadRules() {
    try {
      const res = await fetchThreatRules();
      setRules(res.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load rule breakdown.');
    }
  }

  async function loadTimeline(filter = sourceFilter) {
    try {
      const params = { limit: 120 };
      if (filter && filter !== 'ALL') {
        params.source = filter;
      }
      const res = await fetchThreatTimeline(params);
      setTimeline(res.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load timeline.');
    }
  }

  async function runDetect() {
    setLoading(true);
    setError('');
    try {
      const res = await detectMl();
      const results = res.data?.results || [];
      setAnomalies(results.filter((r) => r.ml_label === 'ANOMALY'));
    } catch (err) {
      setError(err.message || 'Failed to run ML detection.');
    } finally {
      setLoading(false);
    }
  }

  async function runTrain() {
    setTraining(true);
    setMessage('');
    setError('');
    try {
      const res = await trainMl({});
      setStatus(res.data || null);
      setMessage('Model trained successfully.');
    } catch (err) {
      setError(err.message || 'Training failed.');
    } finally {
      setTraining(false);
    }
  }

  useEffect(() => {
    loadSummary();
    loadRules();
    loadTimeline();
  }, []);

  useEffect(() => {
    loadTimeline(sourceFilter);
  }, [sourceFilter]);

  const ruleBreakdownMax = useMemo(() => {
    return rules[0]?.cnt || 1;
  }, [rules]);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Threat Analysis</h1>
        <p className="page-subtitle">ML anomaly detection on API traffic behavior.</p>
      </div>

      <div className="summary-grid">
        <div className="stat-card">
          <div className="stat-label">Total Alerts</div>
          <div className="stat-value">{summary?.summary?.total_alerts ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">ML Alerts</div>
          <div className="stat-value warning">{summary?.summary?.ml_alerts ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Critical Alerts</div>
          <div className="stat-value danger">{summary?.summary?.critical_alerts ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Last Alert</div>
          <div className="stat-value" style={{ fontSize: 14 }}>
            {summary?.summary?.last_alert_at ? new Date(summary.summary.last_alert_at).toLocaleString() : '—'}
          </div>
        </div>
      </div>

      <div className="page-card" style={{ marginTop: 16 }}>
        <div className="list-header">
          <h2 className="section-title">Threat Timeline</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="form-label" style={{ marginBottom: 0 }}>Source</span>
            <select
              className="form-input"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              style={{ height: 30 }}
            >
              <option value="ALL">All</option>
              <option value="RULE">Rule</option>
              <option value="ML">ML</option>
            </select>
          </div>
        </div>
        {timeline.length === 0 ? (
          <div className="empty">No alerts in timeline.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Source</th>
                <th>Rule</th>
                <th>Severity</th>
                <th>Score</th>
                <th>IP</th>
                <th>Endpoint</th>
                <th>Mitigation</th>
                <th>Explainability</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {timeline.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.timestamp).toLocaleTimeString()}</td>
                  <td>
                    <span className={`badge ${sourceBadge(row.source)}`}>
                      {row.source || 'RULE'}
                    </span>
                  </td>
                  <td>{row.rule_triggered}</td>
                  <td>
                    <span className={`badge ${severityClass(row.severity)}`}>
                      {row.severity}
                    </span>
                  </td>
                  <td style={{ color: '#fbbf24', fontWeight: 600 }}>
                    {formatThreatScore(row)}
                  </td>
                  <td style={{ fontFamily: 'monospace' }}>{row.ip}</td>
                  <td style={{ fontFamily: 'monospace' }}>{row.endpoint}</td>
                  <td>
                    <span className="badge badge-low">
                      {row.mitigation_action || 'NONE'}
                    </span>
                  </td>
                  <td style={{ maxWidth: 220 }}>
                    {formatExplainability(row.ml_explainability)}
                  </td>
                  <td title={row.reason} style={{ maxWidth: 220 }}>{row.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="page-card" style={{ marginTop: 16 }}>
        <div className="list-header">
          <h2 className="section-title">Top Suspicious IPs</h2>
        </div>
        <div className="panels">
          <div className="panel" style={{ border: 'none' }}>
            <div className="panel-header">
              <span className="panel-title">Rule-Based</span>
            </div>
            <div className="panel-body">
              {summary?.topAttackers?.length ? (
                <div className="bar-list">
                  {summary.topAttackers.map((row) => (
                    <div className="bar-item" key={row.ip}>
                      <div className="bar-label">
                        <span style={{ fontFamily: 'monospace', color: '#f87171' }}>{row.ip}</span>
                        <span style={{ color: '#94a3b8' }}>score {row.score}</span>
                      </div>
                      <div className="bar-track">
                        <div className="bar-fill danger" style={{ width: `${Math.min(row.score * 10, 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty">No rule-based suspects.</div>
              )}
            </div>
          </div>
          <div className="panel" style={{ border: 'none' }}>
            <div className="panel-header">
              <span className="panel-title">ML-Based</span>
            </div>
            <div className="panel-body">
              {summary?.mlTopIps?.length ? (
                <div className="bar-list">
                  {summary.mlTopIps.map((row) => (
                    <div className="bar-item" key={row.ip}>
                      <div className="bar-label">
                        <span style={{ fontFamily: 'monospace', color: '#f87171' }}>{row.ip}</span>
                        <span style={{ color: '#94a3b8' }}>{row.count} anomaly windows</span>
                      </div>
                      <div className="bar-track">
                        <div className="bar-fill danger" style={{ width: `${Math.min(row.count * 20, 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty">No ML suspects.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="page-card" style={{ marginTop: 16 }}>
        <div className="list-header">
          <h2 className="section-title">Rule Breakdown</h2>
        </div>
        {rules.length === 0 ? (
          <div className="empty">No rule data yet.</div>
        ) : (
          <div className="bar-list">
            {rules.map((row) => {
              const pct = Math.round((row.cnt / ruleBreakdownMax) * 100);
              return (
                <div className="bar-item" key={`${row.rule_triggered}-${row.source}`}>
                  <div className="bar-label">
                    <span style={{ fontFamily: 'monospace' }}>{row.rule_triggered}</span>
                    <span style={{ color: '#94a3b8' }}>{row.cnt} · {row.source}</span>
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

      <div className="page-card" style={{ marginTop: 16 }}>
        <div className="list-header">
          <h2 className="section-title">ML Anomalies</h2>
          {loading && <span className="muted">Loading...</span>}
        </div>
        <div className="form-actions" style={{ gap: 8 }}>
          <button className="btn-primary" type="button" onClick={runTrain} disabled={training}>
            {training ? 'Training...' : 'Train Model'}
          </button>
          <button className="btn-resolve" type="button" onClick={runDetect} disabled={loading}>
            {loading ? 'Detecting...' : 'View Anomalies'}
          </button>
        </div>
        {message && <div className="form-success">{message}</div>}
        {error && <div className="form-error">{error}</div>}
        {anomalies.length === 0 && !loading ? (
          <div className="empty">No ML anomalies detected yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>IP</th>
                <th>Window Start</th>
                <th>Score</th>
                <th>Label</th>
                <th>RPM</th>
                <th>Error Rate</th>
                <th>Explainability</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.map((row) => (
                <tr key={`${row.ip}-${row.window_start}`}>
                  <td style={{ fontFamily: 'monospace' }}>{row.ip}</td>
                  <td>{new Date(row.window_start).toLocaleString()}</td>
                  <td>{row.anomaly_score}</td>
                  <td>
                    <span className="badge badge-high">ANOMALY</span>
                  </td>
                  <td>{row.requests_per_minute}</td>
                  <td>{row.error_rate}</td>
                  <td style={{ maxWidth: 220 }}>
                    {formatExplainability(row.explainability)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="page-card" style={{ marginTop: 16 }}>
        <div className="list-header">
          <h2 className="section-title">Investigation Notes</h2>
        </div>
        <textarea
          className="notes-area"
          placeholder="Write analyst notes here..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </div>
  );
}

function severityClass(severity) {
  if (severity === 'critical') return 'badge-critical';
  if (severity === 'high') return 'badge-high';
  if (severity === 'medium') return 'badge-medium';
  if (severity === 'low') return 'badge-low';
  return 'badge-none';
}

function sourceBadge(source) {
  if (source === 'ML') return 'badge-ml';
  if (source === 'RULE') return 'badge-rule';
  return 'badge-none';
}

function formatThreatScore(row) {
  if (row.source === 'ML' && row.anomaly_score !== null && row.anomaly_score !== undefined) {
    return Number(row.anomaly_score).toFixed(2);
  }
  const weight = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 5,
  }[row.severity] || 1;
  const count = row.alert_count || 1;
  return weight * count;
}

function formatExplainability(explainability) {
  let parsed = explainability;
  if (typeof explainability === 'string') {
    try {
      parsed = JSON.parse(explainability);
    } catch (err) {
      parsed = null;
    }
  }
  const data = parsed?.top_features || parsed?.topFeatures || parsed?.top_features;
  if (!data || !Array.isArray(data) || data.length === 0) return '—';
  return data
    .map((f) => `${f.feature}: z=${Number(f.z).toFixed(2)}`)
    .join(', ');
}
