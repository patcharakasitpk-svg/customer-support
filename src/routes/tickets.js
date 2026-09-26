const express = require('express');
const tickets = require('../models/tickets');
const replies = require('../models/replies');
const { text } = require('../forms');
const { requireLogin, requireRole } = require('../middleware/auth');

function notFound(res) {
  return res.status(404).render('error', { title: 'ไม่พบหน้า', message: 'ไม่พบหน้าหรือข้อมูลที่คุณต้องการ' });
}

function validateTicket(values) {
  const errors = [];
  if (!values.subject) errors.push('กรุณากรอกหัวข้อ');
  else if (values.subject.length > 200) errors.push('หัวข้อต้องยาวไม่เกิน 200 ตัวอักษร');
  if (!values.description) errors.push('กรุณากรอกรายละเอียด');
  if (!tickets.CATEGORIES.includes(values.category)) errors.push('กรุณาเลือกหมวดหมู่');
  if (!tickets.PRIORITIES.includes(values.priority)) errors.push('กรุณาเลือกความเร่งด่วน');
  return errors;
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

  return router;
};

module.exports.renderShow = renderShow;
