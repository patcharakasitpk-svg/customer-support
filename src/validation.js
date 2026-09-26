const { CATEGORIES, PRIORITIES } = require('./models/tickets');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Both validators expect values already trimmed/normalized by the route, and return Thai messages in form order.
function validateRegistration({ name, email, password }) {
  const errors = [];
  if (!name) errors.push('กรุณากรอกชื่อ');
  if (!EMAIL_PATTERN.test(email)) errors.push('รูปแบบอีเมลไม่ถูกต้อง');
  if (password.length < 8) errors.push('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
  return errors;
}

function validateTicket({ subject, description, category, priority }) {
  const errors = [];
  if (!subject) errors.push('กรุณากรอกหัวข้อ');
  else if (subject.length > 200) errors.push('หัวข้อต้องยาวไม่เกิน 200 ตัวอักษร');
  if (!description) errors.push('กรุณากรอกรายละเอียด');
  if (!CATEGORIES.includes(category)) errors.push('กรุณาเลือกหมวดหมู่');
  if (!PRIORITIES.includes(priority)) errors.push('กรุณาเลือกความเร่งด่วน');
  return errors;
}

module.exports = { validateRegistration, validateTicket };
