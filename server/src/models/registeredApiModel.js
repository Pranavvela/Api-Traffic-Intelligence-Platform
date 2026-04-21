'use strict';

const { query } = require('../config/db');

/**
 * Create a new registered API record.
 * @param {Object} api
 * @returns {Promise<Object>}
 */
async function createRegisteredApi(api) {
  const {
    userId,
    endpoint,
    method,
    threshold,
    isActive,
    apiType,
    validationStatus,
    lastCheckedAt,
    validationMessage,
  } = api;

  if (!userId) {
    throw new Error('userId is required to create a registered API.');
  }

  const result = await query(
    `INSERT INTO registered_apis
       (user_id, endpoint, method, threshold, is_active, api_type, validation_status, last_checked_at, validation_message)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [userId, endpoint, method, threshold, isActive, apiType, validationStatus, lastCheckedAt, validationMessage]
  );
  return result.rows[0];
}

/**
 * Fetch all registered APIs (newest first).
 * @returns {Promise<Object[]>}
 */
async function listRegisteredApis(userId = null) {
  if (!userId) return [];

  let result = await query(
    `SELECT * FROM registered_apis
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );

  if (result.rows.length === 0) {
    const legacyResult = await query(
      `SELECT COUNT(*)::int AS cnt
       FROM registered_apis
       WHERE user_id IS NULL`,
      []
    );

    const legacyCount = Number.parseInt(legacyResult.rows[0]?.cnt || 0, 10);
    if (legacyCount > 0) {
      await query(
        `UPDATE registered_apis
         SET user_id = $1
         WHERE user_id IS NULL`,
        [userId]
      );

      result = await query(
        `SELECT * FROM registered_apis
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
      );
    }
  }

  return result.rows;
}

/**
 * Fetch a registered API by id.
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
async function getRegisteredApiById(id, userId = null) {
  if (!userId) return null;

  const result = await query(
    `SELECT * FROM registered_apis WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return result.rows[0] || null;
}

/**
 * Find a registered API by endpoint + method.
 * @param {string} endpoint
 * @param {string} method
 * @returns {Promise<Object|null>}
 */
async function findRegisteredApi(endpoint, method, userId = null) {
  if (!userId) return null;

  const result = await query(
    `SELECT * FROM registered_apis WHERE endpoint = $1 AND method = $2 AND user_id = $3 LIMIT 1`,
    [endpoint, method, userId]
  );
  return result.rows[0] || null;
}

/**
 * Update validation status for a registered API.
 * @param {number} id
 * @param {Object} validation
 * @returns {Promise<Object|null>}
 */
async function updateValidation(id, validation = {}, userId = null) {
  if (!userId) return null;

  const { status, message, checkedAt } = validation;

  const result = await query(
    `UPDATE registered_apis
     SET validation_status = $2,
         validation_message = $3,
         last_checked_at = $4
     WHERE id = $1 AND user_id = $5
     RETURNING *`,
    [id, status, message, checkedAt, userId]
  );
  return result.rows[0] || null;
}

/**
 * Delete a registered API by id.
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
async function deleteRegisteredApi(id, userId = null) {
  if (!userId) return null;

  const result = await query(
    `DELETE FROM registered_apis WHERE id = $1 AND user_id = $2 RETURNING *`,
    [id, userId]
  );
  return result.rows[0] || null;
}

/**
 * Update a registered API by id.
 * @param {number} id
 * @param {number} userId
 * @param {Object} changes
 * @returns {Promise<Object|null>}
 */
async function updateRegisteredApi(id, userId = null, changes = {}) {
  if (!userId) return null;

  const assignments = [];
  const values = [id, userId];

  if (changes.endpoint !== undefined) {
    values.push(changes.endpoint);
    assignments.push(`endpoint = $${values.length}`);
  }

  if (changes.method !== undefined) {
    values.push(changes.method);
    assignments.push(`method = $${values.length}`);
  }

  if (changes.threshold !== undefined) {
    values.push(changes.threshold);
    assignments.push(`threshold = $${values.length}`);
  }

  if (changes.isActive !== undefined) {
    values.push(changes.isActive);
    assignments.push(`is_active = $${values.length}`);
  }

  if (changes.apiType !== undefined) {
    values.push(changes.apiType);
    assignments.push(`api_type = $${values.length}`);
  }

  if (assignments.length === 0) {
    return getRegisteredApiById(id, userId);
  }

  const result = await query(
    `UPDATE registered_apis
     SET ${assignments.join(', ')}
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    values
  );

  return result.rows[0] || null;
}

module.exports = {
  createRegisteredApi,
  listRegisteredApis,
  deleteRegisteredApi,
  getRegisteredApiById,
  findRegisteredApi,
  updateValidation,
  updateRegisteredApi,
};
