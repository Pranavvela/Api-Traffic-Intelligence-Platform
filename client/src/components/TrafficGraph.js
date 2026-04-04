import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

/**
 * TrafficGraph — displays requests per minute for the last 5 minutes.
 * @param {Object[]} data  [{minute: string, request_count: number}]
 */
export default function TrafficGraph({ data }) {
  // Format minute label to HH:MM
  const formatted = (data || []).map((d) => ({
    ...d,
    label: fmtMinute(d.minute),
    count: Number.parseInt(d.request_count, 10),
  }));

  return (
    <div className="panel traffic-graph-panel">
      <div className="panel-header">
        <span className="panel-title">Request Rate (last 5 min)</span>
        <span className="panel-count">per minute</span>
      </div>
      <div className="panel-body" style={{ padding: '16px 8px 8px', minHeight: 180 }}>
        {formatted.length === 0 ? (
          <div className="empty">No traffic data yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={formatted} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="label"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={{ stroke: '#334155' }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={{ stroke: '#334155' }}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: '#1e293b',
                  border: '1px solid #334155',
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
                stroke="#38bdf8"
                strokeWidth={2}
                dot={{ fill: '#38bdf8', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function fmtMinute(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
