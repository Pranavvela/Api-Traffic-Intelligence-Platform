'use strict';

const BASE_URL = process.env.API_URL || 'http://localhost:4000';
const REQUEST_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS || '5000', 10);
const USERS = parseInt(process.env.USERS || '40', 10);
const SUMMARY_INTERVAL_MS = parseInt(process.env.SUMMARY_INTERVAL_MS || '60000', 10);
const ATTACK_INTERVAL_MS = parseInt(process.env.ATTACK_INTERVAL_MS || '300000', 10);

module.exports = {
  BASE_URL,
  REQUEST_TIMEOUT_MS,
  USERS,
  SUMMARY_INTERVAL_MS,
  ATTACK_INTERVAL_MS,
};
