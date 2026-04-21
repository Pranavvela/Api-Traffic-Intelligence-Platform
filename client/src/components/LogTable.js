import React from 'react';
import PropTypes from 'prop-types';
import TableSortDialog from './TableSortDialog';
import { sortRows } from '../utils/tableSort';

const SORT_FIELDS = [
  { key: 'timestamp', label: 'Time' },
  { key: 'method', label: 'Method' },
  { key: 'endpoint', label: 'Endpoint' },
  { key: 'status_code', label: 'Status' },
  { key: 'ip', label: 'IP' },
  { key: 'response_ms', label: 'Resp (ms)' },
  { key: 'user_agent', label: 'User Agent' },
];

export default function LogTable({ logs }) {
  const [sortConfig, setSortConfig] = React.useState({ fields: [], direction: 'asc' });
  const [draftFields, setDraftFields] = React.useState([SORT_FIELDS[0].key]);
  const [draftDirection, setDraftDirection] = React.useState('desc');
  const [sortOpen, setSortOpen] = React.useState(false);

  const sortedLogs = React.useMemo(
    () => sortRows(logs, sortConfig.fields, sortConfig.direction),
    [logs, sortConfig]
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
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Live API Logs</div>
          <div className="text-lg font-semibold text-white">Recent Requests</div>
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
          <div>{logs.length} entries</div>
        </div>
      </div>

      <div className="p-4">
        {logs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-400">
            No log entries yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-xs text-slate-300">
              <thead className="text-[11px] uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-3 py-3">Time</th>
                  <th className="px-3 py-3">Method</th>
                  <th className="px-3 py-3">Endpoint</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">IP</th>
                  <th className="px-3 py-3">Resp (ms)</th>
                  <th className="px-3 py-3">User Agent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sortedLogs.map((log) => {
                  const userAgent = log.user_agent || '';
                  let truncatedAgent = '—';
                  if (userAgent) {
                    const ellipsis = userAgent.length > 40 ? '…' : '';
                    truncatedAgent = `${userAgent.substring(0, 40)}${ellipsis}`;
                  }
                  return (
                  <tr key={log.request_id} className="hover:bg-white/5">
                    <td className="px-3 py-3">{fmtTime(log.timestamp)}</td>
                    <td className="px-3 py-3 font-semibold">{log.method}</td>
                    <td className="px-3 py-3 text-mono">{log.endpoint}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${statusClass(log.status_code)}`}
                        title={statusDescription(log.status_code)}
                      >
                        {log.status_code}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-mono text-slate-300">{log.ip}</td>
                    <td className="px-3 py-3">{log.response_ms ?? '—'}</td>
                    <td className="px-3 py-3 max-w-[200px] truncate text-slate-400" title={userAgent}>
                      {truncatedAgent}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <TableSortDialog
        open={sortOpen}
        title="Recent Requests"
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

LogTable.propTypes = {
  logs: PropTypes.arrayOf(
    PropTypes.shape({
      request_id: PropTypes.string,
      timestamp: PropTypes.string,
      method: PropTypes.string,
      endpoint: PropTypes.string,
      status_code: PropTypes.number,
      ip: PropTypes.string,
      response_ms: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      user_agent: PropTypes.string,
    })
  ).isRequired,
};

function statusClass(code) {
  if (!code) return 'bg-white/5 text-slate-200 ring-1 ring-white/10';
  if (code < 300) return 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/40';
  if (code < 400) return 'bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/40';
  if (code < 500) return 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/40';
  return 'bg-rose-500/20 text-rose-200 ring-1 ring-rose-500/40';
}

function statusDescription(code) {
  const numeric = Number(code);
  if (!Number.isFinite(numeric)) return 'Unknown status';

  const map = {
    200: 'OK',
    201: 'Created',
    202: 'Accepted',
    204: 'No Content',
    301: 'Moved Permanently',
    302: 'Found',
    304: 'Not Modified',
    307: 'Temporary Redirect',
    308: 'Permanent Redirect',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    408: 'Request Timeout',
    409: 'Conflict',
    413: 'Payload Too Large',
    415: 'Unsupported Media Type',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
  };

  if (map[numeric]) return `${numeric} ${map[numeric]}`;
  if (numeric >= 100 && numeric < 200) return `${numeric} Informational response`;
  if (numeric < 300) return `${numeric} Success`;
  if (numeric < 400) return `${numeric} Redirection`;
  if (numeric < 500) return `${numeric} Client error`;
  if (numeric < 600) return `${numeric} Server error`;
  return `${numeric} Unknown status`;
}

function fmtTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function fieldLabel(fieldKey) {
  return SORT_FIELDS.find((field) => field.key === fieldKey)?.label || fieldKey;
}
