import React, { useEffect, useState } from 'react';
import { fetchSettings, updateSettings, resetAlerts } from '../services/api';

export default function Settings() {
  const [form, setForm] = useState({
    rateLimitThreshold: 10,
    bruteForceThreshold: 5,
    endpointFloodThreshold: 15,
    burstMultiplier: 3,
    slidingWindowSeconds: 60,
    throttleDurationMinutes: 5,
    autoBlockEnabled: true,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadSettings() {
    setLoading(true);
    try {
      const res = await fetchSettings();
      if (res) {
        setForm(res);
      }
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load settings.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const payload = {
        rateLimitThreshold: Number(form.rateLimitThreshold),
        bruteForceThreshold: Number(form.bruteForceThreshold),
        endpointFloodThreshold: Number(form.endpointFloodThreshold),
        burstMultiplier: Number(form.burstMultiplier),
        slidingWindowSeconds: Number(form.slidingWindowSeconds),
        throttleDurationMinutes: Number(form.throttleDurationMinutes),
        autoBlockEnabled: Boolean(form.autoBlockEnabled),
      };
      const res = await updateSettings(payload);
      if (res) {
        setForm(res);
      }
      setMessage('Settings updated successfully.');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }

  async function handleResetAlerts() {
    const confirmed = window.confirm(
      'This will permanently delete all alerts and clear the threat timeline. Continue?'
    );
    if (!confirmed) return;

    setResetting(true);
    setMessage('');
    setError('');
    try {
      const res = await resetAlerts();
      setMessage(res?.data?.message || res?.message || 'All alerts cleared.');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to clear alerts.');
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.3em] text-sky-300/80">Settings</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">Detection Controls</h1>
        <p className="mt-2 text-sm text-slate-300">Tune thresholds and mitigation behavior.</p>
      </div>

      <section className="glass-panel rounded-2xl p-6">
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" onSubmit={handleSubmit}>
          {[
            ['Rate Limit Threshold', 'rateLimitThreshold'],
            ['Brute Force Threshold', 'bruteForceThreshold'],
            ['Endpoint Flood Threshold', 'endpointFloodThreshold'],
            ['Burst Multiplier', 'burstMultiplier', '0.1'],
            ['Sliding Window (seconds)', 'slidingWindowSeconds'],
            ['Throttle Duration (minutes)', 'throttleDurationMinutes'],
          ].map(([label, key, step]) => (
            <div key={key} className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</label>
              <input
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white focus:border-sky-400 focus:outline-none"
                type="number"
                min="1"
                step={step || '1'}
                value={form[key]}
                onChange={(e) => updateField(key, e.target.value)}
                required
              />
            </div>
          ))}

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Auto Block Enabled</label>
            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={Boolean(form.autoBlockEnabled)}
                onChange={(e) => updateField('autoBlockEnabled', e.target.checked)}
                className="h-4 w-4 accent-sky-400"
              />
              {form.autoBlockEnabled ? 'Enabled' : 'Disabled'}
            </label>
          </div>

          <div className="md:col-span-2 xl:col-span-3">
            <button className="rounded-xl bg-sky-500/90 px-5 py-2 text-sm font-semibold text-white shadow-glow transition-all hover:-translate-y-[1px]" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>

        {loading && <div className="mt-3 text-xs text-slate-400">Loading settings...</div>}
        {message && <div className="mt-3 text-sm text-emerald-300">{message}</div>}
        {error && <div className="mt-3 text-sm text-rose-300">{error}</div>}
      </section>

      <section className="glass-panel rounded-2xl p-6">
        <div className="text-lg font-semibold text-white">Danger Zone</div>
        <p className="mt-2 text-sm text-slate-400">Clear all alerts and reset the threat timeline.</p>
        <button
          className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/20 px-5 py-2 text-sm font-semibold text-rose-200 transition-all hover:-translate-y-[1px]"
          type="button"
          onClick={handleResetAlerts}
          disabled={resetting}
        >
          {resetting ? 'Clearing...' : 'Reset Alerts'}
        </button>
      </section>
    </div>
  );
}
