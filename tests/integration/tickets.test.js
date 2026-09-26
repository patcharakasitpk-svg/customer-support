const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const tickets = require('../../src/models/tickets');
const { setup, makeUser, loginAs } = require('../helpers');

function makeTicket(db, customerId, overrides = {}) {
  return tickets.createTicket(db, {
    customerId,
    subject: 'Printer on fire',
    description: 'Smoke everywhere',
    category: 'usage',
    priority: 'high',
    ...overrides,
  });
}

const validForm = { subject: 'Cannot log in', description: 'Wrong password error', category: 'usage', priority: 'high' };

test('anonymous visitors are sent to /login', async () => {
  const { app } = setup();
  await request(app).get('/tickets').expect(302).expect('Location', '/login');
  await request(app).get('/tickets/new').expect(302).expect('Location', '/login');
});

test('a customer creates a ticket and lands on its page', async () => {
  const { app, db } = setup();
  const ann = makeUser(db);
  const agent = await loginAs(app, ann.email);

  await agent.get('/tickets/new').expect(200);
  const res = await agent.post('/tickets/new').type('form').send(validForm).expect(302);
  assert.match(res.headers.location, /^\/tickets\/\d+$/);

  const page = await agent.get(res.headers.location).expect(200);
  assert.match(page.text, /Cannot log in/);
  assert.match(page.text, /ปัญหาการใช้งาน/);
  assert.match(page.text, /เปิด/);
});

test('ticket form validation keeps what was typed', async () => {
  const { app, db } = setup();
  const agent = await loginAs(app, makeUser(db).email);

  const res = await agent
    .post('/tickets/new')
    .type('form')
    .send({ subject: '', description: 'kept text', category: 'bogus', priority: 'low' })
    .expect(400);
  assert.match(res.text, /กรุณากรอกหัวข้อ/);
  assert.match(res.text, /กรุณาเลือกหมวดหมู่/);
  assert.match(res.text, /kept text/);

  const long = await agent.post('/tickets/new').type('form').send({ ...validForm, subject: 'x'.repeat(201) }).expect(400);
  assert.match(long.text, /ไม่เกิน 200 ตัวอักษร/);
});

test('a repeated form field is treated as invalid, not a crash', async () => {
  const { app, db } = setup();
  const agent = await loginAs(app, makeUser(db).email);
  const res = await agent
    .post('/tickets/new')
    .type('form')
    .send('subject=a&subject=b&description=d&category=usage&priority=low')
    .expect(400);
  assert.match(res.text, /กรุณากรอกหัวข้อ/);
});

test('customers see only their own tickets', async () => {
  const { app, db } = setup();
  const ann = makeUser(db);
  const bob = makeUser(db);
  makeTicket(db, ann.id, { subject: 'Ann ticket' });
  const bobTicket = makeTicket(db, bob.id, { subject: 'Bob ticket' });

  const agent = await loginAs(app, ann.email);
  const list = await agent.get('/tickets').expect(200);
  assert.match(list.text, /Ann ticket/);
  assert.doesNotMatch(list.text, /Bob ticket/);

  await agent.get(`/tickets/${bobTicket.id}`).expect(404);
});

test('agents see every ticket and can filter by status', async () => {
  const { app, db } = setup();
  const ann = makeUser(db);
  const staff = makeUser(db, { role: 'agent' });
  makeTicket(db, ann.id, { subject: 'Alpha issue' });
  const beta = makeTicket(db, ann.id, { subject: 'Beta issue' });
  tickets.updateStatus(db, beta.id, 'closed');

  const agent = await loginAs(app, staff.email);
  const all = await agent.get('/tickets').expect(200);
  assert.match(all.text, /Alpha issue/);
  assert.match(all.text, /Beta issue/);

  const closed = await agent.get('/tickets?status=closed').expect(200);
  assert.doesNotMatch(closed.text, /Alpha issue/);
  assert.match(closed.text, /Beta issue/);

  const bogus = await agent.get('/tickets?status=bogus').expect(200);
  assert.match(bogus.text, /Alpha issue/);
  assert.match(bogus.text, /Beta issue/);

  await agent.get(`/tickets/${beta.id}`).expect(200);
});

test('agents cannot open the new-ticket form', async () => {
  const { app, db } = setup();
  const agent = await loginAs(app, makeUser(db, { role: 'agent' }).email);
  await agent.get('/tickets/new').expect(403);
  await agent.post('/tickets/new').type('form').send(validForm).expect(403);
});

test('unknown or non-numeric ticket ids return 404', async () => {
  const { app, db } = setup();
  const agent = await loginAs(app, makeUser(db, { role: 'agent' }).email);
  await agent.get('/tickets/9999').expect(404);
  await agent.get('/tickets/abc').expect(404);
});

test('HTML typed into a ticket is shown as text', async () => {
  const { app, db } = setup();
  const ann = makeUser(db);
  const ticket = makeTicket(db, ann.id, { subject: '<script>alert(1)</script>' });
  const agent = await loginAs(app, ann.email);

  const page = await agent.get(`/tickets/${ticket.id}`).expect(200);
  assert.match(page.text, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(page.text, /<script>alert/);

  const list = await agent.get('/tickets').expect(200);
  assert.doesNotMatch(list.text, /<script>alert/);
});
