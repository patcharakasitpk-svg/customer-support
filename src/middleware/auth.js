function requireLogin(req, res, next) {
  if (!req.user) return res.redirect('/login');
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).render('error', {
        title: 'ไม่มีสิทธิ์เข้าถึง',
        message: 'บัญชีของคุณไม่มีสิทธิ์ทำรายการนี้',
      });
    }
    next();
  };
}

function redirectIfLoggedIn(req, res, next) {
  if (req.user) return res.redirect('/tickets');
  next();
}

module.exports = { requireLogin, requireRole, redirectIfLoggedIn };
