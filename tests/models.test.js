const test = require('node:test');
const assert = require('node:assert/strict');
const { openDb } = require('../src/db');
const users = require('../src/models/users');
const tickets = require('../src/models/tickets');
const replies = require('../src/models/replies');
const labels = require('../src/labels');
const { text } = require('../src/forms');

function freshDb() {
  return openDb(':memory:');
}

function makeTicket(db, customerId, overrides = {}) {
  return tickets.createTicket(db, {
    customerId,
    subject: 'Cannot log in',
    description: 'It says wrong password',
    category: 'usage',
    priority: 'high',
    ...overrides,
  });
}

test('createUser normalizes email, hides the hash, and authenticate checks the password', () => {
  const db = freshDb();
  const user = users.createUser(db, { name: 'Ann', email: ' Ann@Example.COM ', password: 'secret123' });

  assert.equal(user.email, 'ann@example.com');
  assert.equal(user.role, 'customer');
  assert.equal(user.password_hash, undefined);
  assert.equal(users.authenticate(db, 'ann@example.com', 'secret123').id, user.id);
  assert.equal(users.authenticate(db, 'ANN@example.com', 'secret123').id, user.id);
  assert.equal(users.authenticate(db, 'ann@example.com', 'wrong-pass'), null);
  assert.equal(users.authenticate(db, 'nobody@example.com', 'secret123'), null);
});

test('email must be unique', () => {
  const db = freshDb();
  users.createUser(db, { name: 'Ann', email: 'ann@example.com', password: 'secret123' });
  assert.throws(() => users.createUser(db, { name: 'Ann 2', email: 'ANN@example.com', password: 'secret123' }));
});

test('createTicket starts as open and includes the customer name', () => {
  const db = freshDb();
  const ann = users.createUser(db, { name: 'Ann', email: 'ann@example.com', password: 'secret123' });
  const ticket = makeTicket(db, ann.id);

  assert.equal(ticket.status, 'open');
  assert.equal(ticket.customer_id, ann.id);
  assert.equal(ticket.customer_name, 'Ann');
  assert.equal(tickets.findTicketById(db, 9999), undefined);
});

test('listTickets filters by customer and status', () => {
  const db = freshDb();
  const ann = users.createUser(db, { name: 'Ann', email: 'ann@example.com', password: 'secret123' });
  const bob = users.createUser(db, { name: 'Bob', email: 'bob@example.com', password: 'secret123' });
  const a1 = makeTicket(db, ann.id, { subject: 'A1' });
  makeTicket(db, bob.id, { subject: 'B1' });
  tickets.updateStatus(db, a1.id, 'closed');

  assert.deepEqual(tickets.listTickets(db).map((t) => t.subject).sort(), ['A1', 'B1']);
  assert.deepEqual(tickets.listTickets(db, { customerId: ann.id }).map((t) => t.subject), ['A1']);
  assert.deepEqual(tickets.listTickets(db, { status: 'closed' }).map((t) => t.subject), ['A1']);
  assert.deepEqual(tickets.listTickets(db, { customerId: bob.id, status: 'closed' }), []);
});

test('an agent reply moves an open ticket to in_progress; a customer reply does not', () => {
  const db = freshDb();
  const ann = users.createUser(db, { name: 'Ann', email: 'ann@example.com', password: 'secret123' });
  const agent = users.createUser(db, { name: 'Agent', email: 'agent@example.com', password: 'secret123', role: 'agent' });
  const ticket = makeTicket(db, ann.id);

  replies.addReply(db, { ticketId: ticket.id, author: ann, body: 'Any update?' });
  assert.equal(tickets.findTicketById(db, ticket.id).status, 'open');

  replies.addReply(db, { ticketId: ticket.id, author: agent, body: 'Looking into it' });
  assert.equal(tickets.findTicketById(db, ticket.id).status, 'in_progress');

  const list = replies.listReplies(db, ticket.id);
  assert.deepEqual(list.map((r) => [r.author_name, r.author_role, r.body]), [
    ['Ann', 'customer', 'Any update?'],
    ['Agent', 'agent', 'Looking into it'],
  ]);
});

test('an agent reply does not reopen a closed ticket', () => {
  const db = freshDb();
  const ann = users.createUser(db, { name: 'Ann', email: 'ann@example.com', password: 'secret123' });
  const agent = users.createUser(db, { name: 'Agent', email: 'agent@example.com', password: 'secret123', role: 'agent' });
  const ticket = makeTicket(db, ann.id);
  tickets.updateStatus(db, ticket.id, 'closed');

  replies.addReply(db, { ticketId: ticket.id, author: agent, body: 'note' });
  assert.equal(tickets.findTicketById(db, ticket.id).status, 'closed');
});

test('labels and form helpers', () => {
  assert.equal(labels.status.in_progress, 'กำลังดำเนินการ');
  assert.equal(labels.category.billing, 'การเงิน');
  assert.equal(labels.priority.high, 'สูง');
  assert.equal(labels.role.agent, 'เจ้าหน้าที่');
  assert.match(labels.formatDate('2026-09-26 03:00:00'), /10:00/);
  assert.equal(text('hi'), 'hi');
  assert.equal(text(['a', 'b']), '');
  assert.equal(text(undefined), '');
});
