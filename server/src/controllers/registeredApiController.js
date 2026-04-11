'use strict';

const {
  createRegisteredApi,
  listRegisteredApis,
  deleteRegisteredApi,
  getRegisteredApiById,
  findRegisteredApi,
  updateValidation,
} = require('../models/registeredApiModel');

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const ALLOWED_API_TYPES = new Set(['INTERNAL', 'EXTERNAL']);

function validateEndpoint(endpoint, apiType) {
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
    return { status: 'VALID', message: 'External endpoint URL looks valid.' };
  }

  return { status: 'VALID', message: 'External endpoint recorded.' };
}

/**
 * POST /api/register
 */
async function registerApi(req, res, next) {
  try {
    const { endpoint, method, threshold, is_active, api_type } = req.body || {};

    if (!endpoint || typeof endpoint !== 'string') {
      return res.status(400).json({ success: false, message: 'endpoint is required.' });
    }

    const normalizedMethod = String(method || '').toUpperCase();
    if (!ALLOWED_METHODS.has(normalizedMethod)) {
      return res.status(400).json({ success: false, message: 'method is invalid.' });
    }

    const parsedThreshold = parseInt(threshold, 10);
    if (!Number.isFinite(parsedThreshold) || parsedThreshold <= 0) {
      return res.status(400).json({ success: false, message: 'threshold must be a positive number.' });
    }

    const apiType = String(api_type || 'INTERNAL').toUpperCase();
    if (!ALLOWED_API_TYPES.has(apiType)) {
      return res.status(400).json({ success: false, message: 'api_type must be INTERNAL or EXTERNAL.' });
    }

    const normalizedEndpoint = endpoint.trim();
    const existing = await findRegisteredApi(normalizedEndpoint, normalizedMethod);
    if (existing) {
      return res.status(409).json({ success: false, message: 'API already registered.' });
    }

    const validation = validateEndpoint(normalizedEndpoint, apiType);
    const checkedAt = new Date().toISOString();

    const created = await createRegisteredApi({
      endpoint: normalizedEndpoint,
      method: normalizedMethod,
      threshold: parsedThreshold,
      isActive: typeof is_active === 'boolean' ? is_active : true,
      apiType,
      validationStatus: validation.status,
      lastCheckedAt: checkedAt,
      validationMessage: validation.message,
    });

    return res.status(201).json({ success: true, data: created });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/list
 */
async function listApis(_req, res, next) {
  try {
    const apis = await listRegisteredApis();
    return res.json({ success: true, count: apis.length, data: apis });
  } catch (err) {
    return next(err);
  }
}

/**
 * DELETE /api/:id
 */
async function removeApi(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, message: 'id is invalid.' });
    }

    const deleted = await deleteRegisteredApi(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'API not found.' });
    }

    return res.json({ success: true, data: deleted });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/validate/:id
 */
async function validateApi(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, message: 'id is invalid.' });
    }

    const api = await getRegisteredApiById(id);
    if (!api) {
      return res.status(404).json({ success: false, message: 'API not found.' });
    }

    const validation = validateEndpoint(api.endpoint || '', String(api.api_type || 'INTERNAL').toUpperCase());
    const updated = await updateValidation(id, {
      status: validation.status,
      message: validation.message,
      checkedAt: new Date().toISOString(),
    });

    return res.json({ success: true, data: updated });
  } catch (err) {
    return next(err);
  }
}

module.exports = { registerApi, listApis, removeApi, validateApi };
