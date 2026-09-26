# Customer Support System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เว็บแอประบบ ticket สำหรับ support ที่มี 2 บทบาท (ลูกค้าและเจ้าหน้าที่) รันบนเครื่อง local และมีเทสต์ครอบคลุม

**Architecture:** Express 4 สร้างหน้า EJS ฝั่งเซิร์ฟเวอร์ (ฟอร์ม POST → redirect) และใช้ SQLite ผ่าน `better-sqlite3` โดย model แต่ละตัวเป็นฟังก์ชันที่รับ `db` เป็นพารามิเตอร์ ส่วน `createApp({ db })` ทำให้เทสต์ใช้ฐานข้อมูล `:memory:` ของตัวเองได้ login ด้วย bcrypt + express-session

**Tech Stack:** Node.js 22, Express 4, EJS, better-sqlite3, bcrypt, express-session, node:test, supertest

**Spec:** `docs/superpowers/specs/2026-09-26-customer-support-design.md`

## Global Constraints

- Node.js 22, CommonJS (`require`)
- ค่าใน DB เป็นภาษาอังกฤษ: category `usage|billing|other`, priority `low|medium|high`, status `open|in_progress|closed`, role `customer|agent`
- ข้อความบนหน้าเว็บทั้งหมดเป็นภาษาไทย
- SQL ต้องเป็นแบบ parameterized เสมอ และ EJS ต้องใช้ `<%= %>` กับข้อมูลที่มาจากผู้ใช้
- bcrypt cost 10; รหัสผ่านอย่างน้อย 8 ตัวอักษร; subject 1–200 ตัวอักษร
- session cookie ต้องตั้ง `httpOnly: true`, `sameSite: 'lax'` และอ่าน secret จาก `SESSION_SECRET`
- ลูกค้าเข้า ticket ของคนอื่นต้องได้ 404; ลูกค้าเรียก route ของเจ้าหน้าที่ต้องได้ 403; ถ้ายังไม่ login ต้อง redirect ไป `/login`
- ทุก commit message ต้องลงท้ายด้วย `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## Review Focus

1. **อีเมลที่ต่างกันแค่ตัวพิมพ์เล็ก/ใหญ่หรือมีช่องว่าง** (`" Ann@Example.COM "`) ต้องถือเป็นอีเมลเดียวกัน ทั้งตอนสมัคร (กันซ้ำ) และตอน login → เทสต์อยู่ใน Task 2
2. **ฟิลด์ฟอร์มที่ส่งซ้ำชื่อเดิม** (`subject=a&subject=b` จะกลายเป็น array) ต้องได้ 400 พร้อม error ไม่ใช่ 500 → เทสต์อยู่ใน Task 3
3. **id ของ ticket ที่ไม่ใช่ตัวเลขหรือไม่มีอยู่** (`/tickets/abc`, `/tickets/9999`) ต้องได้ 404 → เทสต์อยู่ใน Task 3
4. **HTML ใน subject หรือข้อความตอบกลับ** (`<script>`) ต้องแสดงเป็นข้อความธรรมดา → เทสต์อยู่ใน Task 3
5. **ค่าตัวกรองสถานะที่ไม่ถูกต้อง** (`?status=bogus`) ต้องแสดง ticket ทั้งหมด ไม่ error → เทสต์อยู่ใน Task 3

---

## File Structure

| ไฟล์ | หน้าที่ |
|---|---|
| `package.json`, `.gitignore` | ข้อมูลโปรเจกต์, scripts, dependencies |
| `src/db.js` | `openDb(filename)` สร้าง schema และ `DEFAULT_DB_PATH` |
| `src/labels.js` | แปลง enum เป็นภาษาไทย และ `formatDate` |
| `src/forms.js` | `text(value)` แปลงค่าจากฟอร์มให้เป็น string อย่างปลอดภัย |
| `src/models/users.js` | สร้างและค้นหาผู้ใช้, ตรวจรหัสผ่าน |
| `src/models/tickets.js` | enum, สร้าง/ค้นหา/แสดงรายการ ticket, เปลี่ยนสถานะ |
| `src/models/replies.js` | เพิ่มข้อความตอบกลับ (พร้อมกฎเปลี่ยนสถานะอัตโนมัติ) และแสดงรายการ |
| `src/middleware/auth.js` | `requireLogin`, `requireRole`, `redirectIfLoggedIn` |
| `src/routes/auth.js` | สมัคร / login / logout |
| `src/routes/tickets.js` | รายการ, สร้าง, ดู, ตอบกลับ, เปลี่ยนสถานะ |
| `src/app.js` | `createApp({ db, sessionSecret })` |
| `src/server.js` | จุดเริ่มรันเซิร์ฟเวอร์ |
| `src/views/**` | หน้า EJS |
| `public/style.css` | สไตล์ |
| `scripts/seed.js` | `seed(db)` + CLI |
| `tests/*.test.js`, `tests/helpers.js` | เทสต์ |
| `README.md` | วิธีใช้งาน |

---

### Task 1: ตั้งค่าโปรเจกต์ + ฐานข้อมูล + models

**Files:**
- Create: `package.json`, `.gitignore`, `src/db.js`, `src/labels.js`, `src/forms.js`, `src/models/users.js`, `src/models/tickets.js`, `src/models/replies.js`
- Test: `tests/models.test.js`

**Interfaces:**
- Consumes: —
- Produces:
  - `openDb(filename: string) → Database`, `DEFAULT_DB_PATH: string`
  - `labels.role|category|priority|status: Record<string,string>`, `labels.formatDate(sqliteUtc: string) → string`
  - `text(value: any) → string`
  - `users.normalizeEmail(v) → string`, `users.createUser(db, {name,email,password,role='customer'}) → User`, `users.findById(db,id) → User|undefined`, `users.findByEmail(db,email) → UserRowWithHash|undefined`, `users.authenticate(db,email,password) → User|null`  (`User = {id,name,email,role,created_at}`)
  - `tickets.CATEGORIES|PRIORITIES|STATUSES: string[]`, `tickets.createTicket(db,{customerId,subject,description,category,priority}) → Ticket`, `tickets.findTicketById(db,id) → Ticket|undefined`, `tickets.listTickets(db,{customerId?,status?}) → Ticket[]`, `tickets.updateStatus(db,id,status)`  (`Ticket` = ทุกคอลัมน์ของ tickets + `customer_name`)
  - `replies.addReply(db,{ticketId,author:User,body}) → number`, `replies.listReplies(db,ticketId) → Reply[]`  (`Reply` = ทุกคอลัมน์ + `author_name`, `author_role`)

- [ ] **Step 1: สร้าง `package.json`**

```json
{
  "name": "customer-support",
  "version": "1.0.0",
  "private": true,
  "description": "ระบบ Customer Support (ticket) สำหรับฝึกพัฒนาร่วมกับ AI",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "seed": "node scripts/seed.js",
    "test": "node --test \"tests/**/*.test.js\""
  },
  "engines": {
    "node": ">=22"
  }
}
```

- [ ] **Step 2: ติดตั้ง dependencies**

Run:
```bash
npm install express@4 ejs better-sqlite3 bcrypt express-session
npm install --save-dev supertest
```
Expected: `added N packages` ไม่มี error

- [ ] **Step 3: สร้าง `.gitignore`**

```
node_modules/
data/
*.db
.env
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "chore: set up Node project and dependencies

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: เขียนเทสต์ที่ต้อง fail — `tests/models.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { openDb } = require('../src/db');
const users = require('../src/models/users');
const tickets = require('../src/models/tickets');
const replies = require('../src/models/replies');
const labels = require('../src/labels');
const { text } = require('../src/forms');

function freshDb() {
  return openDb(':memory:');
}

function makeTicket(db, customerId, overrides = {}) {
  return tickets.createTicket(db, {
    customerId,
    subject: 'Cannot log in',
    description: 'It says wrong password',
    category: 'usage',
    priority: 'high',
    ...overrides,
  });
}

test('createUser normalizes email, hides the hash, and authenticate checks the password', () => {
  const db = freshDb();
  const user = users.createUser(db, { name: 'Ann', email: ' Ann@Example.COM ', password: 'secret123' });

  assert.equal(user.email, 'ann@example.com');
  assert.equal(user.role, 'customer');
  assert.equal(user.password_hash, undefined);
  assert.equal(users.authenticate(db, 'ann@example.com', 'secret123').id, user.id);
  assert.equal(users.authenticate(db, 'ANN@example.com', 'secret123').id, user.id);
  assert.equal(users.authenticate(db, 'ann@example.com', 'wrong-pass'), null);
  assert.equal(users.authenticate(db, 'nobody@example.com', 'secret123'), null);
});

test('email must be unique', () => {
  const db = freshDb();
  users.createUser(db, { name: 'Ann', email: 'ann@example.com', password: 'secret123' });
  assert.throws(() => users.createUser(db, { name: 'Ann 2', email: 'ANN@example.com', password: 'secret123' }));
});

test('createTicket starts as open and includes the customer name', () => {
  const db = freshDb();
  const ann = users.createUser(db, { name: 'Ann', email: 'ann@example.com', password: 'secret123' });
  const ticket = makeTicket(db, ann.id);

  assert.equal(ticket.status, 'open');
  assert.equal(ticket.customer_id, ann.id);
  assert.equal(ticket.customer_name, 'Ann');
  assert.equal(tickets.findTicketById(db, 9999), undefined);
});

test('listTickets filters by customer and status', () => {
  const db = freshDb();
  const ann = users.createUser(db, { name: 'Ann', email: 'ann@example.com', password: 'secret123' });
  const bob = users.createUser(db, { name: 'Bob', email: 'bob@example.com', password: 'secret123' });
  const a1 = makeTicket(db, ann.id, { subject: 'A1' });
  makeTicket(db, bob.id, { subject: 'B1' });
  tickets.updateStatus(db, a1.id, 'closed');

  assert.deepEqual(tickets.listTickets(db).map((t) => t.subject).sort(), ['A1', 'B1']);
  assert.deepEqual(tickets.listTickets(db, { customerId: ann.id }).map((t) => t.subject), ['A1']);
  assert.deepEqual(tickets.listTickets(db, { status: 'closed' }).map((t) => t.subject), ['A1']);
  assert.deepEqual(tickets.listTickets(db, { customerId: bob.id, status: 'closed' }), []);
});

test('an agent reply moves an open ticket to in_progress; a customer reply does not', () => {
  const db = freshDb();
  const ann = users.createUser(db, { name: 'Ann', email: 'ann@example.com', password: 'secret123' });
  const agent = users.createUser(db, { name: 'Agent', email: 'agent@example.com', password: 'secret123', role: 'agent' });
  const ticket = makeTicket(db, ann.id);

  replies.addReply(db, { ticketId: ticket.id, author: ann, body: 'Any update?' });
  assert.equal(tickets.findTicketById(db, ticket.id).status, 'open');

  replies.addReply(db, { ticketId: ticket.id, author: agent, body: 'Looking into it' });
  assert.equal(tickets.findTicketById(db, ticket.id).status, 'in_progress');

  const list = replies.listReplies(db, ticket.id);
  assert.deepEqual(list.map((r) => [r.author_name, r.author_role, r.body]), [
    ['Ann', 'customer', 'Any update?'],
    ['Agent', 'agent', 'Looking into it'],
  ]);
});

test('an agent reply does not reopen a closed ticket', () => {
  const db = freshDb();
  const ann = users.createUser(db, { name: 'Ann', email: 'ann@example.com', password: 'secret123' });
  const agent = users.createUser(db, { name: 'Agent', email: 'agent@example.com', password: 'secret123', role: 'agent' });
  const ticket = makeTicket(db, ann.id);
  tickets.updateStatus(db, ticket.id, 'closed');

  replies.addReply(db, { ticketId: ticket.id, author: agent, body: 'note' });
  assert.equal(tickets.findTicketById(db, ticket.id).status, 'closed');
});

test('labels and form helpers', () => {
  assert.equal(labels.status.in_progress, 'กำลังดำเนินการ');
  assert.equal(labels.category.billing, 'การเงิน');
  assert.equal(labels.priority.high, 'สูง');
  assert.equal(labels.role.agent, 'เจ้าหน้าที่');
  assert.match(labels.formatDate('2026-09-26 03:00:00'), /10:00/);
  assert.equal(text('hi'), 'hi');
  assert.equal(text(['a', 'b']), '');
  assert.equal(text(undefined), '');
});
```

- [ ] **Step 6: รันเทสต์ ต้อง fail**

Run: `node --test tests/models.test.js`
Expected: FAIL เพราะ `Cannot find module '../src/db'`

- [ ] **Step 7: เขียน `src/db.js`**

```js
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const DEFAULT_DB_PATH = path.join(__dirname, '..', 'data', 'support.db');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('customer','agent')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tickets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES users(id),
  subject     TEXT NOT NULL,
  description TEXT NOT NULL,
  category    TEXT NOT NULL CHECK (category IN ('usage','billing','other')),
  priority    TEXT NOT NULL CHECK (priority IN ('low','medium','high')),
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','closed')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS replies (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id  INTEGER NOT NULL REFERENCES tickets(id),
  author_id  INTEGER NOT NULL REFERENCES users(id),
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

function openDb(filename) {
  if (filename !== ':memory:') {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
  }
  const db = new Database(filename);
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

module.exports = { openDb, DEFAULT_DB_PATH };
```

- [ ] **Step 8: เขียน `src/labels.js`**

```js
const role = { customer: 'ลูกค้า', agent: 'เจ้าหน้าที่' };
const category = { usage: 'ปัญหาการใช้งาน', billing: 'การเงิน', other: 'อื่น ๆ' };
const priority = { low: 'ต่ำ', medium: 'กลาง', high: 'สูง' };
const status = { open: 'เปิด', in_progress: 'กำลังดำเนินการ', closed: 'ปิดแล้ว' };

// SQLite datetime('now') is UTC without a zone marker.
function formatDate(sqliteUtc) {
  const date = new Date(`${sqliteUtc.replace(' ', 'T')}Z`);
  return date.toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

module.exports = { role, category, priority, status, formatDate };
```

- [ ] **Step 9: เขียน `src/forms.js`**

```js
// A form field sent more than once arrives as an array; treat anything but a string as empty.
function text(value) {
  return typeof value === 'string' ? value : '';
}

module.exports = { text };
```

- [ ] **Step 10: เขียน `src/models/users.js`**

```js
const bcrypt = require('bcrypt');

const BCRYPT_COST = 10;

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function findById(db, id) {
  return db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(id);
}

function findByEmail(db, email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(normalizeEmail(email));
}

function createUser(db, { name, email, password, role = 'customer' }) {
  const passwordHash = bcrypt.hashSync(password, BCRYPT_COST);
  const info = db
    .prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(name, normalizeEmail(email), passwordHash, role);
  return findById(db, info.lastInsertRowid);
}

function authenticate(db, email, password) {
  const row = findByEmail(db, email);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) return null;
  return findById(db, row.id);
}

module.exports = { normalizeEmail, findById, findByEmail, createUser, authenticate };
```

- [ ] **Step 11: เขียน `src/models/tickets.js`**

```js
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
```

- [ ] **Step 12: เขียน `src/models/replies.js`**

```js
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
```

- [ ] **Step 13: รันเทสต์ ต้องผ่าน**

Run: `node --test tests/models.test.js`
Expected: `# pass 7`, `# fail 0`

- [ ] **Step 14: Commit**

```bash
git add src tests
git commit -m "feat: add SQLite schema and user, ticket, reply models

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: โครง Express app + ระบบสมาชิก (สมัคร / login / logout)

**Files:**
- Create: `src/app.js`, `src/server.js`, `src/middleware/auth.js`, `src/routes/auth.js`, `src/views/partials/header.ejs`, `src/views/partials/footer.ejs`, `src/views/partials/errors.ejs`, `src/views/login.ejs`, `src/views/register.ejs`, `src/views/error.ejs`, `public/style.css`
- Test: `tests/helpers.js`, `tests/auth.test.js`

**Interfaces:**
- Consumes: `openDb`, `DEFAULT_DB_PATH`, `labels`, `text`, `users.*` จาก Task 1
- Produces:
  - `createApp({ db, sessionSecret? }) → express.Application` โดยตั้ง `req.user` (User|null) และ `res.locals.currentUser` ให้ทุก request และ `app.locals.labels`
  - `requireLogin`, `requireRole(role: 'customer'|'agent')`, `redirectIfLoggedIn` (Express middleware)
  - view `error` รับ locals `{ title, message }`; partial `errors` อ่าน local `errors: string[]`
  - test helpers: `setup() → { db, app }`, `makeUser(db, overrides?) → User` (รหัสผ่าน `PASSWORD`), `loginAs(app, email, password?) → supertest agent`, `PASSWORD`

- [ ] **Step 1: เขียน `tests/helpers.js`**

```js
const request = require('supertest');
const { openDb } = require('../src/db');
const { createApp } = require('../src/app');
const users = require('../src/models/users');

const PASSWORD = 'password123';
let counter = 0;

function setup() {
  const db = openDb(':memory:');
  return { db, app: createApp({ db, sessionSecret: 'test-secret' }) };
}

function makeUser(db, overrides = {}) {
  counter += 1;
  return users.createUser(db, {
    name: `User ${counter}`,
    email: `user${counter}@example.com`,
    password: PASSWORD,
    ...overrides,
  });
}

async function loginAs(app, email, password = PASSWORD) {
  const agent = request.agent(app);
  await agent.post('/login').type('form').send({ email, password }).expect(302);
  return agent;
}

module.exports = { PASSWORD, setup, makeUser, loginAs };
```

- [ ] **Step 2: เขียนเทสต์ที่ต้อง fail — `tests/auth.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const users = require('../src/models/users');
const { setup, makeUser, loginAs } = require('./helpers');

test('GET / sends anonymous visitors to /login', async () => {
  const { app } = setup();
  await request(app).get('/').expect(302).expect('Location', '/login');
});

test('login and register pages render', async () => {
  const { app } = setup();
  const login = await request(app).get('/login').expect(200);
  assert.match(login.text, /เข้าสู่ระบบ/);
  const register = await request(app).get('/register').expect(200);
  assert.match(register.text, /สมัครสมาชิก/);
});

test('register creates a customer and logs them in', async () => {
  const { app, db } = setup();
  const agent = request.agent(app);
  await agent
    .post('/register')
    .type('form')
    .send({ name: 'Ann', email: 'ann@example.com', password: 'password123', role: 'agent' })
    .expect(302)
    .expect('Location', '/tickets');

  assert.equal(users.findByEmail(db, 'ann@example.com').role, 'customer');
  await agent.get('/').expect(302).expect('Location', '/tickets');
});

test('register shows validation errors and keeps what was typed', async () => {
  const { app } = setup();
  const res = await request(app)
    .post('/register')
    .type('form')
    .send({ name: '', email: 'not-an-email', password: 'short' })
    .expect(400);

  assert.match(res.text, /กรุณากรอกชื่อ/);
  assert.match(res.text, /รูปแบบอีเมลไม่ถูกต้อง/);
  assert.match(res.text, /อย่างน้อย 8 ตัวอักษร/);
  assert.match(res.text, /value="not-an-email"/);
});

test('register rejects an email that differs only by case or spaces', async () => {
  const { app, db } = setup();
  makeUser(db, { email: 'ann@example.com' });
  const res = await request(app)
    .post('/register')
    .type('form')
    .send({ name: 'Ann', email: '  ANN@Example.com ', password: 'password123' })
    .expect(400);
  assert.match(res.text, /อีเมลนี้ถูกใช้แล้ว/);
});

test('login accepts the email in any case', async () => {
  const { app, db } = setup();
  makeUser(db, { email: 'ann@example.com' });
  const agent = await loginAs(app, ' Ann@Example.COM');
  await agent.get('/').expect(302).expect('Location', '/tickets');
});

test('wrong password shows a generic error', async () => {
  const { app, db } = setup();
  makeUser(db, { email: 'ann@example.com' });
  const res = await request(app)
    .post('/login')
    .type('form')
    .send({ email: 'ann@example.com', password: 'wrong-password' })
    .expect(400);
  assert.match(res.text, /อีเมลหรือรหัสผ่านไม่ถูกต้อง/);
});

test('logout ends the session', async () => {
  const { app, db } = setup();
  const user = makeUser(db);
  const agent = await loginAs(app, user.email);
  await agent.post('/logout').expect(302).expect('Location', '/login');
  await agent.get('/').expect(302).expect('Location', '/login');
});

test('logged-in users are sent away from the login page', async () => {
  const { app, db } = setup();
  const user = makeUser(db);
  const agent = await loginAs(app, user.email);
  await agent.get('/login').expect(302).expect('Location', '/tickets');
});

test('unknown pages return 404', async () => {
  const { app } = setup();
  const res = await request(app).get('/nope').expect(404);
  assert.match(res.text, /ไม่พบหน้า/);
});
```

- [ ] **Step 3: รันเทสต์ ต้อง fail**

Run: `node --test tests/auth.test.js`
Expected: FAIL เพราะ `Cannot find module '../src/app'`

- [ ] **Step 4: เขียน `src/middleware/auth.js`**

```js
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
```

- [ ] **Step 5: เขียน `src/routes/auth.js`**

```js
const express = require('express');
const users = require('../models/users');
const { text } = require('../forms');
const { requireLogin, redirectIfLoggedIn } = require('../middleware/auth');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    const errors = [];
    if (!values.name) errors.push('กรุณากรอกชื่อ');
    if (!EMAIL_PATTERN.test(values.email)) errors.push('รูปแบบอีเมลไม่ถูกต้อง');
    if (password.length < 8) errors.push('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
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
    const user = users.authenticate(db, email, text(req.body.password));
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
```

- [ ] **Step 6: เขียน `src/app.js`**

```js
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
```

- [ ] **Step 7: เขียน `src/server.js`**

```js
const { openDb, DEFAULT_DB_PATH } = require('./db');
const { createApp } = require('./app');

const port = Number(process.env.PORT) || 3000;
const db = openDb(process.env.DB_PATH || DEFAULT_DB_PATH);

createApp({ db }).listen(port, () => {
  console.log(`Customer Support running at http://localhost:${port}`);
});
```

- [ ] **Step 8: เขียน views**

`src/views/partials/header.ejs`
```html
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><%= title %> · Customer Support</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
<header class="topbar">
  <a class="brand" href="/">Customer Support</a>
  <% if (locals.currentUser) { %>
    <span class="who"><%= currentUser.name %> · <%= labels.role[currentUser.role] %></span>
    <form method="post" action="/logout"><button class="link">ออกจากระบบ</button></form>
  <% } %>
</header>
<main>
```

`src/views/partials/footer.ejs`
```html
</main>
</body>
</html>
```

`src/views/partials/errors.ejs`
```html
<% if (locals.errors && errors.length) { %>
  <ul class="errors">
    <% errors.forEach((message) => { %><li><%= message %></li><% }) %>
  </ul>
<% } %>
```

`src/views/login.ejs`
```html
<%- include('partials/header', { title: 'เข้าสู่ระบบ' }) %>
<section class="card narrow">
  <h1>เข้าสู่ระบบ</h1>
  <%- include('partials/errors') %>
  <form method="post" action="/login">
    <label>อีเมล<input type="email" name="email" required value="<%= values.email %>"></label>
    <label>รหัสผ่าน<input type="password" name="password" required></label>
    <button>เข้าสู่ระบบ</button>
  </form>
  <p>ยังไม่มีบัญชี? <a href="/register">สมัครสมาชิก</a></p>
</section>
<%- include('partials/footer') %>
```

`src/views/register.ejs`
```html
<%- include('partials/header', { title: 'สมัครสมาชิก' }) %>
<section class="card narrow">
  <h1>สมัครสมาชิก</h1>
  <%- include('partials/errors') %>
  <form method="post" action="/register">
    <label>ชื่อ<input name="name" required value="<%= values.name %>"></label>
    <label>อีเมล<input type="email" name="email" required value="<%= values.email %>"></label>
    <label>รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)<input type="password" name="password" minlength="8" required></label>
    <button>สมัครสมาชิก</button>
  </form>
  <p>มีบัญชีแล้ว? <a href="/login">เข้าสู่ระบบ</a></p>
</section>
<%- include('partials/footer') %>
```

`src/views/error.ejs`
```html
<%- include('partials/header', { title }) %>
<section class="card narrow">
  <h1><%= title %></h1>
  <p><%= message %></p>
  <p><a href="/">กลับหน้าแรก</a></p>
</section>
<%- include('partials/footer') %>
```

- [ ] **Step 9: เขียน `public/style.css`**

```css
:root {
  --bg: #f5f6f8;
  --card: #ffffff;
  --text: #1f2933;
  --muted: #6b7280;
  --accent: #2563eb;
  --border: #e5e7eb;
  --danger: #b91c1c;
}
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, "Sarabun", sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; }
main { max-width: 960px; margin: 0 auto; padding: 24px 16px; }
a { color: var(--accent); }
.topbar { display: flex; align-items: center; gap: 16px; padding: 12px 16px; background: var(--card); border-bottom: 1px solid var(--border); }
.topbar .brand { font-weight: 700; text-decoration: none; margin-right: auto; }
.topbar form { margin: 0; }
.who { color: var(--muted); }
.card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 20px; margin-bottom: 16px; }
.narrow { max-width: 420px; margin: 40px auto; }
label { display: block; margin-bottom: 12px; font-weight: 600; }
input, textarea, select { display: block; width: 100%; margin-top: 4px; padding: 8px; font: inherit; border: 1px solid var(--border); border-radius: 6px; }
button, .button { display: inline-block; padding: 8px 16px; font: inherit; color: #fff; background: var(--accent); border: 0; border-radius: 6px; text-decoration: none; cursor: pointer; }
button.link { background: none; color: var(--accent); padding: 0; }
.errors { color: var(--danger); background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 8px 8px 8px 28px; }
.page-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.filters { display: flex; gap: 12px; flex-wrap: wrap; margin: 12px 0; }
.filters a.active { font-weight: 700; text-decoration: none; color: var(--text); }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; background: var(--card); }
th, td { text-align: left; padding: 8px; border-bottom: 1px solid var(--border); }
.badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 0.85em; }
.status-open { background: #dbeafe; color: #1e40af; }
.status-in_progress { background: #fef3c7; color: #92400e; }
.status-closed { background: #e5e7eb; color: #374151; }
.meta { color: var(--muted); font-size: 0.9em; }
.body { white-space: pre-wrap; }
.reply { border-left: 4px solid var(--border); padding: 4px 12px; margin-bottom: 12px; background: var(--card); }
.reply-agent { border-left-color: var(--accent); }
.inline { display: flex; align-items: end; gap: 8px; }
.inline label { margin: 0; }
.empty, .notice { color: var(--muted); }
```

- [ ] **Step 10: รันเทสต์ ต้องผ่านทั้งหมด**

Run: `npm test`
Expected: `# fail 0` (models 7 + auth 10)

- [ ] **Step 11: ลองรันจริง**

Run: `PORT=3100 node src/server.js` (รันใน background) แล้วรัน `curl -s localhost:3100/login | grep -c 'เข้าสู่ระบบ'`
Expected: ได้ตัวเลขมากกว่า 0 จากนั้นหยุดเซิร์ฟเวอร์

- [ ] **Step 12: Commit**

```bash
git add src public tests
git commit -m "feat: add Express app with register, login and logout

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: ticket — ดูรายการ, สร้าง, ดูรายละเอียด

**Files:**
- Create: `src/routes/tickets.js`, `src/views/tickets/index.ejs`, `src/views/tickets/new.ejs`, `src/views/tickets/show.ejs`
- Modify: `src/app.js` (mount `/tickets`)
- Test: `tests/tickets.test.js`

**Interfaces:**
- Consumes: `tickets.*`, `replies.listReplies`, `text`, `requireLogin`, `requireRole`, test helpers
- Produces:
  - `ticketRoutes(db) → express.Router` mount ที่ `/tickets`; `router.param('id')` ตั้ง `req.ticket` (Ticket) หรือตอบ 404 ถ้าไม่พบหรือไม่มีสิทธิ์เห็น
  - `renderShow(res, db, ticket, { status=200, errors=[], replyBody='' })` ใช้ใน Task 4
  - view `tickets/show` รับ locals `{ ticket, replies, errors, replyBody }`

- [ ] **Step 1: เขียนเทสต์ที่ต้อง fail — `tests/tickets.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const tickets = require('../src/models/tickets');
const { setup, makeUser, loginAs } = require('./helpers');

function makeTicket(db, customerId, overrides = {}) {
  return tickets.createTicket(db, {
    customerId,
    subject: 'Printer on fire',
    description: 'Smoke everywhere',
    category: 'usage',
    priority: 'high',
    ...overrides,
  });
}

const validForm = { subject: 'Cannot log in', description: 'Wrong password error', category: 'usage', priority: 'high' };

test('anonymous visitors are sent to /login', async () => {
  const { app } = setup();
  await request(app).get('/tickets').expect(302).expect('Location', '/login');
  await request(app).get('/tickets/new').expect(302).expect('Location', '/login');
});

test('a customer creates a ticket and lands on its page', async () => {
  const { app, db } = setup();
  const ann = makeUser(db);
  const agent = await loginAs(app, ann.email);

  await agent.get('/tickets/new').expect(200);
  const res = await agent.post('/tickets/new').type('form').send(validForm).expect(302);
  assert.match(res.headers.location, /^\/tickets\/\d+$/);

  const page = await agent.get(res.headers.location).expect(200);
  assert.match(page.text, /Cannot log in/);
  assert.match(page.text, /ปัญหาการใช้งาน/);
  assert.match(page.text, /เปิด/);
});

test('ticket form validation keeps what was typed', async () => {
  const { app, db } = setup();
  const agent = await loginAs(app, makeUser(db).email);

  const res = await agent
    .post('/tickets/new')
    .type('form')
    .send({ subject: '', description: 'kept text', category: 'bogus', priority: 'low' })
    .expect(400);
  assert.match(res.text, /กรุณากรอกหัวข้อ/);
  assert.match(res.text, /กรุณาเลือกหมวดหมู่/);
  assert.match(res.text, /kept text/);

  const long = await agent.post('/tickets/new').type('form').send({ ...validForm, subject: 'x'.repeat(201) }).expect(400);
  assert.match(long.text, /ไม่เกิน 200 ตัวอักษร/);
});

test('a repeated form field is treated as invalid, not a crash', async () => {
  const { app, db } = setup();
  const agent = await loginAs(app, makeUser(db).email);
  const res = await agent
    .post('/tickets/new')
    .type('form')
    .send('subject=a&subject=b&description=d&category=usage&priority=low')
    .expect(400);
  assert.match(res.text, /กรุณากรอกหัวข้อ/);
});

test('customers see only their own tickets', async () => {
  const { app, db } = setup();
  const ann = makeUser(db);
  const bob = makeUser(db);
  makeTicket(db, ann.id, { subject: 'Ann ticket' });
  const bobTicket = makeTicket(db, bob.id, { subject: 'Bob ticket' });

  const agent = await loginAs(app, ann.email);
  const list = await agent.get('/tickets').expect(200);
  assert.match(list.text, /Ann ticket/);
  assert.doesNotMatch(list.text, /Bob ticket/);

  await agent.get(`/tickets/${bobTicket.id}`).expect(404);
});

test('agents see every ticket and can filter by status', async () => {
  const { app, db } = setup();
  const ann = makeUser(db);
  const staff = makeUser(db, { role: 'agent' });
  makeTicket(db, ann.id, { subject: 'Alpha issue' });
  const beta = makeTicket(db, ann.id, { subject: 'Beta issue' });
  tickets.updateStatus(db, beta.id, 'closed');

  const agent = await loginAs(app, staff.email);
  const all = await agent.get('/tickets').expect(200);
  assert.match(all.text, /Alpha issue/);
  assert.match(all.text, /Beta issue/);

  const closed = await agent.get('/tickets?status=closed').expect(200);
  assert.doesNotMatch(closed.text, /Alpha issue/);
  assert.match(closed.text, /Beta issue/);

  const bogus = await agent.get('/tickets?status=bogus').expect(200);
  assert.match(bogus.text, /Alpha issue/);
  assert.match(bogus.text, /Beta issue/);

  await agent.get(`/tickets/${beta.id}`).expect(200);
});

test('agents cannot open the new-ticket form', async () => {
  const { app, db } = setup();
  const agent = await loginAs(app, makeUser(db, { role: 'agent' }).email);
  await agent.get('/tickets/new').expect(403);
  await agent.post('/tickets/new').type('form').send(validForm).expect(403);
});

test('unknown or non-numeric ticket ids return 404', async () => {
  const { app, db } = setup();
  const agent = await loginAs(app, makeUser(db, { role: 'agent' }).email);
  await agent.get('/tickets/9999').expect(404);
  await agent.get('/tickets/abc').expect(404);
});

test('HTML typed into a ticket is shown as text', async () => {
  const { app, db } = setup();
  const ann = makeUser(db);
  const ticket = makeTicket(db, ann.id, { subject: '<script>alert(1)</script>' });
  const agent = await loginAs(app, ann.email);

  const page = await agent.get(`/tickets/${ticket.id}`).expect(200);
  assert.match(page.text, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(page.text, /<script>alert/);

  const list = await agent.get('/tickets').expect(200);
  assert.doesNotMatch(list.text, /<script>alert/);
});
```

- [ ] **Step 2: รันเทสต์ ต้อง fail**

Run: `node --test tests/tickets.test.js`
Expected: FAIL (`/tickets` ได้ 404 แทน 302 หรือ 200)

- [ ] **Step 3: เขียน `src/routes/tickets.js`**

```js
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
```

- [ ] **Step 4: mount router ใน `src/app.js`**

เพิ่มบรรทัด require ต่อจาก `const authRoutes = require('./routes/auth');`:
```js
const ticketRoutes = require('./routes/tickets');
```
และเพิ่มบรรทัดนี้ต่อจาก `app.use(authRoutes(db));`:
```js
  app.use('/tickets', ticketRoutes(db));
```

- [ ] **Step 5: เขียน `src/views/tickets/index.ejs`**

```html
<%- include('../partials/header', { title: 'รายการ ticket' }) %>
<div class="page-head">
  <h1><%= currentUser.role === 'agent' ? 'ticket ทั้งหมด' : 'ticket ของฉัน' %></h1>
  <% if (currentUser.role === 'customer') { %>
    <a class="button" href="/tickets/new">+ สร้าง ticket</a>
  <% } %>
</div>
<nav class="filters">
  <a href="/tickets" class="<%= status ? '' : 'active' %>">ทั้งหมด</a>
  <% Object.entries(labels.status).forEach(([value, label]) => { %>
    <a href="/tickets?status=<%= value %>" class="<%= status === value ? 'active' : '' %>"><%= label %></a>
  <% }) %>
</nav>
<% if (tickets.length === 0) { %>
  <p class="empty">ยังไม่มี ticket</p>
<% } else { %>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>หัวข้อ</th>
          <% if (currentUser.role === 'agent') { %><th>ลูกค้า</th><% } %>
          <th>หมวดหมู่</th>
          <th>ความเร่งด่วน</th>
          <th>สถานะ</th>
          <th>อัปเดตล่าสุด</th>
        </tr>
      </thead>
      <tbody>
        <% tickets.forEach((t) => { %>
          <tr>
            <td><%= t.id %></td>
            <td><a href="/tickets/<%= t.id %>"><%= t.subject %></a></td>
            <% if (currentUser.role === 'agent') { %><td><%= t.customer_name %></td><% } %>
            <td><%= labels.category[t.category] %></td>
            <td><%= labels.priority[t.priority] %></td>
            <td><span class="badge status-<%= t.status %>"><%= labels.status[t.status] %></span></td>
            <td><%= labels.formatDate(t.updated_at) %></td>
          </tr>
        <% }) %>
      </tbody>
    </table>
  </div>
<% } %>
<%- include('../partials/footer') %>
```

- [ ] **Step 6: เขียน `src/views/tickets/new.ejs`**

```html
<%- include('../partials/header', { title: 'สร้าง ticket' }) %>
<p><a href="/tickets">← กลับไปหน้ารายการ</a></p>
<section class="card">
  <h1>สร้าง ticket ใหม่</h1>
  <%- include('../partials/errors') %>
  <form method="post" action="/tickets/new">
    <label>หัวข้อ<input name="subject" maxlength="200" required value="<%= values.subject %>"></label>
    <label>รายละเอียด<textarea name="description" rows="6" required><%= values.description %></textarea></label>
    <label>หมวดหมู่
      <select name="category">
        <% Object.entries(labels.category).forEach(([value, label]) => { %>
          <option value="<%= value %>" <%= values.category === value ? 'selected' : '' %>><%= label %></option>
        <% }) %>
      </select>
    </label>
    <label>ความเร่งด่วน
      <select name="priority">
        <% Object.entries(labels.priority).forEach(([value, label]) => { %>
          <option value="<%= value %>" <%= values.priority === value ? 'selected' : '' %>><%= label %></option>
        <% }) %>
      </select>
    </label>
    <button>ส่ง ticket</button>
  </form>
</section>
<%- include('../partials/footer') %>
```

- [ ] **Step 7: เขียน `src/views/tickets/show.ejs`**

```html
<%- include('../partials/header', { title: ticket.subject }) %>
<p><a href="/tickets">← กลับไปหน้ารายการ</a></p>
<article class="card">
  <h1>#<%= ticket.id %> <%= ticket.subject %></h1>
  <p class="meta">
    <span class="badge status-<%= ticket.status %>"><%= labels.status[ticket.status] %></span>
    หมวดหมู่: <%= labels.category[ticket.category] %> ·
    ความเร่งด่วน: <%= labels.priority[ticket.priority] %> ·
    โดย <%= ticket.customer_name %> · <%= labels.formatDate(ticket.created_at) %>
  </p>
  <p class="body"><%= ticket.description %></p>
</article>

<% if (currentUser.role === 'agent') { %>
  <form method="post" action="/tickets/<%= ticket.id %>/status" class="card inline">
    <label>เปลี่ยนสถานะ
      <select name="status">
        <% Object.entries(labels.status).forEach(([value, label]) => { %>
          <option value="<%= value %>" <%= ticket.status === value ? 'selected' : '' %>><%= label %></option>
        <% }) %>
      </select>
    </label>
    <button>บันทึก</button>
  </form>
<% } %>

<h2>บทสนทนา</h2>
<% if (replies.length === 0) { %>
  <p class="empty">ยังไม่มีการตอบกลับ</p>
<% } %>
<% replies.forEach((r) => { %>
  <div class="reply reply-<%= r.author_role %>">
    <p class="meta"><strong><%= r.author_name %></strong> (<%= labels.role[r.author_role] %>) · <%= labels.formatDate(r.created_at) %></p>
    <p class="body"><%= r.body %></p>
  </div>
<% }) %>

<%- include('../partials/errors') %>
<% if (ticket.status === 'closed') { %>
  <p class="notice">ticket นี้ปิดแล้ว หากต้องการความช่วยเหลือเพิ่มเติมกรุณาสร้าง ticket ใหม่</p>
<% } else { %>
  <form method="post" action="/tickets/<%= ticket.id %>/replies" class="card">
    <label>ตอบกลับ<textarea name="body" rows="4" required><%= replyBody %></textarea></label>
    <button>ส่งข้อความ</button>
  </form>
<% } %>
<%- include('../partials/footer') %>
```

- [ ] **Step 8: รันเทสต์ ต้องผ่านทั้งหมด**

Run: `npm test`
Expected: `# fail 0` (models 7 + auth 10 + tickets 9)

- [ ] **Step 9: Commit**

```bash
git add src tests
git commit -m "feat: add ticket list, creation and detail pages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: ตอบกลับ ticket + เปลี่ยนสถานะ

**Files:**
- Modify: `src/routes/tickets.js` (เพิ่ม 2 route ก่อน `return router;`)
- Test: `tests/replies.test.js`

**Interfaces:**
- Consumes: `req.ticket` จาก `router.param('id')`, `renderShow`, `notFound`, `replies.addReply`, `tickets.updateStatus`, `tickets.STATUSES`, `requireRole`
- Produces: `POST /tickets/:id/replies`, `POST /tickets/:id/status`

- [ ] **Step 1: เขียนเทสต์ที่ต้อง fail — `tests/replies.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const tickets = require('../src/models/tickets');
const replies = require('../src/models/replies');
const { setup, makeUser, loginAs } = require('./helpers');

function scenario() {
  const { app, db } = setup();
  const ann = makeUser(db, { name: 'Ann' });
  const staff = makeUser(db, { name: 'Staff', role: 'agent' });
  const ticket = tickets.createTicket(db, {
    customerId: ann.id,
    subject: 'Help',
    description: 'Please',
    category: 'other',
    priority: 'low',
  });
  return { app, db, ann, staff, ticket };
}

test('a customer replies to their own ticket and it stays open', async () => {
  const { app, db, ann, ticket } = scenario();
  const agent = await loginAs(app, ann.email);

  await agent
    .post(`/tickets/${ticket.id}/replies`)
    .type('form')
    .send({ body: 'Any news?' })
    .expect(302)
    .expect('Location', `/tickets/${ticket.id}`);

  const page = await agent.get(`/tickets/${ticket.id}`).expect(200);
  assert.match(page.text, /Any news\?/);
  assert.equal(tickets.findTicketById(db, ticket.id).status, 'open');
});

test('an agent reply moves an open ticket to in_progress', async () => {
  const { app, db, staff, ticket } = scenario();
  const agent = await loginAs(app, staff.email);
  await agent.post(`/tickets/${ticket.id}/replies`).type('form').send({ body: 'On it' }).expect(302);
  assert.equal(tickets.findTicketById(db, ticket.id).status, 'in_progress');
});

test('an empty or whitespace-only reply is rejected', async () => {
  const { app, db, ann, ticket } = scenario();
  const agent = await loginAs(app, ann.email);
  const res = await agent.post(`/tickets/${ticket.id}/replies`).type('form').send({ body: '   ' }).expect(400);
  assert.match(res.text, /กรุณากรอกข้อความ/);
  assert.equal(replies.listReplies(db, ticket.id).length, 0);
});

test('replying to a closed ticket is rejected and the form is hidden', async () => {
  const { app, db, ann, ticket } = scenario();
  tickets.updateStatus(db, ticket.id, 'closed');
  const agent = await loginAs(app, ann.email);

  const res = await agent.post(`/tickets/${ticket.id}/replies`).type('form').send({ body: 'hello?' }).expect(400);
  assert.match(res.text, /ไม่สามารถตอบกลับได้/);
  assert.equal(replies.listReplies(db, ticket.id).length, 0);

  const page = await agent.get(`/tickets/${ticket.id}`).expect(200);
  assert.doesNotMatch(page.text, /name="body"/);
});

test('a customer cannot reply to someone else\'s ticket', async () => {
  const { app, db, ticket } = scenario();
  const bob = makeUser(db);
  const agent = await loginAs(app, bob.email);
  await agent.post(`/tickets/${ticket.id}/replies`).type('form').send({ body: 'hi' }).expect(404);
});

test('HTML in a reply is shown as text', async () => {
  const { app, ann, ticket } = scenario();
  const agent = await loginAs(app, ann.email);
  await agent.post(`/tickets/${ticket.id}/replies`).type('form').send({ body: '<b>bold</b>' }).expect(302);
  const page = await agent.get(`/tickets/${ticket.id}`).expect(200);
  assert.match(page.text, /&lt;b&gt;bold&lt;\/b&gt;/);
});

test('an agent changes status, including reopening a closed ticket', async () => {
  const { app, db, staff, ticket } = scenario();
  const agent = await loginAs(app, staff.email);

  await agent
    .post(`/tickets/${ticket.id}/status`)
    .type('form')
    .send({ status: 'closed' })
    .expect(302)
    .expect('Location', `/tickets/${ticket.id}`);
  assert.equal(tickets.findTicketById(db, ticket.id).status, 'closed');

  await agent.post(`/tickets/${ticket.id}/status`).type('form').send({ status: 'open' }).expect(302);
  assert.equal(tickets.findTicketById(db, ticket.id).status, 'open');
});

test('an invalid status value is rejected', async () => {
  const { app, db, staff, ticket } = scenario();
  const agent = await loginAs(app, staff.email);
  await agent.post(`/tickets/${ticket.id}/status`).type('form').send({ status: 'deleted' }).expect(400);
  assert.equal(tickets.findTicketById(db, ticket.id).status, 'open');
});

test('a customer cannot change status, even on their own ticket', async () => {
  const { app, db, ann, ticket } = scenario();
  const agent = await loginAs(app, ann.email);
  await agent.post(`/tickets/${ticket.id}/status`).type('form').send({ status: 'closed' }).expect(403);
  assert.equal(tickets.findTicketById(db, ticket.id).status, 'open');
});
```

- [ ] **Step 2: รันเทสต์ ต้อง fail**

Run: `node --test tests/replies.test.js`
Expected: FAIL (POST ได้ 404 เพราะยังไม่มี route)

- [ ] **Step 3: เพิ่ม route ใน `src/routes/tickets.js`**

แทรกโค้ดนี้หลัง `router.get('/:id', ...)` และก่อน `return router;`:
```js
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
```

- [ ] **Step 4: รันเทสต์ ต้องผ่านทั้งหมด**

Run: `npm test`
Expected: `# fail 0` (models 7 + auth 10 + tickets 9 + replies 9)

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat: add ticket replies and agent status changes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Seed data + README

**Files:**
- Create: `scripts/seed.js`, `README.md`
- Test: `tests/seed.test.js`

**Interfaces:**
- Consumes: `openDb`, `DEFAULT_DB_PATH`, `users.*`, `tickets.createTicket`, `replies.addReply`
- Produces: `seed(db)` (เรียกซ้ำได้โดยไม่สร้างข้อมูลซ้ำ), `npm run seed`

- [ ] **Step 1: เขียนเทสต์ที่ต้อง fail — `tests/seed.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { openDb } = require('../src/db');
const users = require('../src/models/users');
const { seed } = require('../scripts/seed');

function count(db, table) {
  return db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
}

test('seed creates demo accounts and tickets, and is safe to run twice', () => {
  const db = openDb(':memory:');
  seed(db);
  seed(db);

  assert.equal(count(db, 'users'), 2);
  assert.equal(count(db, 'tickets'), 2);
  assert.equal(count(db, 'replies'), 1);
  assert.equal(users.authenticate(db, 'agent@example.com', 'password123').role, 'agent');
  assert.equal(users.authenticate(db, 'customer@example.com', 'password123').role, 'customer');
});
```

- [ ] **Step 2: รันเทสต์ ต้อง fail**

Run: `node --test tests/seed.test.js`
Expected: FAIL เพราะ `Cannot find module '../scripts/seed'`

- [ ] **Step 3: เขียน `scripts/seed.js`**

```js
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
```

- [ ] **Step 4: รันเทสต์ ต้องผ่านทั้งหมด**

Run: `npm test`
Expected: `# fail 0` (รวม 36 เทสต์)

- [ ] **Step 5: เขียน `README.md`**

````markdown
# Customer Support System

ระบบรับเรื่องและติดตามปัญหาลูกค้า (ticket) แบบง่าย ทำขึ้นเพื่อฝึกใช้ AI ช่วยพัฒนาระบบตั้งแต่ออกแบบจนถึงเขียนโค้ด

## ฟีเจอร์

- **ลูกค้า:** สมัครสมาชิก, เข้าสู่ระบบ, สร้าง ticket, ตอบกลับ และติดตามสถานะ ticket ของตัวเอง
- **เจ้าหน้าที่:** ดู ticket ทั้งหมด, กรองตามสถานะ, ตอบกลับ และเปลี่ยนสถานะ (เปิด → กำลังดำเนินการ → ปิดแล้ว)
- เมื่อเจ้าหน้าที่ตอบ ticket ที่ยังเปิดอยู่ สถานะจะเปลี่ยนเป็น "กำลังดำเนินการ" อัตโนมัติ

## เทคโนโลยี

Node.js 22 · Express 4 · EJS · SQLite (better-sqlite3) · bcrypt · express-session · node:test + supertest

## วิธีติดตั้งและรัน

```bash
npm install
npm run seed     # สร้างบัญชีตัวอย่าง
npm start        # เปิด http://localhost:3000
```

### บัญชีตัวอย่าง

| บทบาท | อีเมล | รหัสผ่าน |
|---|---|---|
| เจ้าหน้าที่ | agent@example.com | password123 |
| ลูกค้า | customer@example.com | password123 |

### ตัวแปรสภาพแวดล้อม

| ชื่อ | ค่าเริ่มต้น | ความหมาย |
|---|---|---|
| `PORT` | `3000` | พอร์ตของเว็บ |
| `DB_PATH` | `data/support.db` | ไฟล์ฐานข้อมูล SQLite |
| `SESSION_SECRET` | ค่าสำหรับทดสอบ | secret สำหรับเซ็น cookie ควรตั้งค่าใหม่เสมอ |

## รันเทสต์

```bash
npm test
```

## โครงสร้างโปรเจกต์

```
src/
  app.js          สร้าง Express app
  server.js       จุดเริ่มรันเซิร์ฟเวอร์
  db.js           เชื่อมต่อฐานข้อมูลและสร้างตาราง
  models/         ฟังก์ชันอ่าน/เขียนข้อมูล users, tickets, replies
  routes/         หน้าเว็บและฟอร์ม
  views/          template EJS
scripts/seed.js   ข้อมูลตัวอย่าง
tests/            เทสต์อัตโนมัติ
docs/superpowers/ spec และแผนการพัฒนา
```

## สิ่งที่ยังไม่ได้ทำ (ต่อยอดได้)

- CSRF token สำหรับฟอร์ม
- แนบไฟล์ / รูปภาพ
- แจ้งเตือนทางอีเมล
- แชทแบบ real-time
- บทบาท Admin และการมอบหมาย ticket
- แบ่งหน้ารายการ ticket
- เก็บ session ในฐานข้อมูล (ตอนนี้ใช้ MemoryStore ทำให้ต้อง login ใหม่ทุกครั้งที่รีสตาร์ทเซิร์ฟเวอร์)
- deploy ขึ้นเซิร์ฟเวอร์จริง
````

- [ ] **Step 6: ลองใช้งานจริงแบบครบ flow**

Run:
```bash
DB_PATH=data/smoke.db npm run seed
DB_PATH=data/smoke.db PORT=3100 node src/server.js &   # background
curl -s -c data/cs.jar -o /dev/null -w '%{http_code} %{redirect_url}\n' \
  -d 'email=agent@example.com&password=password123' localhost:3100/login
curl -s -b data/cs.jar localhost:3100/tickets | grep -o 'เข้าสู่ระบบไม่ได้\|ยอดในใบเสร็จ'
```
Expected: บรรทัดแรกได้ `302 http://localhost:3100/tickets` และบรรทัดต่อมาเห็นหัวข้อ ticket ตัวอย่างทั้ง 2 ใบ จากนั้นหยุดเซิร์ฟเวอร์และลบไฟล์ `data/smoke.db` กับ `data/cs.jar`

- [ ] **Step 7: Commit**

```bash
git add scripts tests README.md
git commit -m "feat: add demo seed data and README

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
