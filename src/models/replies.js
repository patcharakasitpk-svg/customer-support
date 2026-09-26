function addReply(db, { ticketId, author, body }) {
  return db.transaction(() => {
    const info = db
      .prepare('INSERT INTO replies (ticket_id, author_id, body) VALUES (?, ?, ?)')
      .run(ticketId, author.id, body);
    // An agent answering a fresh ticket means work has started on it.
    if (author.role === 'agent') {
      db.prepare("UPDATE tickets SET status = 'in_progress' WHERE id = ? AND status = 'open'").run(ticketId);
    }
    db.prepare("UPDATE tickets SET updated_at = datetime('now') WHERE id = ?").run(ticketId);
    return info.lastInsertRowid;
  })();
}

function listReplies(db, ticketId) {
  return db
    .prepare(
      `SELECT r.*, u.name AS author_name, u.role AS author_role
       FROM replies r
       JOIN users u ON u.id = r.author_id
       WHERE r.ticket_id = ?
       ORDER BY r.created_at, r.id`
    )
    .all(ticketId);
}

module.exports = { addReply, listReplies };
