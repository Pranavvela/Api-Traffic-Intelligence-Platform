'use strict';

class InMemorySetStore {
  constructor() {
    this.store = new Set();
  }

  add(value) {
    this.store.add(value);
  }

  has(value) {
    return this.store.has(value);
  }

  delete(value) {
    return this.store.delete(value);
  }

  values() {
    return Array.from(this.store.values());
  }

  size() {
    return this.store.size;
  }
}

module.exports = { InMemorySetStore };
