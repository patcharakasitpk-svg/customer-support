const test = require('node:test');
const assert = require('node:assert/strict');
const { openDb } = require('../../../src/db');
const users = require('../../../src/models/users');
const tickets = require('../../../src/models/tickets');

function setup() {
  const db = openDb(':memory:');
  const ann = users.createUser(db, { name: 'Ann', email: 'ann@example.com', password: 'secret123' });
  const bob = users.createUser(db, { name: 'Bob', email: 'bob@example.com', password: 'secret123' });
  return { db, ann, bob };
}

function make(db, customerId, overrides = {}) {
  return tickets.createTicket(db, {
    customerId,
    subject: 'Subject',
    description: 'Description',
    category: 'usage',
    priority: 'high',
    ...overrides,
  });
}

test('createTicket saves every field, starts open, and joins the customer name', () => {
  const { db, ann } = setup();
  const ticket = make(db, ann.id, { subject: 'Printer', category: 'other', priority: 'low' });
  assert.equal(ticket.subject, 'Printer');
  assert.equal(ticket.description, 'Description');
  assert.equal(ticket.category, 'other');
  assert.equal(ticket.priority, 'low');
  assert.equal(ticket.status, 'open');
  assert.equal(ticket.customer_id, ann.id);
  assert.equal(ticket.customer_name, 'Ann');
});

test('the database rejects values outside the allowed lists', () => {
  const { db, ann } = setup();
  assert.throws(() => make(db, ann.id, { category: 'sales' }), /CHECK/);
  assert.throws(() => make(db, ann.id, { priority: 'urgent' }), /CHECK/);
  assert.throws(() => tickets.updateStatus(db, make(db, ann.id).id, 'deleted'), /CHECK/);
});

test('createTicket requires an existing customer', () => {
  const { db } = setup();
  assert.throws(() => make(db, 999), /FOREIGN KEY/);
});

test('findTicketById returns undefined when the ticket does not exist', () => {
  const { db } = setup();
  assert.equal(tickets.findTicketById(db, 1), undefined);
});

test('listTickets returns the newest first', () => {
  const { db, ann } = setup();
  make(db, ann.id, { subject: 'First' });
  make(db, ann.id, { subject: 'Second' });
  assert.deepEqual(tickets.listTickets(db).map((t) => t.subject), ['Second', 'First']);
});

test('listTickets filters by customer, by status, and by both', () => {
  const { db, ann, bob } = setup();
  const a1 = make(db, ann.id, { subject: 'A1' });
  make(db, ann.id, { subject: 'A2' });
  make(db, bob.id, { subject: 'B1' });
  tickets.updateStatus(db, a1.id, 'closed');

  assert.deepEqual(tickets.listTickets(db, { customerId: ann.id }).map((t) => t.subject).sort(), ['A1', 'A2']);
  assert.deepEqual(tickets.listTickets(db, { status: 'closed' }).map((t) => t.subject), ['A1']);
  assert.deepEqual(tickets.listTickets(db, { customerId: ann.id, status: 'open' }).map((t) => t.subject), ['A2']);
  assert.deepEqual(tickets.listTickets(db, { customerId: bob.id, status: 'closed' }), []);
});

test('updateStatus changes only the given ticket', () => {
  const { db, ann } = setup();
  const one = make(db, ann.id);
  const two = make(db, ann.id);
  tickets.updateStatus(db, one.id, 'in_progress');
  assert.equal(tickets.findTicketById(db, one.id).status, 'in_progress');
  assert.equal(tickets.findTicketById(db, two.id).status, 'open');
});
