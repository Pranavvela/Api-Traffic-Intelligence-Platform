import React from 'react';
import PropTypes from 'prop-types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
  ResponsiveContainer,
} from 'recharts';

/**
 * TrafficGraph — displays requests per minute for the last 5 minutes.
 * @param {Object[]} data  [{minute: string, request_count: number}]
 */
const RANGE_LABELS = {
  '5m': 'Last 5 Minutes',
  '1h': 'Last 1 Hour',
  '12h': 'Last 12 Hours',
  '24h': 'Last 24 Hours',
  '7d': 'Last 7 Days',
  '1m': 'Last 30 Days',
  '1y': 'Last 12 Months',
};

const RANGE_OPTIONS = ['5m', '1h', '12h', '24h', '7d', '1m', '1y'];

export default function TrafficGraph({ data, range = '5m', onRangeChange = () => {} }) {
  // Format minute label to HH:MM
  const formatted = (data || []).map((d) => ({
    ...d,
    label: fmtBucket(d.bucket || d.minute, range),
    count: Number.parseInt(d.request_count, 10),
  }));

  const peakValue = formatted.reduce((max, row) => Math.max(max, row.count || 0), 0);

  return (
    <section className="glass-panel rounded-2xl">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Request Rate</div>
          <div className="text-lg font-semibold text-white">{RANGE_LABELS[range] || 'Last 5 Minutes'}</div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-slate-300">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onRangeChange(option)}
              className={`rounded-full px-3 py-1 transition-all ${
                range === option
                  ? 'bg-white/15 text-white ring-1 ring-white/20'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4" style={{ minHeight: 200 }}>
        {formatted.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-400">
            No traffic data yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={formatted} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="lineGlow" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#a855f7" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
              <XAxis
                dataKey="label"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={{ stroke: 'rgba(148, 163, 184, 0.2)' }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={{ stroke: 'rgba(148, 163, 184, 0.2)' }}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(15, 23, 42, 0.9)',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: 6,
                  fontSize: 12,
                  color: '#e2e8f0',
                }}
                labelStyle={{ color: '#94a3b8' }}
                itemStyle={{ color: '#38bdf8' }}
                formatter={(v) => [`${v} req`, 'Requests']}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="url(#lineGlow)"
                strokeWidth={2.5}
                dot={<PeakDot peakValue={peakValue} />}
                activeDot={{ r: 5 }}
                isAnimationActive
                animationDuration={1400}
                animationEasing="ease-out"
              >
                <LabelList dataKey="count" content={<PeakLabel peakValue={peakValue} />} />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

function PeakDot({ cx, cy, value, peakValue }) {
  if (!value || value !== peakValue || peakValue === 0) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={6} fill="#f97316" opacity={0.18} />
      <circle cx={cx} cy={cy} r={3} fill="#f97316" />
    </g>
  );
}

PeakDot.propTypes = {
  cx: PropTypes.number,
  cy: PropTypes.number,
  value: PropTypes.number,
  peakValue: PropTypes.number,
};

function PeakLabel({ x, y, value, peakValue }) {
  if (!value || value !== peakValue || peakValue === 0) return null;
  return (
    <text x={x} y={y - 10} fill="#f97316" fontSize="10" textAnchor="middle">
      Peak {value}
    </text>
  );
}

PeakLabel.propTypes = {
  x: PropTypes.number,
  y: PropTypes.number,
  value: PropTypes.number,
  peakValue: PropTypes.number,
};

TrafficGraph.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      minute: PropTypes.string,
      bucket: PropTypes.string,
      request_count: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    })
  ).isRequired,
  range: PropTypes.oneOf(RANGE_OPTIONS),
  onRangeChange: PropTypes.func,
};

function fmtBucket(ts, range) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (range === '1y') return d.toLocaleDateString([], { month: 'short', year: '2-digit' });
  if (range === '7d' || range === '1m') {
    return d.toLocaleDateString([], { month: 'short', day: '2-digit' });
  }
  if (range === '24h') {
    return d.toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
