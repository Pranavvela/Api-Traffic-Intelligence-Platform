'use strict';

const { query } = require('../config/db');

/**
 * Create a new registered API record.
 * @param {Object} api
 * @returns {Promise<Object>}
 */
async function createRegisteredApi(api) {
  const {
    endpoint,
    method,
    threshold,
    isActive,
    apiType,
    validationStatus,
    lastCheckedAt,
    validationMessage,
  } = api;
  const result = await query(
    `INSERT INTO registered_apis
       (endpoint, method, threshold, is_active, api_type, validation_status, last_checked_at, validation_message)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [endpoint, method, threshold, isActive, apiType, validationStatus, lastCheckedAt, validationMessage]
  );
  return result.rows[0];
}

/**
 * Fetch all registered APIs (newest first).
 * @returns {Promise<Object[]>}
 */
async function listRegisteredApis() {
  const result = await query(
    `SELECT * FROM registered_apis
     ORDER BY created_at DESC`
  );
  return result.rows;
}

/**
 * Fetch a registered API by id.
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
async function getRegisteredApiById(id) {
  const result = await query(
    `SELECT * FROM registered_apis WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Find a registered API by endpoint + method.
 * @param {string} endpoint
 * @param {string} method
 * @returns {Promise<Object|null>}
 */
async function findRegisteredApi(endpoint, method) {
  const result = await query(
    `SELECT * FROM registered_apis WHERE endpoint = $1 AND method = $2 LIMIT 1`,
    [endpoint, method]
  );
  return result.rows[0] || null;
}

/**
 * Update validation status for a registered API.
 * @param {number} id
 * @param {Object} validation
 * @returns {Promise<Object|null>}
 */
async function updateValidation(id, validation = {}) {
  const { status, message, checkedAt } = validation;
  const result = await query(
    `UPDATE registered_apis
     SET validation_status = $2,
         validation_message = $3,
         last_checked_at = $4
     WHERE id = $1
     RETURNING *`,
    [id, status, message, checkedAt]
  );
  return result.rows[0] || null;
}

/**
 * Delete a registered API by id.
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
async function deleteRegisteredApi(id) {
  const result = await query(
    `DELETE FROM registered_apis WHERE id = $1 RETURNING *`,
    [id]
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
};
