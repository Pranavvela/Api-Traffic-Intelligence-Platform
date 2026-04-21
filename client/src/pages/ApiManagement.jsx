import React, { useEffect, useState } from 'react';
import {
  registerApi,
  fetchRegisteredApis,
  deleteRegisteredApi,
  validateRegisteredApi,
  updateRegisteredApi,
} from '../services/api';
import TableSortDialog from '../components/TableSortDialog';
import { sortRows } from '../utils/tableSort';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const TYPES = ['INTERNAL', 'EXTERNAL'];

const SORT_FIELDS = [
  { key: 'endpoint', label: 'Endpoint' },
  { key: 'method', label: 'Method' },
  { key: 'api_type', label: 'Type' },
  { key: 'threshold', label: 'Threshold' },
  { key: 'validation_status', label: 'Validation' },
  { key: 'last_checked_at', label: 'Checked' },
  { key: 'is_active', label: 'Active' },
  { key: 'created_at', label: 'Created' },
];

export default function ApiManagement() {
  const [endpoint, setEndpoint] = useState('');
  const [method, setMethod] = useState('GET');
  const [apiType, setApiType] = useState('INTERNAL');
  const [threshold, setThreshold] = useState('10');
  const [apis, setApis] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sortConfig, setSortConfig] = useState({ fields: [], direction: 'asc' });
  const [draftFields, setDraftFields] = useState([SORT_FIELDS[0].key]);
  const [draftDirection, setDraftDirection] = useState('asc');
  const [sortOpen, setSortOpen] = useState(false);
  const [editingApiId, setEditingApiId] = useState(null);
  const [editForm, setEditForm] = useState({ endpoint: '', method: 'GET', api_type: 'INTERNAL', threshold: '10', monitoring_enabled: true });
  const [savingApiId, setSavingApiId] = useState(null);

  const sortedApis = React.useMemo(
    () => sortRows(apis, sortConfig.fields, sortConfig.direction),
    [apis, sortConfig]
  );

  async function loadApis() {
    setLoading(true);
    try {
      const res = await fetchRegisteredApis();
      const data = Array.isArray(res) ? res : [];
      setApis(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load registered APIs.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadApis();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await registerApi({
        endpoint,
        method,
        api_type: apiType,
        threshold: Number.parseInt(threshold, 10),
      });
      setEndpoint('');
      setMethod('GET');
      setApiType('INTERNAL');
      setThreshold('10');
      await loadApis();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to register API.');
    }
  }

  async function handleDelete(id) {
    setError('');
    try {
      await deleteRegisteredApi(id);
      await loadApis();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to delete API.');
    }
  }

  async function handleValidate(id) {
    setError('');
    try {
      await validateRegisteredApi(id);
      await loadApis();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to validate API.');
    }
  }

  function startEdit(api) {
    setEditingApiId(api.id);
    setEditForm({
      endpoint: api.endpoint || '',
      method: api.method || 'GET',
      api_type: api.api_type || 'INTERNAL',
      threshold: String(api.threshold ?? '10'),
      monitoring_enabled: Boolean(api.monitoring_enabled ?? api.is_active),
    });
  }

  function cancelEdit() {
    setEditingApiId(null);
    setEditForm({ endpoint: '', method: 'GET', api_type: 'INTERNAL', threshold: '10', monitoring_enabled: true });
  }

  async function saveEdit(id) {
    setError('');
    setSavingApiId(id);
    try {
      await updateRegisteredApi(id, {
        endpoint: editForm.endpoint,
        method: editForm.method,
        api_type: editForm.api_type,
        threshold: Number.parseInt(editForm.threshold, 10),
        is_active: editForm.monitoring_enabled,
        monitoring_enabled: editForm.monitoring_enabled,
      });
      cancelEdit();
      await loadApis();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to update API.');
    } finally {
      setSavingApiId(null);
    }
  }

  async function toggleMonitoring(api) {
    setError('');
    setSavingApiId(api.id);
    try {
      const isMonitoringEnabled = api.monitoring_enabled ?? api.is_active;
      const nextMonitoring = !isMonitoringEnabled;
      await updateRegisteredApi(api.id, {
        is_active: nextMonitoring,
        monitoring_enabled: nextMonitoring,
      });
      await loadApis();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to toggle monitoring.');
    } finally {
      setSavingApiId(null);
    }
  }

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
        <div className="text-xs uppercase tracking-[0.3em] text-sky-300/80">API Management</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">Register & Monitor APIs</h1>
        <p className="mt-2 text-sm text-slate-300">
          Register endpoints for monitoring and threshold tracking.
        </p>
      </div>

      <section className="glass-panel rounded-2xl p-6">
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-slate-400" htmlFor="endpoint-input">
              Endpoint
            </label>
            <input
              id="endpoint-input"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white focus:border-sky-400 focus:outline-none"
              type="text"
              placeholder="/api/orders"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-slate-400" htmlFor="method-select">
              Method
            </label>
            <select
              id="method-select"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white focus:border-sky-400 focus:outline-none"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              {METHODS.map((m) => (
                <option key={m} value={m} className="text-slate-900">
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-slate-400" htmlFor="api-type-select">
              API Type
            </label>
            <select
              id="api-type-select"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white focus:border-sky-400 focus:outline-none"
              value={apiType}
              onChange={(e) => setApiType(e.target.value)}
            >
              {TYPES.map((t) => (
                <option key={t} value={t} className="text-slate-900">
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-slate-400" htmlFor="threshold-input">
              Threshold
            </label>
            <input
              id="threshold-input"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white focus:border-sky-400 focus:outline-none"
              type="number"
              min="1"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              required
            />
          </div>
          <div className="md:col-span-2 xl:col-span-4">
            <button className="rounded-xl bg-sky-500/90 px-5 py-2 text-sm font-semibold text-white shadow-glow transition-all hover:-translate-y-[1px]">
              Register API
            </button>
          </div>
        </form>

        {error && <div className="mt-3 text-sm text-rose-300">{error}</div>}
      </section>

      <section className="glass-panel rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-lg font-semibold text-white">Registered APIs</div>
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

        {apis.length === 0 && !loading ? (
          <div className="mt-6 rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-400">
            No registered APIs yet.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs text-slate-300">
              <thead className="text-[11px] uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-3 py-3">Endpoint</th>
                  <th className="px-3 py-3">Method</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Threshold</th>
                  <th className="px-3 py-3">Validation</th>
                  <th className="px-3 py-3">Checked</th>
                  <th className="px-3 py-3">Monitoring</th>
                  <th className="px-3 py-3">Created</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sortedApis.map((api) => {
                  const isMonitoringEnabled = api.monitoring_enabled ?? api.is_active;
                  const monitoringLabel = isMonitoringEnabled ? 'ON' : 'OFF';

                  return (
                  <tr key={api.id} className="hover:bg-white/5">
                    <td className="px-3 py-3 text-mono">
                      {editingApiId === api.id ? (
                        <input
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white focus:border-sky-400 focus:outline-none"
                          value={editForm.endpoint}
                          onChange={(e) => setEditForm((current) => ({ ...current, endpoint: e.target.value }))}
                        />
                      ) : (
                        api.endpoint
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {editingApiId === api.id ? (
                        <select
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white focus:border-sky-400 focus:outline-none"
                          value={editForm.method}
                          onChange={(e) => setEditForm((current) => ({ ...current, method: e.target.value }))}
                        >
                          {METHODS.map((m) => (
                            <option key={m} value={m} className="text-slate-900">
                              {m}
                            </option>
                          ))}
                        </select>
                      ) : (
                        api.method
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {editingApiId === api.id ? (
                        <select
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white focus:border-sky-400 focus:outline-none"
                          value={editForm.api_type}
                          onChange={(e) => setEditForm((current) => ({ ...current, api_type: e.target.value }))}
                        >
                          {TYPES.map((t) => (
                            <option key={t} value={t} className="text-slate-900">
                              {t}
                            </option>
                          ))}
                        </select>
                      ) : (
                        api.api_type || 'INTERNAL'
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {editingApiId === api.id ? (
                        <input
                          type="number"
                          min="1"
                          className="w-24 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white focus:border-sky-400 focus:outline-none"
                          value={editForm.threshold}
                          onChange={(e) => setEditForm((current) => ({ ...current, threshold: e.target.value }))}
                        />
                      ) : (
                        api.threshold
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${statusClass(api.validation_status)}`}>
                        {api.validation_status || 'PENDING'}
                      </span>
                    </td>
                    <td className="px-3 py-3">{formatDate(api.last_checked_at)}</td>
                    <td className="px-3 py-3">
                      {editingApiId === api.id ? (
                        <label className="inline-flex items-center gap-2 text-xs text-slate-200">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 accent-sky-400"
                            checked={Boolean(editForm.monitoring_enabled)}
                            onChange={(e) => setEditForm((current) => ({ ...current, monitoring_enabled: e.target.checked }))}
                          />
                          {editForm.monitoring_enabled ? 'ON' : 'OFF'}
                        </label>
                      ) : (
                        monitoringLabel
                      )}
                    </td>
                    <td className="px-3 py-3">{formatDate(api.created_at)}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        {editingApiId === api.id ? (
                          <>
                            <button
                              className="rounded-lg bg-sky-500/90 px-3 py-1 text-xs font-semibold text-white transition-all hover:-translate-y-[1px] disabled:opacity-60"
                              onClick={() => saveEdit(api.id)}
                              disabled={savingApiId === api.id}
                            >
                              {savingApiId === api.id ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              className="rounded-lg border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-white transition-all hover:-translate-y-[1px]"
                              onClick={cancelEdit}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="rounded-lg border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-white transition-all hover:-translate-y-[1px]"
                              onClick={() => startEdit(api)}
                            >
                              Edit
                            </button>
                            <button
                              className="rounded-lg border border-amber-500/40 bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-200 transition-all hover:-translate-y-[1px] disabled:opacity-60"
                              onClick={() => toggleMonitoring(api)}
                              disabled={savingApiId === api.id}
                            >
                              {isMonitoringEnabled ? 'Turn Off Monitor' : 'Turn On Monitor'}
                            </button>
                            <button
                              className="rounded-lg border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-white transition-all hover:-translate-y-[1px] disabled:opacity-60"
                              onClick={() => handleValidate(api.id)}
                              disabled={!isMonitoringEnabled}
                            >
                              Validate
                            </button>
                            <button
                              className="rounded-lg border border-rose-500/40 bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-200 transition-all hover:-translate-y-[1px]"
                              onClick={() => handleDelete(api.id)}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <TableSortDialog
          open={sortOpen}
          title="Registered APIs"
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

function statusClass(status) {
  const normalized = String(status || 'PENDING').toUpperCase();
  if (normalized === 'VALID') return 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/40';
  if (normalized === 'INVALID') return 'bg-rose-500/20 text-rose-200 ring-1 ring-rose-500/40';
  return 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/40';
}

function fieldLabel(fieldKey) {
  return SORT_FIELDS.find((field) => field.key === fieldKey)?.label || fieldKey;
}
