const test = require('node:test');
const assert = require('node:assert/strict');
const tickets = require('../../src/models/tickets');
const replies = require('../../src/models/replies');
const { setup, makeUser, loginAs } = require('../helpers');

function scenario() {
  const { app, db } = setup();
  const ann = makeUser(db, { name: 'Ann' });
  const staff = makeUser(db, { name: 'Staff', role: 'agent' });
  const ticket = tickets.createTicket(db, {
    customerId: ann.id,
    subject: 'Help',
    description: 'Please',
    category: 'other',
    priority: 'low',
  });
  return { app, db, ann, staff, ticket };
}

test('a customer replies to their own ticket and it stays open', async () => {
  const { app, db, ann, ticket } = scenario();
  const agent = await loginAs(app, ann.email);

  await agent
    .post(`/tickets/${ticket.id}/replies`)
    .type('form')
    .send({ body: 'Any news?' })
    .expect(302)
    .expect('Location', `/tickets/${ticket.id}`);

  const page = await agent.get(`/tickets/${ticket.id}`).expect(200);
  assert.match(page.text, /Any news\?/);
  assert.equal(tickets.findTicketById(db, ticket.id).status, 'open');
});

test('an agent reply moves an open ticket to in_progress', async () => {
  const { app, db, staff, ticket } = scenario();
  const agent = await loginAs(app, staff.email);
  await agent.post(`/tickets/${ticket.id}/replies`).type('form').send({ body: 'On it' }).expect(302);
  assert.equal(tickets.findTicketById(db, ticket.id).status, 'in_progress');
});

test('an empty or whitespace-only reply is rejected', async () => {
  const { app, db, ann, ticket } = scenario();
  const agent = await loginAs(app, ann.email);
  const res = await agent.post(`/tickets/${ticket.id}/replies`).type('form').send({ body: '   ' }).expect(400);
  assert.match(res.text, /กรุณากรอกข้อความ/);
  assert.equal(replies.listReplies(db, ticket.id).length, 0);
});

test('replying to a closed ticket is rejected and the form is hidden', async () => {
  const { app, db, ann, ticket } = scenario();
  tickets.updateStatus(db, ticket.id, 'closed');
  const agent = await loginAs(app, ann.email);

  const res = await agent.post(`/tickets/${ticket.id}/replies`).type('form').send({ body: 'hello?' }).expect(400);
  assert.match(res.text, /ไม่สามารถตอบกลับได้/);
  assert.equal(replies.listReplies(db, ticket.id).length, 0);

  const page = await agent.get(`/tickets/${ticket.id}`).expect(200);
  assert.doesNotMatch(page.text, /name="body"/);
});

test('a customer cannot reply to someone else\'s ticket', async () => {
  const { app, db, ticket } = scenario();
  const bob = makeUser(db);
  const agent = await loginAs(app, bob.email);
  await agent.post(`/tickets/${ticket.id}/replies`).type('form').send({ body: 'hi' }).expect(404);
});

test('HTML in a reply is shown as text', async () => {
  const { app, ann, ticket } = scenario();
  const agent = await loginAs(app, ann.email);
  await agent.post(`/tickets/${ticket.id}/replies`).type('form').send({ body: '<b>bold</b>' }).expect(302);
  const page = await agent.get(`/tickets/${ticket.id}`).expect(200);
  assert.match(page.text, /&lt;b&gt;bold&lt;\/b&gt;/);
});

test('an agent changes status, including reopening a closed ticket', async () => {
  const { app, db, staff, ticket } = scenario();
  const agent = await loginAs(app, staff.email);

  await agent
    .post(`/tickets/${ticket.id}/status`)
    .type('form')
    .send({ status: 'closed' })
    .expect(302)
    .expect('Location', `/tickets/${ticket.id}`);
  assert.equal(tickets.findTicketById(db, ticket.id).status, 'closed');

  await agent.post(`/tickets/${ticket.id}/status`).type('form').send({ status: 'open' }).expect(302);
  assert.equal(tickets.findTicketById(db, ticket.id).status, 'open');
});

test('an invalid status value is rejected', async () => {
  const { app, db, staff, ticket } = scenario();
  const agent = await loginAs(app, staff.email);
  await agent.post(`/tickets/${ticket.id}/status`).type('form').send({ status: 'deleted' }).expect(400);
  assert.equal(tickets.findTicketById(db, ticket.id).status, 'open');
});

test('a customer cannot change status, even on their own ticket', async () => {
  const { app, db, ann, ticket } = scenario();
  const agent = await loginAs(app, ann.email);
  await agent.post(`/tickets/${ticket.id}/status`).type('form').send({ status: 'closed' }).expect(403);
  assert.equal(tickets.findTicketById(db, ticket.id).status, 'open');
});
