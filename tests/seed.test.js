const test = require('node:test');
const assert = require('node:assert/strict');
const { openDb } = require('../src/db');
const users = require('../src/models/users');
const { seed } = require('../scripts/seed');

function count(db, table) {
  return db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
}

test('seed creates demo accounts and tickets, and is safe to run twice', () => {
  const db = openDb(':memory:');
  seed(db);
  seed(db);

  assert.equal(count(db, 'users'), 2);
  assert.equal(count(db, 'tickets'), 2);
  assert.equal(count(db, 'replies'), 1);
  assert.equal(users.authenticate(db, 'agent@example.com', 'password123').role, 'agent');
  assert.equal(users.authenticate(db, 'customer@example.com', 'password123').role, 'customer');
});
