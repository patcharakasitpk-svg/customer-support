const CATEGORIES = ['usage', 'billing', 'other'];
const PRIORITIES = ['low', 'medium', 'high'];
const STATUSES = ['open', 'in_progress', 'closed'];

const SELECT_TICKET = `
  SELECT t.*, u.name AS customer_name
  FROM tickets t
  JOIN users u ON u.id = t.customer_id`;

function findTicketById(db, id) {
  return db.prepare(`${SELECT_TICKET} WHERE t.id = ?`).get(id);
}

function createTicket(db, { customerId, subject, description, category, priority }) {
  const info = db
    .prepare(
      'INSERT INTO tickets (customer_id, subject, description, category, priority) VALUES (?, ?, ?, ?, ?)'
    )
    .run(customerId, subject, description, category, priority);
  return findTicketById(db, info.lastInsertRowid);
}

function listTickets(db, { customerId, status } = {}) {
  const where = [];
  const params = [];
  if (customerId !== undefined) {
    where.push('t.customer_id = ?');
    params.push(customerId);
  }
  if (status !== undefined) {
    where.push('t.status = ?');
    params.push(status);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return db.prepare(`${SELECT_TICKET} ${clause} ORDER BY t.updated_at DESC, t.id DESC`).all(...params);
}

function updateStatus(db, id, status) {
  db.prepare("UPDATE tickets SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
}

module.exports = {
  CATEGORIES,
  PRIORITIES,
  STATUSES,
  findTicketById,
  createTicket,
  listTickets,
  updateStatus,
};
