const test = require('node:test');
const assert = require('node:assert/strict');
const { openDb } = require('../../../src/db');
const users = require('../../../src/models/users');
const tickets = require('../../../src/models/tickets');
const replies = require('../../../src/models/replies');

function setup() {
  const db = openDb(':memory:');
  const ann = users.createUser(db, { name: 'Ann', email: 'ann@example.com', password: 'secret123' });
  const staff = users.createUser(db, { name: 'Staff', email: 'staff@example.com', password: 'secret123', role: 'agent' });
  const ticket = tickets.createTicket(db, {
    customerId: ann.id,
    subject: 'Help',
    description: 'Please',
    category: 'usage',
    priority: 'low',
  });
  const statusOf = () => tickets.findTicketById(db, ticket.id).status;
  return { db, ann, staff, ticket, statusOf };
}

test('listReplies is empty for a ticket without replies', () => {
  const { db, ticket } = setup();
  assert.deepEqual(replies.listReplies(db, ticket.id), []);
});

test('addReply returns the new id and listReplies shows replies oldest first with author details', () => {
  const { db, ann, staff, ticket } = setup();
  const firstId = replies.addReply(db, { ticketId: ticket.id, author: ann, body: 'Any update?' });
  replies.addReply(db, { ticketId: ticket.id, author: staff, body: 'Looking into it' });

  assert.equal(typeof firstId, 'number');
  assert.deepEqual(
    replies.listReplies(db, ticket.id).map((r) => [r.id === firstId, r.author_name, r.author_role, r.body]),
    [
      [true, 'Ann', 'customer', 'Any update?'],
      [false, 'Staff', 'agent', 'Looking into it'],
    ]
  );
});

test('a customer reply leaves the status unchanged', () => {
  const { db, ann, ticket, statusOf } = setup();
  replies.addReply(db, { ticketId: ticket.id, author: ann, body: 'hello' });
  assert.equal(statusOf(), 'open');
});

test('an agent reply moves an open ticket to in_progress', () => {
  const { db, staff, ticket, statusOf } = setup();
  replies.addReply(db, { ticketId: ticket.id, author: staff, body: 'On it' });
  assert.equal(statusOf(), 'in_progress');
});

test('an agent reply does not change in_progress or closed tickets', () => {
  const { db, staff, ticket, statusOf } = setup();
  for (const status of ['in_progress', 'closed']) {
    tickets.updateStatus(db, ticket.id, status);
    replies.addReply(db, { ticketId: ticket.id, author: staff, body: 'note' });
    assert.equal(statusOf(), status);
  }
});

test('replying to a missing ticket fails and saves nothing', () => {
  const { db, ann } = setup();
  assert.throws(() => replies.addReply(db, { ticketId: 999, author: ann, body: 'hi' }), /FOREIGN KEY/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM replies').get().n, 0);
});

test('replies are kept per ticket', () => {
  const { db, ann, ticket } = setup();
  const other = tickets.createTicket(db, {
    customerId: ann.id,
    subject: 'Other',
    description: 'x',
    category: 'other',
    priority: 'low',
  });
  replies.addReply(db, { ticketId: other.id, author: ann, body: 'on other' });
  assert.deepEqual(replies.listReplies(db, ticket.id), []);
  assert.equal(replies.listReplies(db, other.id).length, 1);
});
