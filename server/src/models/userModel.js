'use strict';

const { query } = require('../config/db');

async function createUser(email, passwordHash) {
  const result = await query(
    `INSERT INTO users (email, password)
     VALUES ($1, $2)
     RETURNING id, email, created_at`,
    [email, passwordHash]
  );
  return result.rows[0] || null;
}

async function findByEmail(email) {
  const result = await query(
    `SELECT id, email, password, created_at
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [email]
  );
  return result.rows[0] || null;
}

async function findById(id) {
  const result = await query(
    `SELECT id, email, created_at
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [id]
  );
  return result.rows[0] || null;
}

async function countUsers() {
  const result = await query('SELECT COUNT(*)::int AS cnt FROM users');
  return Number.parseInt(result.rows[0]?.cnt || 0, 10);
}

module.exports = {
  createUser,
  findByEmail,
  findById,
  countUsers,
};
