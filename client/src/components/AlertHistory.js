import React from 'react';
import PropTypes from 'prop-types';
import TableSortDialog from './TableSortDialog';
import InfoTooltip from './InfoTooltip';
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
  { key: 'last_seen', label: 'Last Seen' },
  { key: 'rule_triggered', label: 'Rule' },
  { key: 'severity', label: 'Severity' },
  { key: 'source', label: 'Source' },
  { key: 'ip', label: 'IP' },
  { key: 'endpoint', label: 'Endpoint' },
  { key: 'alert_count', label: 'Count' },
  { key: 'score', label: 'Score', getValue: formatThreatScore },
  { key: 'alert_state', label: 'State' },
  { key: 'confidence_score', label: 'Confidence' },
  { key: 'mitigation_action', label: 'Mitigation' },
  { key: 'reason', label: 'Reason' },
];

export default function AlertHistory({ alerts }) {
  const [sortConfig, setSortConfig] = React.useState({ fields: [], direction: 'asc' });
  const [draftFields, setDraftFields] = React.useState([SORT_FIELDS[0].key]);
  const [draftDirection, setDraftDirection] = React.useState('desc');
  const [sortOpen, setSortOpen] = React.useState(false);

  const sortedAlerts = React.useMemo(
    () => sortRows(alerts, sortConfig.fields, sortConfig.direction),
    [alerts, sortConfig]
  );

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
    <section className="glass-panel rounded-2xl">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Alert History</span>
            <InfoTooltip 
              title="Alert History" 
              description="Resolved and closed security alerts from the past. Shows patterns of previously addressed threats and mitigation actions taken." 
            />
          </div>
          <div className="text-lg font-semibold text-white">Resolved Incidents</div>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-400">
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
          <span>{alerts.length} resolved</span>
        </div>
      </div>

      <div className="p-4">
        {alerts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-400">
            No threats detected in resolved history.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-xs text-slate-300">
              <thead className="text-[11px] uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-3 py-3">Time</th>
                  <th className="px-3 py-3">Last Seen</th>
                  <th className="px-3 py-3">Rule</th>
                  <th className="px-3 py-3">Severity</th>
                  <th className="px-3 py-3">Source</th>
                  <th className="px-3 py-3">IP</th>
                  <th className="px-3 py-3">Endpoint</th>
                  <th className="px-3 py-3">Count</th>
                  <th className="px-3 py-3">Score</th>
                  <th className="px-3 py-3">State</th>
                  <th className="px-3 py-3">Confidence</th>
                  <th className="px-3 py-3">Mitigation</th>
                  <th className="px-3 py-3">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sortedAlerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-white/5">
                    <td className="px-3 py-3" title={alert.timestamp}>{fmtTime(alert.timestamp)}</td>
                    <td className="px-3 py-3" title={alert.last_seen}>{fmtTime(alert.last_seen)}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${SEVERITY_CLASS[normalizeSeverity(alert.severity)] || 'bg-white/5 text-slate-200'}`}>
                        {RULE_LABELS[alert.rule_triggered] || alert.rule_triggered}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${SEVERITY_CLASS[normalizeSeverity(alert.severity)] || 'bg-white/5 text-slate-200'}`}>
                        {alert.severity}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${SOURCE_CLASS[alert.source] || 'bg-white/5 text-slate-200'}`}>
                        {alert.source || 'RULE'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-mono text-slate-300">{alert.ip}</td>
                    <td className="px-3 py-3 text-mono">{alert.endpoint}</td>
                    <td className="px-3 py-3 text-amber-200">
                      {alert.alert_count > 1 ? `×${alert.alert_count}` : '—'}
                    </td>
                    <td className="px-3 py-3 text-amber-200">{formatThreatScore(alert)}</td>
                    <td className="px-3 py-3">
                      <span className="inline-flex rounded-full bg-white/5 px-2 py-1 text-[11px] font-semibold text-slate-200 ring-1 ring-white/10">
                        {alert.alert_state || (alert.resolved ? 'RESOLVED' : 'ACTIVE')}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-300">
                      {alert.confidence_score !== null && alert.confidence_score !== undefined
                        ? Number(alert.confidence_score).toFixed(2)
                        : '—'}
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex rounded-full px-2 py-1 text-[11px] font-semibold bg-white/5 text-slate-200 ring-1 ring-white/10">
                        {alert.mitigation_action || 'NONE'}
                      </span>
                    </td>
                    <td className="px-3 py-3 max-w-[200px] truncate" title={alert.reason}>{alert.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <TableSortDialog
        open={sortOpen}
        title="Resolved Incidents"
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
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function normalizeSeverity(severity) {
  return String(severity || '').toLowerCase();
}

function formatThreatScore(alert) {
  if (alert.source === 'ML' && alert.anomaly_score !== null && alert.anomaly_score !== undefined) {
    return Number(alert.anomaly_score).toFixed(2);
  }
  const weight = THREAT_WEIGHTS[alert.severity] || 1;
  const count = alert.alert_count || 1;
  return String(weight * count);
}

function fieldLabel(fieldKey) {
  return SORT_FIELDS.find((field) => field.key === fieldKey)?.label || fieldKey;
}

AlertHistory.propTypes = {
  alerts: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number,
      timestamp: PropTypes.string,
      last_seen: PropTypes.string,
      severity: PropTypes.string,
      rule_triggered: PropTypes.string,
      source: PropTypes.string,
      ip: PropTypes.string,
      endpoint: PropTypes.string,
      alert_count: PropTypes.number,
      anomaly_score: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      confidence_score: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      alert_state: PropTypes.string,
      mitigation_action: PropTypes.string,
      reason: PropTypes.string,
    })
  ).isRequired,
};
