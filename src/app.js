const path = require('node:path');
const express = require('express');
const session = require('express-session');
const labels = require('./labels');
const users = require('./models/users');
const authRoutes = require('./routes/auth');

function createApp({ db, sessionSecret = process.env.SESSION_SECRET || 'dev-only-secret-change-me' }) {
  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.locals.labels = labels;

  app.use(express.urlencoded({ extended: false }));
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, sameSite: 'lax' },
    })
  );

  app.use((req, res, next) => {
    req.user = (req.session.userId && users.findById(db, req.session.userId)) || null;
    res.locals.currentUser = req.user;
    next();
  });

  app.get('/', (req, res) => res.redirect(req.user ? '/tickets' : '/login'));
  app.use(authRoutes(db));

  app.use((req, res) => {
    res.status(404).render('error', { title: 'ไม่พบหน้า', message: 'ไม่พบหน้าหรือข้อมูลที่คุณต้องการ' });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).render('error', { title: 'เกิดข้อผิดพลาด', message: 'ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง' });
  });

  return app;
}

module.exports = { createApp };
