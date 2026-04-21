'use strict';

class InMemoryKvStore {
  constructor() {
    this.store = new Map();
  }

  get(key) {
    return this.store.get(key);
  }

  set(key, value) {
    this.store.set(key, value);
  }

  delete(key) {
    return this.store.delete(key);
  }

  has(key) {
    return this.store.has(key);
  }

  keys() {
    return Array.from(this.store.keys());
  }
}

module.exports = { InMemoryKvStore };
