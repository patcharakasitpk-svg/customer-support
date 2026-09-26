const bcrypt = require('bcrypt');

const BCRYPT_COST = 10;

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function findById(db, id) {
  return db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(id);
}

function findByEmail(db, email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(normalizeEmail(email));
}

function createUser(db, { name, email, password, role = 'customer' }) {
  const passwordHash = bcrypt.hashSync(password, BCRYPT_COST);
  const info = db
    .prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(name, normalizeEmail(email), passwordHash, role);
  return findById(db, info.lastInsertRowid);
}

function authenticate(db, email, password) {
  const row = findByEmail(db, email);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) return null;
  return findById(db, row.id);
}

module.exports = { normalizeEmail, findById, findByEmail, createUser, authenticate };
