import React, { useEffect, useMemo, useState } from 'react';
import {
  activateMlModel,
  detectMl,
  fetchThreatSummary,
  fetchThreatRules,
  fetchThreatTimeline,
  fetchMlModels,
  fetchMlStatus,
  trainMl,
} from '../services/api';
import TableSortDialog from '../components/TableSortDialog';
import { sortRows } from '../utils/tableSort';

const TIMELINE_SORT_FIELDS = [
  { key: 'timestamp', label: 'Time' },
  { key: 'source', label: 'Source' },
  { key: 'rule_triggered', label: 'Rule' },
  { key: 'severity', label: 'Severity' },
  { key: 'score', label: 'Score', getValue: formatThreatScore },
  { key: 'ip', label: 'IP' },
  { key: 'endpoint', label: 'Endpoint' },
  { key: 'mitigation_action', label: 'Mitigation' },
  { key: 'ml_explainability', label: 'Explainability', getValue: formatExplainability },
  { key: 'reason', label: 'Reason' },
];

const ANOMALY_SORT_FIELDS = [
  { key: 'ip', label: 'IP' },
  { key: 'window_start', label: 'Window Start' },
  { key: 'anomaly_score', label: 'Score' },
  { key: 'ml_label', label: 'Label' },
  { key: 'requests_per_minute', label: 'RPM' },
  { key: 'error_rate', label: 'Error Rate' },
  { key: 'explainability', label: 'Explainability', getValue: formatExplainability },
];

export default function ThreatAnalysis() {
  const [summary, setSummary] = useState(null);
  const [rules, setRules] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [training, setTraining] = useState(false);
  const [activatingModelId, setActivatingModelId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState(null);
  const [notes, setNotes] = useState('');
  const [timelineSortConfig, setTimelineSortConfig] = useState({ fields: [], direction: 'asc' });
  const [timelineDraftFields, setTimelineDraftFields] = useState([TIMELINE_SORT_FIELDS[0].key]);
  const [timelineDraftDirection, setTimelineDraftDirection] = useState('desc');
  const [timelineSortOpen, setTimelineSortOpen] = useState(false);
  const [anomalySortConfig, setAnomalySortConfig] = useState({ fields: [], direction: 'asc' });
  const [anomalyDraftFields, setAnomalyDraftFields] = useState([ANOMALY_SORT_FIELDS[0].key]);
  const [anomalyDraftDirection, setAnomalyDraftDirection] = useState('desc');
  const [anomalySortOpen, setAnomalySortOpen] = useState(false);

  // ONLY CHANGES ARE IN DATA LOADING FUNCTIONS

async function loadSummary() {
  try {
    const res = await fetchThreatSummary();
    setSummary(res || null);
  } catch (err) {
    setError(err.message || 'Failed to load summary.');
  }
}

async function loadRules() {
  try {
    const res = await fetchThreatRules();

    const data = Array.isArray(res) ? res : [];

    setRules(data);
  } catch (err) {
    setError(err.message || 'Failed to load rule breakdown.');
  }
}

async function loadTimeline() {
  try {
    const res = await fetchThreatTimeline({ limit: 120 });

    const data = Array.isArray(res) ? res : [];

    setTimeline(data);
  } catch (err) {
    setError(err.message || 'Failed to load timeline.');
  }
}

async function loadMlModels() {
  setModelsLoading(true);
  try {
    const [statusRes, modelsRes] = await Promise.all([
      fetchMlStatus(),
      fetchMlModels()
    ]);

    setStatus(statusRes || null);

    const modelsData = Array.isArray(modelsRes) ? modelsRes : [];

    setModels(modelsData);

  } catch (err) {
    setError(err.message || 'Failed to load model versions.');
  } finally {
    setModelsLoading(false);
  }
}

  async function runDetect() {
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const res = await detectMl();
      if (!res?.trained) {
        setAnomalies([]);
        setError('Model is not trained yet. Train a model before viewing anomalies.');
        return;
      }
      const results = res?.results || [];
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
      const data = await trainMl({});
      if (!data?.trained) {
        setError(data?.reason || 'Training did not complete.');
        await loadMlModels();
        return;
      }

      setStatus(data || null);
      await loadMlModels();

      const version = data?.modelVersion;
      const samples = data?.sampleCount;
      const duration = data?.trainingDurationMs;

      if (version && samples !== undefined) {
        const durationText = duration ? ` in ${duration}ms` : '';
        setMessage(`Model v${version} trained with ${samples} samples${durationText}.`);
      } else {
        setMessage('Model trained successfully.');
      }
    } catch (err) {
      setError(err.message || 'Training failed.');
    } finally {
      setTraining(false);
    }
  }

  async function activateModel(modelId) {
    setActivatingModelId(modelId);
    setMessage('');
    setError('');
    try {
      const selectedModel = models.find((model) => String(model.id) === String(modelId));
      const data = await activateMlModel(modelId);
      if (data) {
        setStatus((current) => (current ? { ...current, ...data } : data));
      }
      const activatedVersion = data?.model_version || data?.modelVersion || selectedModel?.model_version;
      setMessage(
        activatedVersion ? `Model v${activatedVersion} activated.` : 'Model activated successfully.'
      );
      await loadMlModels();
    } catch (err) {
      setError(err.message || 'Failed to activate model.');
    } finally {
      setActivatingModelId(null);
    }
  }

  useEffect(() => {
    loadSummary();
    loadRules();
    loadTimeline();
    loadMlModels();
  }, []);

  const ruleBreakdownMax = useMemo(() => {
    return rules[0]?.cnt || 1;
  }, [rules]);

  const sortedTimeline = useMemo(
    () => sortRows(timeline, timelineSortConfig.fields, timelineSortConfig.direction),
    [timeline, timelineSortConfig]
  );

  const sortedAnomalies = useMemo(
    () => sortRows(anomalies, anomalySortConfig.fields, anomalySortConfig.direction),
    [anomalies, anomalySortConfig]
  );

  function openTimelineSortDialog() {
    setTimelineDraftFields(
      timelineSortConfig.fields.length > 0 ? timelineSortConfig.fields : [TIMELINE_SORT_FIELDS[0].key]
    );
    setTimelineDraftDirection(timelineSortConfig.direction);
    setTimelineSortOpen(true);
  }

  function openAnomalySortDialog() {
    setAnomalyDraftFields(
      anomalySortConfig.fields.length > 0 ? anomalySortConfig.fields : [ANOMALY_SORT_FIELDS[0].key]
    );
    setAnomalyDraftDirection(anomalySortConfig.direction);
    setAnomalySortOpen(true);
  }

  function toggleTimelineDraftField(fieldKey) {
    setTimelineDraftFields((current) =>
      current.includes(fieldKey) ? current.filter((key) => key !== fieldKey) : [...current, fieldKey]
    );
  }

  function toggleAnomalyDraftField(fieldKey) {
    setAnomalyDraftFields((current) =>
      current.includes(fieldKey) ? current.filter((key) => key !== fieldKey) : [...current, fieldKey]
    );
  }

  function applyTimelineSort() {
    setTimelineSortConfig({ fields: timelineDraftFields, direction: timelineDraftDirection });
    setTimelineSortOpen(false);
  }

  function applyAnomalySort() {
    setAnomalySortConfig({ fields: anomalyDraftFields, direction: anomalyDraftDirection });
    setAnomalySortOpen(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.3em] text-sky-300/80">Threat Analysis</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">ML Anomaly Intelligence</h1>
        <p className="mt-2 text-sm text-slate-300">Detect anomalies and investigate timelines.</p>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="glass-card rounded-2xl p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Total Alerts</div>
          <div className="mt-2 text-2xl font-semibold text-white">{summary?.summary?.total_alerts ?? 0}</div>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">ML Alerts</div>
          <div className="mt-2 text-2xl font-semibold text-amber-200">{summary?.summary?.ml_alerts ?? 0}</div>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Critical Alerts</div>
          <div className="mt-2 text-2xl font-semibold text-rose-200">{summary?.summary?.critical_alerts ?? 0}</div>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Last Alert</div>
          <div className="mt-2 text-sm text-slate-200">
            {summary?.summary?.last_alert_at ? new Date(summary.summary.last_alert_at).toLocaleString() : '—'}
          </div>
        </div>
      </section>

      <section className="glass-panel rounded-2xl p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-lg font-semibold text-white">
              <span>ML Model Registry</span>
              <span className="group relative inline-flex">
                <span className="inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full border border-sky-300/40 bg-sky-500/10 text-[11px] font-semibold text-sky-200">
                  i
                </span>
                <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-80 -translate-x-1/2 rounded-lg border border-white/15 bg-slate-900/95 px-3 py-2 text-xs font-normal leading-5 text-slate-200 shadow-xl group-hover:block">
                  Train stores a new baseline, Detect compares fresh traffic against the active model, and Saved Versions lets you reactivate older snapshots when needed.
                </span>
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-400">Train, detect, review anomalies, and reactivate model versions from one workspace.</p>
          </div>
          {modelsLoading && <span className="text-xs text-slate-400">Refreshing...</span>}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="glass-card rounded-2xl p-5 md:col-span-1">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Current Model</div>
            <div className="mt-2 text-2xl font-semibold text-white">
              {status?.modelVersion ? `v${status.modelVersion}` : 'Not trained'}
            </div>
            <div className="mt-3 space-y-2 text-sm text-slate-300">
              <div>Engine: {status?.engine || 'zscore'}</div>
              <div>Status: {status?.trained ? 'trained' : 'idle'}</div>
              <div>Samples: {status?.sampleCount ?? 0}</div>
              <div>Threshold: {status?.threshold ?? '—'}</div>
              <div>Active: {status?.isActive ? 'yes' : 'no'}</div>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-5 md:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-white">Saved Versions</div>
              <button
                type="button"
                onClick={loadMlModels}
                className="rounded-lg border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-white transition-all hover:bg-white/15"
              >
                Refresh
              </button>
            </div>

            {models.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-400">
                No saved models yet.
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-xs text-slate-300">
                  <thead className="text-[11px] uppercase tracking-widest text-slate-500">
                    <tr>
                      <th className="px-3 py-3">Version</th>
                      <th className="px-3 py-3">Created</th>
                      <th className="px-3 py-3">Samples</th>
                      <th className="px-3 py-3">Features</th>
                      <th className="px-3 py-3">Active</th>
                      <th className="px-3 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {models.map((model) => {
                      const snapshot = model.model_data || {};
                      const isCurrent = Boolean(model.is_active);
                      let actionLabel = 'Activate';
                      if (isCurrent) {
                        actionLabel = 'Current';
                      }
                      if (activatingModelId === model.id) {
                        actionLabel = 'Activating...';
                      }
                      return (
                        <tr key={model.id} className="hover:bg-white/5">
                          <td className="px-3 py-3 font-semibold text-white">v{model.model_version}</td>
                          <td className="px-3 py-3">{new Date(model.created_at).toLocaleString()}</td>
                          <td className="px-3 py-3">{snapshot.sampleCount ?? snapshot.sample_count ?? '—'}</td>
                          <td className="px-3 py-3">{snapshot.featureCount ?? (snapshot.features?.length || '—')}</td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${isCurrent ? 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/40' : 'bg-white/5 text-slate-200 ring-1 ring-white/10'}`}>
                              {isCurrent ? 'ACTIVE' : 'ARCHIVED'}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <button
                              type="button"
                              disabled={isCurrent || activatingModelId === model.id}
                              onClick={() => activateModel(model.id)}
                              className="rounded-lg bg-sky-500/90 px-3 py-1.5 text-[11px] font-semibold text-white transition-all hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {actionLabel}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-base font-semibold text-white">
                <span>ML Anomalies</span>
                <span className="group relative inline-flex">
                  <span className="inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full border border-sky-300/40 bg-sky-500/10 text-[11px] font-semibold text-sky-200">
                    i
                  </span>
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-80 -translate-x-1/2 rounded-lg border border-white/15 bg-slate-900/95 px-3 py-2 text-xs font-normal leading-5 text-slate-200 shadow-xl group-hover:block">
                    Train builds a baseline from monitored traffic windows. View Anomalies scores new windows against that baseline and flags results when score exceeds the active threshold.
                  </span>
                </span>
              </div>
              {anomalySortConfig.fields.length > 0 && (
                <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-xs text-sky-200">
                  Sorted by {anomalySortConfig.fields.map((field) => fieldLabel(field, ANOMALY_SORT_FIELDS)).join(', ')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {loading && <span className="text-xs text-slate-400">Loading...</span>}
              <button
                type="button"
                className="rounded-lg border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-white transition-all hover:-translate-y-[1px] hover:bg-white/15"
                onClick={openAnomalySortDialog}
              >
                Sort by
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-3">
            <button
              className="rounded-xl bg-sky-500/90 px-5 py-2 text-sm font-semibold text-white shadow-glow transition-all hover:-translate-y-[1px]"
              type="button"
              onClick={runTrain}
              disabled={training}
            >
              {training ? 'Training...' : 'Train Model'}
            </button>
            <button
              className="rounded-xl border border-white/10 bg-white/10 px-5 py-2 text-sm font-semibold text-white transition-all hover:-translate-y-[1px]"
              type="button"
              onClick={runDetect}
              disabled={loading}
            >
              {loading ? 'Detecting...' : 'View Anomalies'}
            </button>
          </div>

          {message && <div className="mt-3 text-sm text-emerald-300">{message}</div>}
          {error && <div className="mt-3 text-sm text-rose-300">{error}</div>}

          {anomalies.length === 0 && !loading ? (
            <div className="mt-6 rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-400">
              No ML anomalies detected yet.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-xs text-slate-300">
                <thead className="text-[11px] uppercase tracking-widest text-slate-500">
                  <tr>
                    <th className="px-3 py-3">IP</th>
                    <th className="px-3 py-3">Window Start</th>
                    <th className="px-3 py-3">Score</th>
                    <th className="px-3 py-3">Label</th>
                    <th className="px-3 py-3">RPM</th>
                    <th className="px-3 py-3">Error Rate</th>
                    <th className="px-3 py-3">Explainability</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {sortedAnomalies.map((row) => (
                    <tr key={`${row.ip}-${row.window_start}`} className="hover:bg-white/5">
                      <td className="px-3 py-3 text-mono">{row.ip}</td>
                      <td className="px-3 py-3">{new Date(row.window_start).toLocaleString()}</td>
                      <td className="px-3 py-3">{row.anomaly_score}</td>
                      <td className="px-3 py-3">
                        <span className="inline-flex rounded-full px-2 py-1 text-[11px] font-semibold bg-rose-500/20 text-rose-200 ring-1 ring-rose-500/40">
                          ANOMALY
                        </span>
                      </td>
                      <td className="px-3 py-3">{row.requests_per_minute}</td>
                      <td className="px-3 py-3">{row.error_rate}</td>
                      <td className="px-3 py-3 max-w-[220px] truncate">
                        {formatExplainability(row.explainability)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="glass-panel rounded-2xl p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="text-lg font-semibold text-white">Threat Timeline</div>
            {timelineSortConfig.fields.length > 0 && (
              <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-xs text-sky-200">
                Sorted by {timelineSortConfig.fields.map((field) => fieldLabel(field, TIMELINE_SORT_FIELDS)).join(', ')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-white transition-all hover:-translate-y-[1px] hover:bg-white/15"
              onClick={openTimelineSortDialog}
            >
              Sort by
            </button>
          </div>
        </div>

        {timeline.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-400">
            No alerts in timeline.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-xs text-slate-300">
              <thead className="text-[11px] uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-3 py-3">Time</th>
                  <th className="px-3 py-3">Source</th>
                  <th className="px-3 py-3">Rule</th>
                  <th className="px-3 py-3">Severity</th>
                  <th className="px-3 py-3">Score</th>
                  <th className="px-3 py-3">IP</th>
                  <th className="px-3 py-3">Endpoint</th>
                  <th className="px-3 py-3">Mitigation</th>
                  <th className="px-3 py-3">Explainability</th>
                  <th className="px-3 py-3">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sortedTimeline.map((row) => (
                  <tr key={row.id} className="hover:bg-white/5">
                    <td className="px-3 py-3">{new Date(row.timestamp).toLocaleTimeString()}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${sourceBadge(row.source)}`}>
                        {row.source || 'RULE'}
                      </span>
                    </td>
                    <td className="px-3 py-3">{row.rule_triggered}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${severityClass(row.severity)}`}>
                        {row.severity}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-amber-200">{formatThreatScore(row)}</td>
                    <td className="px-3 py-3 text-mono">{row.ip}</td>
                    <td className="px-3 py-3 text-mono">{row.endpoint}</td>
                    <td className="px-3 py-3">
                      <span className="inline-flex rounded-full px-2 py-1 text-[11px] font-semibold bg-white/5 text-slate-200 ring-1 ring-white/10">
                        {row.mitigation_action || 'NONE'}
                      </span>
                    </td>
                    <td className="px-3 py-3 max-w-[220px] truncate">
                      {formatExplainability(row.ml_explainability)}
                    </td>
                    <td className="px-3 py-3 max-w-[220px] truncate" title={row.reason}>{row.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="glass-panel rounded-2xl p-6">
        <div className="text-lg font-semibold text-white">Top Suspicious IPs</div>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div className="glass-card rounded-2xl p-5">
            <div className="text-sm font-semibold text-white">Rule-Based</div>
            {summary?.topAttackers?.length ? (
              <div className="mt-4 space-y-3">
                {summary.topAttackers.map((row) => (
                  <div key={row.ip} className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span className="text-mono text-rose-200">{row.ip}</span>
                      <span className="text-slate-400">score {row.score}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-white/5">
                      <div className="h-2 rounded-full bg-rose-400/70" style={{ width: `${Math.min(row.score * 10, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 text-sm text-slate-400">No rule-based suspects.</div>
            )}
          </div>
          <div className="glass-card rounded-2xl p-5">
            <div className="text-sm font-semibold text-white">ML-Based</div>
            {summary?.mlTopIps?.length ? (
              <div className="mt-4 space-y-3">
                {summary.mlTopIps.map((row) => (
                  <div key={row.ip} className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span className="text-mono text-rose-200">{row.ip}</span>
                      <span className="text-slate-400">{row.count} anomaly windows</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-white/5">
                      <div className="h-2 rounded-full bg-fuchsia-400/70" style={{ width: `${Math.min(row.count * 20, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 text-sm text-slate-400">No ML suspects.</div>
            )}
          </div>
        </div>
      </section>

      <section className="glass-panel rounded-2xl p-6">
        <div className="text-lg font-semibold text-white">Rule Breakdown</div>
        {rules.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-400">
            No rule data yet.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {rules.map((row) => {
              const pct = Math.round((row.cnt / ruleBreakdownMax) * 100);
              return (
                <div key={`${row.rule_triggered}-${row.source}`} className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span className="text-mono">{row.rule_triggered}</span>
                    <span className="text-slate-400">{row.cnt} · {row.source}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/5">
                    <div className="h-2 rounded-full bg-sky-400/70" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="glass-panel rounded-2xl p-6">
        <div className="text-lg font-semibold text-white">Investigation Notes</div>
        <textarea
          className="mt-4 w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200 focus:border-sky-400 focus:outline-none"
          rows={6}
          placeholder="Write analyst notes here..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </section>

      {status && (
        <div className="text-xs text-slate-400">Model status: {status.engine}</div>
      )}

      <TableSortDialog
        open={timelineSortOpen}
        title="Threat Timeline"
        fields={TIMELINE_SORT_FIELDS}
        selectedFields={timelineDraftFields}
        direction={timelineDraftDirection}
        onToggleField={toggleTimelineDraftField}
        onChangeDirection={setTimelineDraftDirection}
        onApply={applyTimelineSort}
        onCancel={() => setTimelineSortOpen(false)}
      />

      <TableSortDialog
        open={anomalySortOpen}
        title="ML Anomalies"
        fields={ANOMALY_SORT_FIELDS}
        selectedFields={anomalyDraftFields}
        direction={anomalyDraftDirection}
        onToggleField={toggleAnomalyDraftField}
        onChangeDirection={setAnomalyDraftDirection}
        onApply={applyAnomalySort}
        onCancel={() => setAnomalySortOpen(false)}
      />
    </div>
  );
}

function severityClass(severity) {
  if (severity === 'critical') return 'bg-fuchsia-500/20 text-fuchsia-200 ring-1 ring-fuchsia-500/40';
  if (severity === 'high') return 'bg-rose-500/20 text-rose-200 ring-1 ring-rose-500/40';
  if (severity === 'medium') return 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/40';
  if (severity === 'low') return 'bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/40';
  return 'bg-white/5 text-slate-200 ring-1 ring-white/10';
}

function sourceBadge(source) {
  if (source === 'ML') return 'bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-500/40';
  if (source === 'RULE') return 'bg-white/5 text-slate-200 ring-1 ring-white/10';
  return 'bg-white/5 text-slate-200 ring-1 ring-white/10';
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
  return String(weight * count);
}

function formatExplainability(explainability) {
  let parsed = explainability;
  if (typeof explainability === 'string') {
    try {
      parsed = JSON.parse(explainability);
    } catch (err) {
      console.warn('Failed to parse explainability payload:', err);
      parsed = null;
    }
  }
  const data = parsed?.top_features || parsed?.topFeatures || parsed?.top_features;
  if (!data || !Array.isArray(data) || data.length === 0) return '—';
  return data
    .map((f) => `${f.feature}: z=${Number(f.z).toFixed(2)}`)
    .join(', ');
}

function fieldLabel(fieldKey, fields) {
  return fields.find((field) => field.key === fieldKey)?.label || fieldKey;
}
