import React, { useEffect, useState } from 'react';
import {
  registerApi,
  fetchRegisteredApis,
  deleteRegisteredApi,
  validateRegisteredApi,
} from '../services/api';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const TYPES = ['INTERNAL', 'EXTERNAL'];

export default function ApiManagement() {
  const [endpoint, setEndpoint] = useState('');
  const [method, setMethod] = useState('GET');
  const [apiType, setApiType] = useState('INTERNAL');
  const [threshold, setThreshold] = useState('10');
  const [apis, setApis] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadApis() {
    setLoading(true);
    try {
      const res = await fetchRegisteredApis();
      setApis(res.data || []);
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
        threshold: parseInt(threshold, 10),
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

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">API Management</h1>
        <p className="page-subtitle">Register APIs for monitoring and threshold tracking.</p>
      </div>

      <div className="page-card">
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-label">Endpoint</label>
            <input
              className="form-input"
              type="text"
              placeholder="/api/orders"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label className="form-label">Method</label>
            <select
              className="form-input"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">API Type</label>
            <select
              className="form-input"
              value={apiType}
              onChange={(e) => setApiType(e.target.value)}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Threshold</label>
            <input
              className="form-input"
              type="number"
              min="1"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              required
            />
          </div>
          <div className="form-actions">
            <button className="btn-primary" type="submit">Register API</button>
          </div>
        </form>

        {error && <div className="form-error">{error}</div>}

        <div className="list-header">
          <h2 className="section-title">Registered APIs</h2>
          {loading && <span className="muted">Loading...</span>}
        </div>

        {apis.length === 0 && !loading ? (
          <div className="empty">No registered APIs yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Endpoint</th>
                <th>Method</th>
                <th>Type</th>
                <th>Threshold</th>
                <th>Validation</th>
                <th>Checked</th>
                <th>Active</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {apis.map((api) => (
                <tr key={api.id}>
                  <td style={{ fontFamily: 'monospace' }}>{api.endpoint}</td>
                  <td>{api.method}</td>
                  <td>{api.api_type || 'INTERNAL'}</td>
                  <td>{api.threshold}</td>
                  <td>
                    <span
                      className={`badge ${statusClass(api.validation_status)}`}
                      title={api.validation_message || ''}
                    >
                      {api.validation_status || 'PENDING'}
                    </span>
                  </td>
                  <td>{formatDate(api.last_checked_at)}</td>
                  <td>{api.is_active ? 'Yes' : 'No'}</td>
                  <td>{formatDate(api.created_at)}</td>
                  <td>
                    <button className="btn-success" onClick={() => handleValidate(api.id)}>
                      Validate
                    </button>
                    <button className="btn-danger" onClick={() => handleDelete(api.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString();
}

function statusClass(status) {
  const normalized = String(status || 'PENDING').toUpperCase();
  if (normalized === 'VALID') return 'badge-valid';
  if (normalized === 'INVALID') return 'badge-invalid';
  return 'badge-pending';
}
