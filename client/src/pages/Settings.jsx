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
      if (res.data) {
        setForm(res.data);
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
      if (res.data) {
        setForm(res.data);
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
      setMessage(res.message || 'All alerts cleared.');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to clear alerts.');
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Configure detection thresholds and mitigation behavior.</p>
      </div>

      <div className="page-card">
        <form className="form-grid settings-grid" onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-label">Rate Limit Threshold</label>
            <input
              className="form-input"
              type="number"
              min="1"
              value={form.rateLimitThreshold}
              onChange={(e) => updateField('rateLimitThreshold', e.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label className="form-label">Brute Force Threshold</label>
            <input
              className="form-input"
              type="number"
              min="1"
              value={form.bruteForceThreshold}
              onChange={(e) => updateField('bruteForceThreshold', e.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label className="form-label">Endpoint Flood Threshold</label>
            <input
              className="form-input"
              type="number"
              min="1"
              value={form.endpointFloodThreshold}
              onChange={(e) => updateField('endpointFloodThreshold', e.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label className="form-label">Burst Multiplier</label>
            <input
              className="form-input"
              type="number"
              step="0.1"
              min="0.1"
              value={form.burstMultiplier}
              onChange={(e) => updateField('burstMultiplier', e.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label className="form-label">Sliding Window (seconds)</label>
            <input
              className="form-input"
              type="number"
              min="10"
              value={form.slidingWindowSeconds}
              onChange={(e) => updateField('slidingWindowSeconds', e.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label className="form-label">Throttle Duration (minutes)</label>
            <input
              className="form-input"
              type="number"
              min="1"
              value={form.throttleDurationMinutes}
              onChange={(e) => updateField('throttleDurationMinutes', e.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label className="form-label">Auto Block Enabled</label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={Boolean(form.autoBlockEnabled)}
                onChange={(e) => updateField('autoBlockEnabled', e.target.checked)}
              />
              <span className="toggle-slider" />
              <span className="toggle-label">
                {form.autoBlockEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </label>
          </div>
          <div className="form-actions">
            <button className="btn-primary" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>

        {loading && <div className="muted">Loading settings...</div>}
        {message && <div className="form-success">{message}</div>}
        {error && <div className="form-error">{error}</div>}
      </div>

      <div className="page-card" style={{ marginTop: 16 }}>
        <h2 className="section-title">Danger Zone</h2>
        <p className="page-subtitle" style={{ marginBottom: 12 }}>
          Clear all alerts and reset the threat timeline.
        </p>
        <button className="btn-danger" type="button" onClick={handleResetAlerts} disabled={resetting}>
          {resetting ? 'Clearing...' : 'Reset Alerts'}
        </button>
      </div>
    </div>
  );
}
