// mlModelRepository.js - Repository for saving and loading trained ML models (e.g. Z-Score engine state) to/from the database.
'use strict';

const { query } = require('../config/db');
const logger = require('../utils/logger');

function mapModelRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    model_data: row.model_data,
    engine: row.engine,
    model_version: row.model_version,
    is_active: row.is_active,
    created_at: row.created_at,
  };
}

async function getNextModelVersion(engine = 'zscore') {
  const result = await query(
    `SELECT COALESCE(MAX(model_version), 0) + 1 AS next_version
     FROM ml_model
     WHERE engine = $1`,
    [engine]
  );

  return Number.parseInt(result.rows[0]?.next_version || 1, 10);
}

/**
 * Save a trained ML model to the database.
 * Inserts a new row with the full model state (does NOT overwrite).
 * Always keeps the latest model (by created_at DESC).
 *
 * @param {Object} modelData - The model state object (means, stds, features, threshold, etc.)
 * @param {string} engine    - Engine name (default: 'zscore')
 * @returns {Promise<Object>} - Inserted row
 */
async function saveModel(modelData, engine = 'zscore') {
  try {
    const nextVersion = await getNextModelVersion(engine);

    await query(
      `UPDATE ml_model
       SET is_active = FALSE
       WHERE engine = $1`,
      [engine]
    );

    const result = await query(
      `INSERT INTO ml_model (model_data, engine, model_version, is_active, created_at)
       VALUES ($1, $2, $3, TRUE, NOW())
       RETURNING id, model_data, engine, model_version, is_active, created_at;`,
      [JSON.stringify(modelData), engine, nextVersion]
    );
    return mapModelRow(result.rows[0]);
  } catch (err) {
    logger.error('Error saving ML model', { error: err.message });
    throw err;
  }
}

/**
 * Load the latest trained ML model from the database.
 *
 * @param {string} engine - Engine name to filter by (default: 'zscore')
 * @returns {Promise<Object|null>} - Latest model data object or null if no model found
 */
async function loadLatestModel(engine = 'zscore') {
  try {
    const result = await query(
      `SELECT id, model_data, engine, model_version, is_active, created_at FROM ml_model
       WHERE engine = $1
       ORDER BY is_active DESC, created_at DESC, id DESC
       LIMIT 1;`,
      [engine]
    );
    
    if (result.rows.length === 0) {
      return null;
    }

    return mapModelRow(result.rows[0]);
  } catch (err) {
    logger.error('Error loading latest ML model', { error: err.message });
    throw err;
  }
}

async function getModelById(id, engine = 'zscore') {
  const result = await query(
    `SELECT id, model_data, engine, model_version, is_active, created_at
     FROM ml_model
     WHERE id = $1 AND engine = $2
     LIMIT 1;`,
    [id, engine]
  );

  return mapModelRow(result.rows[0] || null);
}

/**
 * Get the timestamp when the model was last trained.
 *
 * @param {string} engine - Engine name to filter by (default: 'zscore')
 * @returns {Promise<Date|null>} - Created timestamp or null if no model
 */
async function getLatestModelTimestamp(engine = 'zscore') {
  try {
    const result = await query(
      `SELECT created_at FROM ml_model
       WHERE engine = $1
       ORDER BY created_at DESC
       LIMIT 1;`,
      [engine]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0].created_at;
  } catch (err) {
    logger.error('Error getting ML model timestamp', { error: err.message });
    throw err;
  }
}

/**
 * Delete old models, keeping only the N most recent.
 * Useful for cleanup to prevent database bloat.
 *
 * @param {number} keepCount - Number of recent models to keep (default: 5)
 * @param {string} engine    - Engine name to filter by (default: 'zscore')
 * @returns {Promise<number>} - Number of rows deleted
 */
async function pruneOldModels(keepCount = 5, engine = 'zscore') {
  try {
    const result = await query(
      `DELETE FROM ml_model
       WHERE id NOT IN (
         SELECT id FROM ml_model
         WHERE engine = $1
         ORDER BY created_at DESC
         LIMIT $2
       )
       AND engine = $1;`,
      [engine, keepCount]
    );
    return result.rowCount;
  } catch (err) {
    logger.error('Error pruning ML models', { error: err.message });
    throw err;
  }
}

/**
 * Get all saved models for a given engine (for debugging/audit).
 *
 * @param {string} engine - Engine name (default: 'zscore')
 * @returns {Promise<Array>} - Array of { id, created_at, model_data }
 */
async function getAllModels(engine = 'zscore') {
  try {
    const result = await query(
      `SELECT id, created_at, engine, model_version, is_active, model_data FROM ml_model
       WHERE engine = $1
       ORDER BY model_version DESC, created_at DESC, id DESC;`,
      [engine]
    );
    return result.rows.map(mapModelRow);
  } catch (err) {
    logger.error('Error fetching ML models', { error: err.message });
    throw err;
  }
}

async function activateModel(id, engine = 'zscore') {
  try {
    const target = await getModelById(id, engine);
    if (!target) return null;

    await query(
      `UPDATE ml_model
       SET is_active = FALSE
       WHERE engine = $1`,
      [engine]
    );

    const result = await query(
      `UPDATE ml_model
       SET is_active = TRUE
       WHERE id = $1 AND engine = $2
       RETURNING id, model_data, engine, model_version, is_active, created_at;`,
      [id, engine]
    );

    return mapModelRow(result.rows[0] || null);
  } catch (err) {
    logger.error('Error activating ML model', { error: err.message });
    throw err;
  }
}

module.exports = {
  saveModel,
  loadLatestModel,
  getModelById,
  getLatestModelTimestamp,
  pruneOldModels,
  getAllModels,
  activateModel,
  getNextModelVersion,
};
