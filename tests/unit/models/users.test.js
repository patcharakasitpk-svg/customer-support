const test = require('node:test');
const assert = require('node:assert/strict');
const { openDb } = require('../../../src/db');
const users = require('../../../src/models/users');

const ann = { name: 'Ann', email: 'ann@example.com', password: 'secret123' };

test('normalizeEmail trims and lowercases, and treats non-strings as empty', () => {
  assert.equal(users.normalizeEmail('  Ann@Example.COM '), 'ann@example.com');
  assert.equal(users.normalizeEmail(undefined), '');
  assert.equal(users.normalizeEmail(['a@b.co']), '');
});

test('createUser returns the user without the password hash and defaults to customer', () => {
  const db = openDb(':memory:');
  const user = users.createUser(db, { ...ann, email: ' Ann@Example.COM ' });
  assert.deepEqual(Object.keys(user).sort(), ['created_at', 'email', 'id', 'name', 'role']);
  assert.equal(user.email, 'ann@example.com');
  assert.equal(user.role, 'customer');
});

test('createUser stores a bcrypt hash, never the plain password', () => {
  const db = openDb(':memory:');
  users.createUser(db, ann);
  const row = users.findByEmail(db, ann.email);
  assert.notEqual(row.password_hash, ann.password);
  assert.match(row.password_hash, /^\$2[aby]\$10\$/);
});

test('createUser rejects a duplicate email, ignoring case', () => {
  const db = openDb(':memory:');
  users.createUser(db, ann);
  assert.throws(() => users.createUser(db, { ...ann, email: 'ANN@example.com' }), /UNIQUE/);
});

test('createUser rejects an unknown role', () => {
  const db = openDb(':memory:');
  assert.throws(() => users.createUser(db, { ...ann, role: 'admin' }), /CHECK/);
});

test('findById and findByEmail return undefined for missing users', () => {
  const db = openDb(':memory:');
  assert.equal(users.findById(db, 42), undefined);
  assert.equal(users.findByEmail(db, 'nobody@example.com'), undefined);
});

test('authenticate returns the user only for the right password', () => {
  const db = openDb(':memory:');
  const user = users.createUser(db, ann);
  assert.equal(users.authenticate(db, 'ANN@example.com', 'secret123').id, user.id);
  assert.equal(users.authenticate(db, ann.email, 'secret124'), null);
  assert.equal(users.authenticate(db, ann.email, ''), null);
  assert.equal(users.authenticate(db, 'nobody@example.com', 'secret123'), null);
});
