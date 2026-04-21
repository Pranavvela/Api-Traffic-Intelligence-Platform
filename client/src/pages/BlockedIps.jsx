import React, { useEffect, useMemo, useState } from 'react';
import { fetchBlockedIps, unblockIp } from '../services/api';
import TableSortDialog from '../components/TableSortDialog';
import { sortRows } from '../utils/tableSort';

const POLL_INTERVAL_MS = 5000;
const RECENT_WINDOW_MS = 10 * 60 * 1000;

const SORT_FIELDS = [
  { key: 'ip', label: 'IP' },
  { key: 'reason', label: 'Reason' },
  { key: 'blocked_at', label: 'Blocked At' },
  { key: 'active', label: 'Active', getValue: () => true },
];

export default function BlockedIps() {
  const [blocked, setBlocked] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sortConfig, setSortConfig] = useState({ fields: [], direction: 'asc' });
  const [draftFields, setDraftFields] = useState([SORT_FIELDS[0].key]);
  const [draftDirection, setDraftDirection] = useState('asc');
  const [sortOpen, setSortOpen] = useState(false);

  const sortedBlocked = React.useMemo(
    () => sortRows(blocked, sortConfig.fields, sortConfig.direction),
    [blocked, sortConfig]
  );

  async function loadBlocked() {
    setLoading(true);
    try {
      const res = await fetchBlockedIps();

      // 🔥 FIX: handle both possible formats safely
      const data = Array.isArray(res)
        ? res
        : Array.isArray(res?.data?.data)
        ? res.data.data
        : [];

      setBlocked(data);

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
    const safeBlocked = Array.isArray(blocked) ? blocked : [];

    const total = safeBlocked.length;
    const active = safeBlocked.length;
    const recentCutoff = Date.now() - RECENT_WINDOW_MS;

    const recent = safeBlocked.filter(
      (b) => new Date(b.blocked_at).getTime() >= recentCutoff
    ).length;

    return { total, active, recent };
  }, [blocked]);

  function openSortDialog() {
    setDraftFields(sortConfig.fields.length > 0 ? sortConfig.fields : [SORT_FIELDS[0].key]);
    setDraftDirection(sortConfig.direction);
    setSortOpen(true);
  }

  function toggleDraftField(fieldKey) {
    setDraftFields((current) =>
      current.includes(fieldKey) ? current.filter((key) => key !== fieldKey) : [...current, fieldKey]
    );
  }

  function applySort() {
    setSortConfig({ fields: draftFields, direction: draftDirection });
    setSortOpen(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.3em] text-sky-300/80">Blocked IPs</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">Threat Containment</h1>
        <p className="mt-2 text-sm text-slate-300">Review and manage active IP blocks.</p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="glass-card rounded-2xl p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Total Blocked</div>
          <div className="mt-2 text-2xl font-semibold text-white">{summary.total}</div>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Active Blocks</div>
          <div className="mt-2 text-2xl font-semibold text-rose-200">{summary.active}</div>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Recently Blocked (10m)</div>
          <div className="mt-2 text-2xl font-semibold text-amber-200">{summary.recent}</div>
        </div>
      </section>

      <section className="glass-panel rounded-2xl p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="text-lg font-semibold text-white">Blocked IP List</div>
            {sortConfig.fields.length > 0 && (
              <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-xs text-sky-200">
                Sorted by {sortConfig.fields.map((field) => fieldLabel(field)).join(', ')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {loading && <span className="text-xs text-slate-400">Loading...</span>}
            <button
              type="button"
              className="rounded-lg border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-white transition-all hover:-translate-y-[1px] hover:bg-white/15"
              onClick={openSortDialog}
            >
              Sort by
            </button>
          </div>
        </div>

        {error && <div className="mt-3 text-sm text-rose-300">{error}</div>}

        {blocked.length === 0 && !loading ? (
          <div className="mt-6 rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-400">
            No blocked IPs.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-xs text-slate-300">
              <thead className="text-[11px] uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-3 py-3">IP</th>
                  <th className="px-3 py-3">Reason</th>
                  <th className="px-3 py-3">Blocked At</th>
                  <th className="px-3 py-3">Active</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sortedBlocked.map((row) => (
                  <tr key={row.ip} className="hover:bg-white/5">
                    <td className="px-3 py-3 text-mono">{row.ip}</td>
                    <td className="px-3 py-3 max-w-[260px] truncate" title={row.reason || ''}>
                      {row.reason || '—'}
                    </td>
                    <td className="px-3 py-3">{formatDate(row.blocked_at)}</td>
                    <td className="px-3 py-3">
                      <span className="inline-flex rounded-full px-2 py-1 text-[11px] font-semibold bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/40">
                        Yes
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        className="rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200 transition-all hover:-translate-y-[1px]"
                        onClick={() => handleUnblock(row.ip)}
                      >
                        Unblock
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <TableSortDialog
          open={sortOpen}
          title="Blocked IP List"
          fields={SORT_FIELDS}
          selectedFields={draftFields}
          direction={draftDirection}
          onToggleField={toggleDraftField}
          onChangeDirection={setDraftDirection}
          onApply={applySort}
          onCancel={() => setSortOpen(false)}
        />
      </section>
    </div>
  );
}

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
}

function fieldLabel(fieldKey) {
  return SORT_FIELDS.find((field) => field.key === fieldKey)?.label || fieldKey;
}