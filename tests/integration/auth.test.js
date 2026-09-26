const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const users = require('../src/models/users');
const { setup, makeUser, loginAs } = require('./helpers');

test('GET / sends anonymous visitors to /login', async () => {
  const { app } = setup();
  await request(app).get('/').expect(302).expect('Location', '/login');
});

test('login and register pages render', async () => {
  const { app } = setup();
  const login = await request(app).get('/login').expect(200);
  assert.match(login.text, /เข้าสู่ระบบ/);
  const register = await request(app).get('/register').expect(200);
  assert.match(register.text, /สมัครสมาชิก/);
});

test('register creates a customer and logs them in', async () => {
  const { app, db } = setup();
  const agent = request.agent(app);
  await agent
    .post('/register')
    .type('form')
    .send({ name: 'Ann', email: 'ann@example.com', password: 'password123', role: 'agent' })
    .expect(302)
    .expect('Location', '/tickets');

  assert.equal(users.findByEmail(db, 'ann@example.com').role, 'customer');
  await agent.get('/').expect(302).expect('Location', '/tickets');
});

test('register shows validation errors and keeps what was typed', async () => {
  const { app } = setup();
  const res = await request(app)
    .post('/register')
    .type('form')
    .send({ name: '', email: 'not-an-email', password: 'short' })
    .expect(400);

  assert.match(res.text, /กรุณากรอกชื่อ/);
  assert.match(res.text, /รูปแบบอีเมลไม่ถูกต้อง/);
  assert.match(res.text, /อย่างน้อย 8 ตัวอักษร/);
  assert.match(res.text, /value="not-an-email"/);
});

test('register rejects an email that differs only by case or spaces', async () => {
  const { app, db } = setup();
  makeUser(db, { email: 'ann@example.com' });
  const res = await request(app)
    .post('/register')
    .type('form')
    .send({ name: 'Ann', email: '  ANN@Example.com ', password: 'password123' })
    .expect(400);
  assert.match(res.text, /อีเมลนี้ถูกใช้แล้ว/);
});

test('login accepts the email in any case', async () => {
  const { app, db } = setup();
  makeUser(db, { email: 'ann@example.com' });
  const agent = await loginAs(app, ' Ann@Example.COM');
  await agent.get('/').expect(302).expect('Location', '/tickets');
});

test('wrong password shows a generic error', async () => {
  const { app, db } = setup();
  makeUser(db, { email: 'ann@example.com' });
  const res = await request(app)
    .post('/login')
    .type('form')
    .send({ email: 'ann@example.com', password: 'wrong-password' })
    .expect(400);
  assert.match(res.text, /อีเมลหรือรหัสผ่านไม่ถูกต้อง/);
});

test('logout ends the session', async () => {
  const { app, db } = setup();
  const user = makeUser(db);
  const agent = await loginAs(app, user.email);
  await agent.post('/logout').expect(302).expect('Location', '/login');
  await agent.get('/').expect(302).expect('Location', '/login');
});

test('logged-in users are sent away from the login page', async () => {
  const { app, db } = setup();
  const user = makeUser(db);
  const agent = await loginAs(app, user.email);
  await agent.get('/login').expect(302).expect('Location', '/tickets');
});

test('unknown pages return 404', async () => {
  const { app } = setup();
  const res = await request(app).get('/nope').expect(404);
  assert.match(res.text, /ไม่พบหน้า/);
});
