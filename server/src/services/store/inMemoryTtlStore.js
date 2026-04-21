'use strict';

class InMemoryTtlStore {
  constructor() {
    this.store = new Map();
  }

  set(key, value, ttlMs) {
    const expiresAt = ttlMs ? Date.now() + ttlMs : null;
    this.store.set(key, { value, expiresAt });
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  has(key) {
    return this.get(key) !== undefined;
  }

  delete(key) {
    return this.store.delete(key);
  }

  keys() {
    return Array.from(this.store.keys());
  }
}

module.exports = { InMemoryTtlStore };
