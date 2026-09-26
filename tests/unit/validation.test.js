const test = require('node:test');
const assert = require('node:assert/strict');
const { validateRegistration, validateLogin, validateTicket } = require('../../src/validation');

const validUser = { name: 'Ann', email: 'ann@example.com', password: 'password123' };
const validTicket = { subject: 'Cannot log in', description: 'Details', category: 'usage', priority: 'high' };

test('validateRegistration accepts a complete form', () => {
  assert.deepEqual(validateRegistration(validUser), []);
});

test('validateRegistration requires a name', () => {
  assert.deepEqual(validateRegistration({ ...validUser, name: '' }), ['กรุณากรอกชื่อ']);
});

test('validateRegistration rejects malformed emails', () => {
  for (const email of ['', 'ann', 'ann@example', '@example.com', 'ann smith@example.com']) {
    assert.deepEqual(validateRegistration({ ...validUser, email }), ['รูปแบบอีเมลไม่ถูกต้อง'], email);
  }
});

test('validateRegistration needs a password of at least 8 characters', () => {
  assert.deepEqual(validateRegistration({ ...validUser, password: '1234567' }), [
    'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร',
  ]);
  assert.deepEqual(validateRegistration({ ...validUser, password: '12345678' }), []);
});

test('validateRegistration reports every problem at once, in form order', () => {
  assert.deepEqual(validateRegistration({ name: '', email: 'x', password: '' }), [
    'กรุณากรอกชื่อ',
    'รูปแบบอีเมลไม่ถูกต้อง',
    'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร',
  ]);
});

test('validateLogin accepts a filled-in form', () => {
  assert.deepEqual(validateLogin({ email: 'ann@example.com', password: 'x' }), []);
});

test('validateLogin requires both email and password', () => {
  for (const values of [
    { email: '', password: 'password123' },
    { email: 'ann@example.com', password: '' },
    { email: '', password: '' },
  ]) {
    assert.deepEqual(validateLogin(values), ['กรุณากรอกอีเมลและรหัสผ่าน'], JSON.stringify(values));
  }
});

test('validateTicket accepts a complete form', () => {
  assert.deepEqual(validateTicket(validTicket), []);
});

test('validateTicket limits the subject to 1-200 characters', () => {
  assert.deepEqual(validateTicket({ ...validTicket, subject: '' }), ['กรุณากรอกหัวข้อ']);
  assert.deepEqual(validateTicket({ ...validTicket, subject: 'ก'.repeat(200) }), []);
  assert.deepEqual(validateTicket({ ...validTicket, subject: 'ก'.repeat(201) }), [
    'หัวข้อต้องยาวไม่เกิน 200 ตัวอักษร',
  ]);
});

test('validateTicket requires a description', () => {
  assert.deepEqual(validateTicket({ ...validTicket, description: '' }), ['กรุณากรอกรายละเอียด']);
});

test('validateTicket only allows known categories and priorities', () => {
  assert.deepEqual(validateTicket({ ...validTicket, category: 'sales' }), ['กรุณาเลือกหมวดหมู่']);
  assert.deepEqual(validateTicket({ ...validTicket, priority: 'urgent' }), ['กรุณาเลือกความเร่งด่วน']);
  for (const category of ['usage', 'billing', 'other']) {
    assert.deepEqual(validateTicket({ ...validTicket, category }), [], category);
  }
  for (const priority of ['low', 'medium', 'high']) {
    assert.deepEqual(validateTicket({ ...validTicket, priority }), [], priority);
  }
});
