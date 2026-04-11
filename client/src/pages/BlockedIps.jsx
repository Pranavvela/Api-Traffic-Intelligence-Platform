import React, { useEffect, useMemo, useState } from 'react';
import { fetchBlockedIps, unblockIp } from '../services/api';

const POLL_INTERVAL_MS = 5000;
const RECENT_WINDOW_MS = 10 * 60 * 1000;

export default function BlockedIps() {
  const [blocked, setBlocked] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadBlocked() {
    setLoading(true);
    try {
      const res = await fetchBlockedIps();
      setBlocked(res.data || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to fetch blocked IPs.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBlocked();
    const id = setInterval(loadBlocked, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  async function handleUnblock(ip) {
    setError('');
    try {
      await unblockIp(ip);
      await loadBlocked();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to unblock IP.');
    }
  }

  const summary = useMemo(() => {
    const total = blocked.length;
    const active = blocked.length;
    const recentCutoff = Date.now() - RECENT_WINDOW_MS;
    const recent = blocked.filter((b) => new Date(b.blocked_at).getTime() >= recentCutoff).length;
    return { total, active, recent };
  }, [blocked]);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Blocked IPs</h1>
        <p className="page-subtitle">Review and manage active IP blocks.</p>
      </div>

      <div className="summary-grid">
        <div className="stat-card">
          <div className="stat-label">Total Blocked</div>
          <div className="stat-value">{summary.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Blocks</div>
          <div className="stat-value danger">{summary.active}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Recently Blocked (10m)</div>
          <div className="stat-value warning">{summary.recent}</div>
        </div>
      </div>

      <div className="page-card" style={{ marginTop: 16 }}>
        <div className="list-header">
          <h2 className="section-title">Blocked IP List</h2>
          {loading && <span className="muted">Loading...</span>}
        </div>

        {error && <div className="form-error">{error}</div>}

        {blocked.length === 0 && !loading ? (
          <div className="empty">No blocked IPs.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>IP</th>
                <th>Reason</th>
                <th>Blocked At</th>
                <th>Active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {blocked.map((row) => (
                <tr key={row.ip}>
                  <td style={{ fontFamily: 'monospace' }}>{row.ip}</td>
                  <td title={row.reason || ''} style={{ maxWidth: 260 }}>
                    {row.reason || '—'}
                  </td>
                  <td>{formatDate(row.blocked_at)}</td>
                  <td>
                    <span className="badge badge-blocked">Yes</span>
                  </td>
                  <td>
                    <button className="btn-success" onClick={() => handleUnblock(row.ip)}>
                      Unblock
                    </button>
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

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
}
