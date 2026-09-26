const express = require('express');
const tickets = require('../models/tickets');
const replies = require('../models/replies');
const { text } = require('../forms');
const { validateTicket } = require('../validation');
const { requireLogin, requireRole } = require('../middleware/auth');

function notFound(res) {
  return res.status(404).render('error', { title: 'ไม่พบหน้า', message: 'ไม่พบหน้าหรือข้อมูลที่คุณต้องการ' });
}

function renderShow(res, db, ticket, { status = 200, errors = [], replyBody = '' } = {}) {
  res.status(status).render('tickets/show', {
    ticket,
    replies: replies.listReplies(db, ticket.id),
    errors,
    replyBody,
  });
}

module.exports = function ticketRoutes(db) {
  const router = express.Router();
  router.use(requireLogin);

  router.get('/', (req, res) => {
    const status = tickets.STATUSES.includes(req.query.status) ? req.query.status : '';
    const filter = { status: status || undefined };
    if (req.user.role === 'customer') filter.customerId = req.user.id;
    res.render('tickets/index', { tickets: tickets.listTickets(db, filter), status });
  });

  router.get('/new', requireRole('customer'), (req, res) => {
    res.render('tickets/new', {
      errors: [],
      values: { subject: '', description: '', category: 'usage', priority: 'medium' },
    });
  });

  router.post('/new', requireRole('customer'), (req, res) => {
    const values = {
      subject: text(req.body.subject).trim(),
      description: text(req.body.description).trim(),
      category: text(req.body.category),
      priority: text(req.body.priority),
    };
    const errors = validateTicket(values);
    if (errors.length) return res.status(400).render('tickets/new', { errors, values });

    const ticket = tickets.createTicket(db, { customerId: req.user.id, ...values });
    res.redirect(`/tickets/${ticket.id}`);
  });

  // Customers get 404 (not 403) for other people's tickets so ids don't leak.
  router.param('id', (req, res, next, id) => {
    const ticket = /^\d+$/.test(id) ? tickets.findTicketById(db, Number(id)) : undefined;
    const canSee = ticket && (req.user.role === 'agent' || ticket.customer_id === req.user.id);
    if (!canSee) return notFound(res);
    req.ticket = ticket;
    next();
  });

  router.get('/:id', (req, res) => renderShow(res, db, req.ticket));

  router.post('/:id/replies', (req, res) => {
    const body = text(req.body.body).trim();
    if (req.ticket.status === 'closed') {
      return renderShow(res, db, req.ticket, {
        status: 400,
        errors: ['ticket นี้ปิดแล้ว ไม่สามารถตอบกลับได้'],
      });
    }
    if (!body) {
      return renderShow(res, db, req.ticket, { status: 400, errors: ['กรุณากรอกข้อความ'] });
    }
    replies.addReply(db, { ticketId: req.ticket.id, author: req.user, body });
    res.redirect(`/tickets/${req.ticket.id}`);
  });

  router.post('/:id/status', requireRole('agent'), (req, res) => {
    const status = text(req.body.status);
    if (!tickets.STATUSES.includes(status)) {
      return res.status(400).render('error', { title: 'ข้อมูลไม่ถูกต้อง', message: 'สถานะที่เลือกไม่ถูกต้อง' });
    }
    tickets.updateStatus(db, req.ticket.id, status);
    res.redirect(`/tickets/${req.ticket.id}`);
  });

  return router;
};

module.exports.renderShow = renderShow;
