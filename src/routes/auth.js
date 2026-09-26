const express = require('express');
const users = require('../models/users');
const { text } = require('../forms');
const { validateRegistration, validateLogin } = require('../validation');
const { requireLogin, redirectIfLoggedIn } = require('../middleware/auth');

// A fresh session id on login prevents session fixation.
function logIn(req, res, next, userId) {
  req.session.regenerate((err) => {
    if (err) return next(err);
    req.session.userId = userId;
    res.redirect('/tickets');
  });
}

module.exports = function authRoutes(db) {
  const router = express.Router();

  router.get('/register', redirectIfLoggedIn, (req, res) => {
    res.render('register', { errors: [], values: { name: '', email: '' } });
  });

  router.post('/register', redirectIfLoggedIn, (req, res, next) => {
    const values = { name: text(req.body.name).trim(), email: users.normalizeEmail(req.body.email) };
    const password = text(req.body.password);
    const errors = validateRegistration({ ...values, password });
    if (errors.length === 0 && users.findByEmail(db, values.email)) errors.push('อีเมลนี้ถูกใช้แล้ว');
    if (errors.length) return res.status(400).render('register', { errors, values });

    const user = users.createUser(db, { ...values, password, role: 'customer' });
    logIn(req, res, next, user.id);
  });

  router.get('/login', redirectIfLoggedIn, (req, res) => {
    res.render('login', { errors: [], values: { email: '' } });
  });

  router.post('/login', redirectIfLoggedIn, (req, res, next) => {
    const email = users.normalizeEmail(req.body.email);
    const password = text(req.body.password);
    const errors = validateLogin({ email, password });
    if (errors.length) return res.status(400).render('login', { errors, values: { email } });

    const user = users.authenticate(db, email, password);
    if (!user) {
      return res
        .status(400)
        .render('login', { errors: ['อีเมลหรือรหัสผ่านไม่ถูกต้อง'], values: { email } });
    }
    logIn(req, res, next, user.id);
  });

  router.post('/logout', requireLogin, (req, res, next) => {
    req.session.destroy((err) => {
      if (err) return next(err);
      res.clearCookie('connect.sid');
      res.redirect('/login');
    });
  });

  return router;
};
