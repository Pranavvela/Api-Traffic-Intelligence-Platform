'use strict';

const { InMemoryKvStore } = require('./inMemoryKvStore');
const { InMemorySetStore } = require('./inMemorySetStore');
const { InMemoryTtlStore } = require('./inMemoryTtlStore');

const DEFAULT_PROVIDER = process.env.STORE_PROVIDER || 'memory';

function resolveProvider(provider) {
  const normalized = String(provider || DEFAULT_PROVIDER).toLowerCase();
  if (normalized === 'redis') return 'redis';
  return 'memory';
}

function createKvStore(provider) {
  const resolved = resolveProvider(provider);
  if (resolved === 'redis') {
    throw new Error('Redis store provider not configured. Use STORE_PROVIDER=memory.');
  }
  return new InMemoryKvStore();
}

function createSetStore(provider) {
  const resolved = resolveProvider(provider);
  if (resolved === 'redis') {
    throw new Error('Redis store provider not configured. Use STORE_PROVIDER=memory.');
  }
  return new InMemorySetStore();
}

function createTtlStore(provider) {
  const resolved = resolveProvider(provider);
  if (resolved === 'redis') {
    throw new Error('Redis store provider not configured. Use STORE_PROVIDER=memory.');
  }
  return new InMemoryTtlStore();
}

module.exports = { createKvStore, createSetStore, createTtlStore, resolveProvider };
