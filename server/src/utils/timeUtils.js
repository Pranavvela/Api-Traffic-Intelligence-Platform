'use strict';

/**
 * Returns the current Unix timestamp in milliseconds.
 * @returns {number}
 */
function nowMs() {
  return Date.now();
}

/**
 * Returns the UTC ISO string for a given ms timestamp (or now).
 * @param {number} [ms]
 * @returns {string}
 */
function toISOString(ms) {
  return new Date(ms || Date.now()).toISOString();
}

/**
 * Returns the lower boundary timestamp (ms) for a sliding window.
 * @param {number} windowSizeMs  Window duration in milliseconds
 * @returns {number}
 */
function windowStart(windowSizeMs) {
  return Date.now() - windowSizeMs;
}

/**
 * Formats elapsed milliseconds as a human-readable string.
 * @param {number} ms
 * @returns {string}
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}

module.exports = { nowMs, toISOString, windowStart, formatDuration };
