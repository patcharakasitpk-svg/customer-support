const { openDb, DEFAULT_DB_PATH } = require('../src/db');
const users = require('../src/models/users');
const tickets = require('../src/models/tickets');
const replies = require('../src/models/replies');

const PASSWORD = 'password123';

function ensureUser(db, { name, email, role }) {
  const existing = users.findByEmail(db, email);
  if (existing) return { user: users.findById(db, existing.id), created: false };
  return { user: users.createUser(db, { name, email, password: PASSWORD, role }), created: true };
}

function seed(db) {
  const { user: agent } = ensureUser(db, { name: 'สมชาย (เจ้าหน้าที่)', email: 'agent@example.com', role: 'agent' });
  const { user: customer, created } = ensureUser(db, {
    name: 'สมหญิง (ลูกค้า)',
    email: 'customer@example.com',
    role: 'customer',
  });
  if (!created) return;

  tickets.createTicket(db, {
    customerId: customer.id,
    subject: 'เข้าสู่ระบบไม่ได้',
    description: 'กรอกรหัสผ่านถูกแล้วแต่ระบบแจ้งว่ารหัสผ่านไม่ถูกต้อง',
    category: 'usage',
    priority: 'high',
  });
  const billing = tickets.createTicket(db, {
    customerId: customer.id,
    subject: 'ยอดในใบเสร็จเดือนที่แล้วไม่ถูกต้อง',
    description: 'ใบเสร็จเดือนสิงหาคมคิดเงินซ้ำสองครั้ง',
    category: 'billing',
    priority: 'medium',
  });
  replies.addReply(db, { ticketId: billing.id, author: agent, body: 'ได้รับเรื่องแล้วครับ กำลังตรวจสอบให้' });
}

if (require.main === module) {
  const dbPath = process.env.DB_PATH || DEFAULT_DB_PATH;
  seed(openDb(dbPath));
  console.log(`Seeded ${dbPath}`);
  console.log(`  agent@example.com    / ${PASSWORD}`);
  console.log(`  customer@example.com / ${PASSWORD}`);
}

module.exports = { seed };
