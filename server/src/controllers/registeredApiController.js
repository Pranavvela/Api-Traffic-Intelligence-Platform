'use strict';

const axios = require('axios');

const {
  createRegisteredApi,
  listRegisteredApis,
  deleteRegisteredApi,
  getRegisteredApiById,
  findRegisteredApi,
  updateValidation,
  updateRegisteredApi,
} = require('../models/registeredApiModel');
const {
  upsertRuntimeApiPolicy,
  removeRuntimeApiPolicy,
  getRuntimeApiPolicy,
} = require('../services/proxyService');

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const ALLOWED_API_TYPES = new Set(['INTERNAL', 'EXTERNAL']);

/**
 * Basic format validation (light check only)
 */
function validateEndpointFormat(endpoint, apiType) {
  const trimmed = endpoint.trim();

  if (/\s/.test(trimmed)) {
    return { status: 'INVALID', message: 'Endpoint must not include whitespace.' };
  }

  if (apiType === 'INTERNAL') {
    if (!trimmed.startsWith('/')) {
      return { status: 'INVALID', message: 'Internal endpoints must start with "/".' };
    }
    return { status: 'VALID', message: 'Internal endpoint format looks valid.' };
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return { status: 'VALID', message: 'External endpoint format looks valid.' };
  }

  return { status: 'VALID', message: 'Endpoint recorded.' };
}

function normalizeRegisteredApiPatch(body = {}) {
  const {
    endpoint,
    method,
    threshold,
    api_type,
    is_active,
    monitoring_enabled,
    sensitivity_level,
    rate_limit_override,
  } = body;

  const changes = {};

  if (endpoint !== undefined) {
    if (!endpoint || typeof endpoint !== 'string' || !endpoint.trim()) {
      return { error: 'endpoint must be a non-empty string.' };
    }
    changes.endpoint = endpoint.trim();
  }

  if (method !== undefined) {
    const normalizedMethod = String(method).toUpperCase();
    if (!ALLOWED_METHODS.has(normalizedMethod)) {
      return { error: 'method is invalid.' };
    }
    changes.method = normalizedMethod;
  }

  if (threshold !== undefined) {
    const parsedThreshold = Number.parseInt(threshold, 10);
    if (!Number.isFinite(parsedThreshold) || parsedThreshold <= 0) {
      return { error: 'threshold must be a positive number.' };
    }
    changes.threshold = parsedThreshold;
  }

  if (api_type !== undefined) {
    const normalizedType = String(api_type).toUpperCase();
    if (!ALLOWED_API_TYPES.has(normalizedType)) {
      return { error: 'api_type must be INTERNAL or EXTERNAL.' };
    }
    changes.apiType = normalizedType;
  }

  if (is_active !== undefined) {
    changes.isActive = Boolean(is_active);
  }

  const hasMonitoringEnabled = monitoring_enabled != null;
  const hasRateLimitOverride = rate_limit_override != null;
  const runtimeUpdates = {
    enabled: hasMonitoringEnabled || sensitivity_level !== undefined || hasRateLimitOverride,
    payload: {
      sensitivityLevel: sensitivity_level,
      monitoringEnabled: hasMonitoringEnabled ? Boolean(monitoring_enabled) : undefined,
      rateLimitOverride: hasRateLimitOverride ? Number(rate_limit_override) : undefined,
    },
  };

  return { changes, runtimeUpdates, sensitivityLevel: sensitivity_level };
}

/**
 * POST /api/register
 */
async function registerApi(req, res, next) {
  try {
    const {
      endpoint,
      method,
      threshold,
      is_active,
      api_type,
      sensitivity_level,
      rate_limit_override,
      monitoring_enabled,
    } = req.body || {};

    if (!endpoint || typeof endpoint !== 'string') {
      return res.status(400).json({ success: false, message: 'endpoint is required.' });
    }

    const normalizedMethod = String(method || '').toUpperCase();
    if (!ALLOWED_METHODS.has(normalizedMethod)) {
      return res.status(400).json({ success: false, message: 'method is invalid.' });
    }

    const parsedThreshold = Number.parseInt(threshold, 10);
    if (!Number.isFinite(parsedThreshold) || parsedThreshold <= 0) {
      return res.status(400).json({ success: false, message: 'threshold must be a positive number.' });
    }

    const apiType = String(api_type || 'INTERNAL').toUpperCase();
    if (!ALLOWED_API_TYPES.has(apiType)) {
      return res.status(400).json({ success: false, message: 'api_type must be INTERNAL or EXTERNAL.' });
    }

    const normalizedEndpoint = endpoint.trim();

    const userId = req.user?.id || null;
    const existing = await findRegisteredApi(normalizedEndpoint, normalizedMethod, userId);
    if (existing) {
      return res.status(409).json({ success: false, message: 'API already registered.' });
    }

    const validation = validateEndpointFormat(normalizedEndpoint, apiType);

    const created = await createRegisteredApi({
      userId,
      endpoint: normalizedEndpoint,
      method: normalizedMethod,
      threshold: parsedThreshold,
      isActive: typeof is_active === 'boolean' ? is_active : true,
      apiType,
      validationStatus: validation.status,
      lastCheckedAt: new Date().toISOString(),
      validationMessage: validation.message,
    });

    const hasRateLimitOverride = rate_limit_override != null;
    const hasMonitoringEnabled = monitoring_enabled != null;

    upsertRuntimeApiPolicy(userId, normalizedEndpoint, normalizedMethod, {
      sensitivityLevel: sensitivity_level || 'MEDIUM',
      rateLimitOverride: hasRateLimitOverride ? Number(rate_limit_override) : undefined,
      monitoringEnabled: hasMonitoringEnabled ? Boolean(monitoring_enabled) : true,
    });

    return res.status(201).json({
      success: true,
      data: {
        ...created,
        sensitivity_level: sensitivity_level || 'MEDIUM',
        rate_limit_override: hasRateLimitOverride ? Number(rate_limit_override) : null,
        monitoring_enabled: hasMonitoringEnabled ? Boolean(monitoring_enabled) : true,
      },
    });

  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/list
 */
async function listApis(req, res, next) {
  try {
    const userId = req.user?.id || null;
    const apis = await listRegisteredApis(userId);
    const enriched = apis.map((api) => {
      const runtime = getRuntimeApiPolicy(userId, api.endpoint, api.method);
      return {
        ...api,
        sensitivity_level: runtime?.sensitivityLevel || 'MEDIUM',
        rate_limit_override: runtime?.rateLimitOverride ?? null,
        monitoring_enabled: runtime?.monitoringEnabled ?? Boolean(api.is_active),
      };
    });

    return res.json({ success: true, count: enriched.length, data: enriched });
  } catch (err) {
    return next(err);
  }
}

/**
 * DELETE /api/:id
 */
async function removeApi(req, res, next) {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, message: 'id is invalid.' });
    }

    const deleted = await deleteRegisteredApi(id, req.user?.id || null);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'API not found.' });
    }

    removeRuntimeApiPolicy(req.user?.id || null, deleted.endpoint, deleted.method);

    return res.json({ success: true, data: deleted });

  } catch (err) {
    return next(err);
  }
}

/**
 * 🔥 REAL VALIDATION (FIXED)
 * POST /api/validate/:id
 */
async function validateApi(req, res, next) {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, message: 'id is invalid.' });
    }

    const api = await getRegisteredApiById(id, req.user?.id || null);
    if (!api) {
      return res.status(404).json({ success: false, message: 'API not found.' });
    }

    let status = 'INVALID';
    let message = 'Failed to reach endpoint';

    try {
      const response = await axios({
        method: api.method || 'GET',
        url: api.endpoint, // THIS now works with proxy URLs
        timeout: 5000,
        validateStatus: () => true, // don't throw on 4xx/5xx
      });

      if (response.status < 500) {
        status = 'VALID';
        message = `Reachable (status ${response.status})`;
      } else {
        message = `Server error (${response.status})`;
      }

    } catch (err) {
      message = err.message;
    }

    const updated = await updateValidation(id, {
      status,
      message,
      checkedAt: new Date().toISOString(),
    }, req.user?.id || null);

    return res.json({ success: true, data: updated });

  } catch (err) {
    return next(err);
  }
}

/**
 * PATCH /api/:id
 */
async function updateApi(req, res, next) {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, message: 'id is invalid.' });
    }

    const userId = req.user?.id || null;
    const existing = await getRegisteredApiById(id, userId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'API not found.' });
    }

    const patch = normalizeRegisteredApiPatch(req.body || {});
    if (patch.error) {
      return res.status(400).json({ success: false, message: patch.error });
    }

    const updated = await updateRegisteredApi(id, userId, patch.changes);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'API not found.' });
    }

    const nextEndpoint = updated.endpoint;
    const nextMethod = updated.method;
    if (patch.runtimeUpdates.enabled) {
      upsertRuntimeApiPolicy(userId, nextEndpoint, nextMethod, patch.runtimeUpdates.payload);
    }

    const runtime = getRuntimeApiPolicy(userId, nextEndpoint, nextMethod);

    return res.json({
      success: true,
      data: {
        ...updated,
        sensitivity_level: runtime?.sensitivityLevel || patch.sensitivityLevel || 'MEDIUM',
        rate_limit_override: runtime?.rateLimitOverride ?? null,
        monitoring_enabled: runtime?.monitoringEnabled ?? Boolean(updated.is_active),
      },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  registerApi,
  listApis,
  removeApi,
  validateApi,
  updateApi,
};