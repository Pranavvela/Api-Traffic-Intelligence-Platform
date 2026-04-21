import React from 'react';
import PropTypes from 'prop-types';
import { resolveAlert, blockIp } from '../services/api';
import TableSortDialog from './TableSortDialog';
import { sortRows } from '../utils/tableSort';

const SEVERITY_CLASS = {
  critical: 'bg-fuchsia-500/20 text-fuchsia-200 ring-1 ring-fuchsia-500/40',
  high: 'bg-rose-500/20 text-rose-200 ring-1 ring-rose-500/40',
  medium: 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/40',
  low: 'bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/40',
};

const RULE_LABELS = {
  RATE_LIMIT_VIOLATION: 'Rate Limit',
  REPEATED_LOGIN_FAILURE: 'Brute Force',
  ENDPOINT_FLOODING: 'Flooding',
  BURST_DETECTION: 'Burst',
  BURST_TRAFFIC: 'Burst Traffic',
  ENDPOINT_FLOOD: 'Endpoint Flood',
};

const MITIGATION_CLASS = {
  BLOCKED: 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/40',
  THROTTLED: 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/40',
  MONITORED: 'bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/40',
  NONE: 'bg-white/5 text-slate-300 ring-1 ring-white/10',
};

const SOURCE_CLASS = {
  RULE: 'bg-white/5 text-slate-200 ring-1 ring-white/10',
  ML: 'bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-500/40',
};

const THREAT_WEIGHTS = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 5,
};

const SORT_FIELDS = [
  { key: 'timestamp', label: 'Time' },
  { key: 'rule_triggered', label: 'Rule' },
  { key: 'severity', label: 'Severity' },
  { key: 'source', label: 'Source' },
  { key: 'ip', label: 'IP' },
  { key: 'endpoint', label: 'Endpoint' },
  { key: 'alert_count', label: 'Count' },
  { key: 'score', label: 'Score', getValue: formatThreatScore },
  { key: 'mitigation_action', label: 'Mitigation' },
  { key: 'reason', label: 'Reason' },
];

export default function AlertPanel({ alerts, onResolved }) {
  const active = alerts.filter((a) => !a.resolved);
  const totalOccurrences = active.reduce((sum, alert) => sum + (alert.alert_count || 1), 0);
  const [actionError, setActionError] = React.useState('');
  const [sortConfig, setSortConfig] = React.useState({ fields: [], direction: 'asc' });
  const [draftFields, setDraftFields] = React.useState([SORT_FIELDS[0].key]);
  const [draftDirection, setDraftDirection] = React.useState('desc');
  const [sortOpen, setSortOpen] = React.useState(false);
  const [expandedGroups, setExpandedGroups] = React.useState(() => new Set());
  const [expandedAlerts, setExpandedAlerts] = React.useState(() => new Set());
  const [busyAlertIds, setBusyAlertIds] = React.useState(() => new Set());

  const sortedAlerts = React.useMemo(
    () => sortRows(active, sortConfig.fields, sortConfig.direction),
    [active, sortConfig]
  );

  const groupedAlerts = React.useMemo(() => groupAlerts(sortedAlerts), [sortedAlerts]);

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

  function toggleGroup(groupKey) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }

  function toggleAlert(alertId) {
    setExpandedAlerts((prev) => {
      const next = new Set(prev);
      if (next.has(alertId)) {
        next.delete(alertId);
      } else {
        next.add(alertId);
      }
      return next;
    });
  }

  async function handleResolve(id) {
    try {
      setActionError('');
      setBusyAlertIds((prev) => new Set(prev).add(id));
      await resolveAlert(id);
      onResolved();
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to resolve alert.';
      setActionError(message);
      console.error('Failed to resolve alert:', message);
    } finally {
      setBusyAlertIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleBlock(ip, alertId) {
    try {
      setActionError('');
      setBusyAlertIds((prev) => new Set(prev).add(alertId));
      await blockIp(ip, `Blocked from dashboard alert #${alertId}.`);
      await resolveAlert(alertId);
      onResolved();
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to block IP.';
      setActionError(message);
      console.error('Failed to block IP:', message);
    } finally {
      setBusyAlertIds((prev) => {
        const next = new Set(prev);
        next.delete(alertId);
        return next;
      });
    }
  }

  return (
    <section className="glass-panel rounded-2xl">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Active Alerts</div>
          <div className="flex items-center gap-2 text-lg font-semibold text-white">
            <span>Incident Queue</span>
            <span className="group relative inline-flex">
              <span className="inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full border border-sky-300/40 bg-sky-500/10 text-[11px] font-semibold text-sky-200">
                i
              </span>
              <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-80 -translate-x-1/2 rounded-lg border border-white/15 bg-slate-900/95 px-3 py-2 text-xs font-normal leading-5 text-slate-200 shadow-xl group-hover:block">
                Displays unresolved alerts for monitored registered APIs. Severity/source and risk score are derived from rule triggers, anomaly score, and alert frequency.
              </span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm font-semibold text-amber-200">
          {sortConfig.fields.length > 0 && (
            <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-xs text-sky-200">
              Sorted by {sortConfig.fields.map((field) => fieldLabel(field)).join(', ')}
            </span>
          )}
          <button
            type="button"
            onClick={openSortDialog}
            className="rounded-lg border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-white transition-all hover:-translate-y-[1px] hover:bg-white/15"
          >
            Sort by
          </button>
          <span>{totalOccurrences} unresolved</span>
        </div>
      </div>

      {actionError && (
        <div className="px-5 pt-3 text-sm text-rose-300">{actionError}</div>
      )}

      <div className="p-4">
        {active.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-400">
            No active alerts. System healthy.
          </div>
        ) : (
          <div className="space-y-4">
            {groupedAlerts.map((group) => {
              const isExpanded = expandedGroups.has(group.key);
              const severityKey = normalizeSeverityKey(group.severity);
              return (
                <div key={group.key} className="rounded-2xl border border-white/10 bg-white/5">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.key)}
                    className="flex w-full flex-wrap items-center justify-between gap-4 px-4 py-4 text-left"
                  >
                    <div>
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Threat Source</div>
                      <div className="mt-1 flex flex-wrap items-center gap-3">
                        <span className="text-lg font-semibold text-white text-mono">{group.ip}</span>
                        <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${SEVERITY_CLASS[severityKey] || 'bg-white/5 text-slate-200'}`}>
                          {group.severity}
                        </span>
                        {group.isCritical && (
                          <span className="inline-flex rounded-full bg-rose-500/20 px-2 py-1 text-[11px] font-semibold text-rose-200 ring-1 ring-rose-500/40 animate-pulse">
                            Critical
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        Last seen {formatRelativeTime(group.lastSeen)} · {group.totalCount} events
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.2em]">Risk Score</div>
                        <div className="mt-1 text-base font-semibold text-amber-200">{group.riskScore}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.2em]">Rules</div>
                        <div className="mt-1 text-base font-semibold text-slate-200">{group.rules.length}</div>
                      </div>
                      <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-slate-300">
                        {isExpanded ? 'Collapse' : 'Expand'}
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-white/10 px-4 pb-4">
                      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                        <div className="space-y-3">
                          {group.rules.map((alert) => {
                            const isAlertExpanded = expandedAlerts.has(alert.id);
                            const alertSeverity = normalizeSeverityKey(alert.severity);
                            return (
                              <div key={alert.id} className="rounded-xl border border-white/10 bg-slate-950/40">
                                <button
                                  type="button"
                                  onClick={() => toggleAlert(alert.id)}
                                  className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left"
                                >
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${SEVERITY_CLASS[alertSeverity] || 'bg-white/5 text-slate-200'}`}>
                                        {RULE_LABELS[alert.rule_triggered] || alert.rule_triggered}
                                      </span>
                                      <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${SOURCE_CLASS[alert.source] || 'bg-white/5 text-slate-200'}`}>
                                        {alert.source || 'RULE'}
                                      </span>
                                      <span className="text-[11px] text-slate-400">{formatThreatScore(alert)} risk</span>
                                    </div>
                                    <div className="mt-2 text-xs text-slate-400">
                                      {alert.endpoint} · last seen {formatRelativeTime(alert.last_seen || alert.timestamp)}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="rounded-full bg-white/5 px-2 py-1 text-[11px] text-slate-300">
                                      ×{alert.alert_count || 1}
                                    </span>
                                    <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-slate-300">
                                      {isAlertExpanded ? 'Hide' : 'Details'}
                                    </span>
                                  </div>
                                </button>
                                {isAlertExpanded && (
                                  <div className="border-t border-white/10 px-4 py-3 text-xs text-slate-300">
                                    <div className="grid gap-3 lg:grid-cols-2">
                                      <div>
                                        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Reason</div>
                                        <div className="mt-1 text-sm text-slate-200">{alert.reason}</div>
                                        <div className="mt-3 flex flex-wrap items-center gap-2">
                                          <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${MITIGATION_CLASS[alert.mitigation_action] || 'bg-white/5 text-slate-200'}`}>
                                            {alert.mitigation_action || 'NONE'}
                                          </span>
                                          {alert.confidence_score !== undefined && alert.confidence_score !== null && (
                                            <span className="rounded-full border border-sky-400/30 bg-sky-500/10 px-2 py-1 text-[11px] text-sky-200">
                                              Confidence {Number(alert.confidence_score).toFixed(2)}
                                            </span>
                                          )}
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                          <button
                                            className="rounded-lg border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-white transition-all hover:-translate-y-[1px] hover:bg-white/15"
                                            onClick={() => handleResolve(alert.id)}
                                            disabled={busyAlertIds.has(alert.id)}
                                          >
                                            {busyAlertIds.has(alert.id) ? 'Working...' : 'Mark as Reviewed'}
                                          </button>
                                          <button
                                            className="rounded-lg border border-rose-500/40 bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-200 transition-all hover:-translate-y-[1px]"
                                            onClick={() => handleBlock(alert.ip, alert.id)}
                                            disabled={busyAlertIds.has(alert.id)}
                                          >
                                            {busyAlertIds.has(alert.id) ? 'Working...' : 'Block IP'}
                                          </button>
                                        </div>
                                      </div>
                                      <div className="space-y-3">
                                        <div>
                                          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Attack Timeline</div>
                                          <Timeline items={buildTimeline(alert)} />
                                        </div>
                                        <div>
                                          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">ML Explainability</div>
                                          <ExplainabilityPanel data={alert.ml_explainability} />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-white/5 p-4">
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Activity Feed</div>
                          <div className="mt-3 max-h-72 space-y-3 overflow-y-auto pr-1">
                            {group.activity.length === 0 ? (
                              <div className="text-xs text-slate-400">No recent activity.</div>
                            ) : (
                              group.activity.map((item, index) => (
                                <div key={`${group.key}-activity-${index}`} className="flex min-w-0 items-start gap-2 text-xs text-slate-300">
                                  <span className="mt-1 h-2 w-2 rounded-full bg-sky-400/80" />
                                  <div className="min-w-0">
                                    <div className="break-words font-semibold text-slate-100">{item.label}</div>
                                    <div className="text-[11px] text-slate-400">{formatRelativeTime(item.timestamp)}</div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <TableSortDialog
        open={sortOpen}
        title="Incident Queue"
        fields={SORT_FIELDS}
        selectedFields={draftFields}
        direction={draftDirection}
        onToggleField={toggleDraftField}
        onChangeDirection={setDraftDirection}
        onApply={applySort}
        onCancel={() => setSortOpen(false)}
      />
    </section>
  );
}

function fmtTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatRelativeTime(ts) {
  if (!ts) return '—';
  const deltaMs = Date.now() - new Date(ts).getTime();
  if (!Number.isFinite(deltaMs)) return '—';
  const seconds = Math.max(1, Math.round(deltaMs / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

function formatThreatScore(alert) {
  if (alert.source === 'ML' && alert.anomaly_score !== null && alert.anomaly_score !== undefined) {
    return Number(alert.anomaly_score).toFixed(2);
  }
  const weight = THREAT_WEIGHTS[alert.severity] || 1;
  const count = alert.alert_count || 1;
  return String(weight * count);
}

function normalizeSeverityKey(severity) {
  return String(severity || '').toLowerCase();
}

function severityRank(severity) {
  const normalized = normalizeSeverityKey(severity);
  if (normalized === 'critical') return 4;
  if (normalized === 'high') return 3;
  if (normalized === 'medium') return 2;
  return 1;
}

function groupAlerts(alerts) {
  const groups = new Map();

  alerts.forEach((alert) => {
    const key = alert.ip || 'unknown';
    const existing = groups.get(key);
    const lastSeen = alert.last_seen || alert.timestamp;
    const alertCount = alert.alert_count || 1;
    const score = Number.parseFloat(formatThreatScore(alert)) || 0;
    const severity = alert.severity || 'low';

    if (!existing) {
      groups.set(key, {
        key,
        ip: alert.ip,
        lastSeen,
        totalCount: alertCount,
        severity,
        riskScore: score,
        rules: [alert],
        activity: buildActivity(alert),
      });
      return;
    }

    existing.totalCount += alertCount;
    existing.riskScore += score;
    if (severityRank(severity) > severityRank(existing.severity)) {
      existing.severity = severity;
    }
    if (lastSeen && (!existing.lastSeen || new Date(lastSeen) > new Date(existing.lastSeen))) {
      existing.lastSeen = lastSeen;
    }
    existing.rules.push(alert);
    existing.activity = mergeActivity(existing.activity, buildActivity(alert));
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      riskScore: Math.round(group.riskScore * 10) / 10,
      isCritical: normalizeSeverityKey(group.severity) === 'critical',
    }))
    .sort((a, b) => b.riskScore - a.riskScore);
}

function buildActivity(alert) {
  const timestamp = alert.last_seen || alert.timestamp;
  return [{
    label: `${alert.ip || 'IP'} triggered ${RULE_LABELS[alert.rule_triggered] || alert.rule_triggered}`,
    timestamp,
  }];
}

function mergeActivity(current, incoming) {
  const merged = [...current, ...incoming];
  merged.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return merged.slice(0, 4);
}

function buildTimeline(alert) {
  if (Array.isArray(alert.timeline) && alert.timeline.length > 0) {
    return alert.timeline.map((item) => ({
      label: item.event,
      timestamp: item.timestamp,
    }));
  }

  return [{
    label: RULE_LABELS[alert.rule_triggered] || alert.rule_triggered,
    timestamp: alert.timestamp,
  }];
}

function ExplainabilityPanel({ data = null }) {
  const parsed = parseExplainability(data);
  if (!parsed || parsed.length === 0) {
    return <div className="mt-2 text-xs text-slate-400">No ML explainability available.</div>;
  }

  return (
    <div className="mt-2 space-y-2">
      {parsed.map((item, index) => (
        <div key={`${item.feature}-${index}`} className="flex items-center justify-between text-xs text-slate-300">
          <div className="text-slate-200">{formatFeatureName(item.feature)}</div>
          <div className="text-slate-400">
            value {formatMetric(item.value)} · z {formatMetric(item.z || item.weighted_z)}
          </div>
        </div>
      ))}
    </div>
  );
}

ExplainabilityPanel.propTypes = {
  data: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
};

function parseExplainability(raw) {
  if (!raw) return null;
  let data = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch (err) {
      console.warn('Failed to parse ML explainability payload:', err);
      return null;
    }
  }

  if (Array.isArray(data.top_features)) return data.top_features;
  if (Array.isArray(data?.explainability?.top_features)) return data.explainability.top_features;
  return null;
}

function formatFeatureName(feature) {
  return String(feature || '')
    .replaceAll('_', ' ')
    .replaceAll(/\b\w/g, (c) => c.toUpperCase());
}

function formatMetric(value) {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toFixed(2);
}

function Timeline({ items = [] }) {
  if (!items || items.length === 0) {
    return <div className="mt-2 text-xs text-slate-400">No timeline events.</div>;
  }

  return (
    <div className="mt-2 space-y-3">
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`} className="flex items-start gap-2 text-xs text-slate-300">
          <span className="mt-1 h-2 w-2 rounded-full bg-sky-400/80" />
          <div>
            <div className="text-slate-200">{item.label}</div>
            <div className="text-[11px] text-slate-400">{formatRelativeTime(item.timestamp)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

Timeline.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string,
      timestamp: PropTypes.string,
    })
  ),
};

function fieldLabel(fieldKey) {
  return SORT_FIELDS.find((field) => field.key === fieldKey)?.label || fieldKey;
}

AlertPanel.propTypes = {
  alerts: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number,
      resolved: PropTypes.bool,
      timestamp: PropTypes.string,
      last_seen: PropTypes.string,
      severity: PropTypes.string,
      rule_triggered: PropTypes.string,
      source: PropTypes.string,
      ip: PropTypes.string,
      endpoint: PropTypes.string,
      alert_count: PropTypes.number,
      mitigation_action: PropTypes.string,
      anomaly_score: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      confidence_score: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      ml_explainability: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
      timeline: PropTypes.arrayOf(
        PropTypes.shape({
          event: PropTypes.string,
          timestamp: PropTypes.string,
        })
      ),
      reason: PropTypes.string,
    })
  ).isRequired,
  onResolved: PropTypes.func.isRequired,
};
