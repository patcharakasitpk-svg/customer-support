# Customer Support System — Design Spec

วันที่: 2026-09-26
สถานะ: รอผู้ใช้ตรวจ

## 1. เป้าหมายและบริบท

- **วัตถุประสงค์:** โปรเจกต์ฝึกการใช้ prompt สั่ง AI ให้จำลองการพัฒนาระบบตั้งแต่เก็บความต้องการจนถึงโค้ดที่รันได้ ไม่มีโจทย์ตายตัว
- **ผู้ตรวจ:** อาจารย์ ซึ่งอาจให้นำขึ้น Git ดังนั้นต้องมี commit ที่แสดงลำดับการพัฒนาอย่างชัดเจน
- **ขอบเขต:** ทำคนเดียว, รันบนเครื่อง local, หน้าเว็บภาษาไทย

### เกณฑ์ความสำเร็จ
1. `git clone` → `npm install` → `npm run seed` → `npm start` แล้วใช้งานได้ที่ `http://localhost:3000`
2. ลูกค้าสมัคร, login, สร้าง ticket, ตอบกลับ และดูสถานะได้
3. เจ้าหน้าที่ login, ดู ticket ทั้งหมด, กรองตามสถานะ, ตอบกลับ และเปลี่ยนสถานะได้
4. `npm test` ผ่านทั้งหมด
5. มี README อธิบายวิธีติดตั้ง บัญชีตัวอย่าง และสิ่งที่ยังไม่ได้ทำ

## 2. เทคโนโลยี

| ส่วน | เลือกใช้ |
|---|---|
| Runtime | Node.js 22 |
| Web framework | Express 4 |
| View | EJS (server-rendered, ฟอร์ม POST → redirect) |
| Database | SQLite ผ่าน `better-sqlite3` |
| Auth | `bcrypt` สำหรับ hash รหัสผ่าน + `express-session` |
| Test | `node:test` + `supertest` (ใช้ SQLite `:memory:`) |

## 3. โครงสร้างโปรเจกต์

```
customer-support/
├── src/
│   ├── app.js              # createApp({ db }) — สร้าง Express app (เทสต์ได้)
│   ├── server.js           # เปิด DB ไฟล์จริงแล้ว listen
│   ├── db.js               # openDb(path) — เชื่อมต่อ + สร้างตาราง
│   ├── labels.js           # แปลง enum → ข้อความภาษาไทย
│   ├── middleware/auth.js  # requireLogin, requireAgent
│   ├── models/
│   │   ├── users.js
│   │   ├── tickets.js
│   │   └── replies.js
│   ├── routes/
│   │   ├── auth.js
│   │   └── tickets.js
│   └── views/              # layout partials + หน้า EJS
├── public/style.css
├── scripts/seed.js
├── tests/
├── package.json
└── README.md
```

แต่ละ model รับ `db` เป็นพารามิเตอร์ และไม่มี state ภายใน เพื่อให้เทสต์โดยใช้ฐานข้อมูลในหน่วยความจำได้

## 4. โมเดลข้อมูล

```sql
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('customer','agent')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE tickets (
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

CREATE TABLE replies (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id  INTEGER NOT NULL REFERENCES tickets(id),
  author_id  INTEGER NOT NULL REFERENCES users(id),
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

ป้ายภาษาไทย:
- category: usage = ปัญหาการใช้งาน, billing = การเงิน, other = อื่น ๆ
- priority: low = ต่ำ, medium = กลาง, high = สูง
- status: open = เปิด, in_progress = กำลังดำเนินการ, closed = ปิดแล้ว

## 5. Routes และสิทธิ์

| Method + Path | สิทธิ์ | พฤติกรรม |
|---|---|---|
| `GET /` | ทุกคน | ถ้า login แล้ว redirect ไป `/tickets` ถ้ายังไม่ login redirect ไป `/login` |
| `GET/POST /register` | ยังไม่ login | สมัคร role = customer เสมอ แล้ว login ให้อัตโนมัติ |
| `GET/POST /login` | ยังไม่ login | ตรวจอีเมลและรหัสผ่าน แล้วสร้าง session |
| `POST /logout` | login แล้ว | ทำลาย session แล้ว redirect ไป `/login` |
| `GET /tickets?status=` | login แล้ว | customer เห็นเฉพาะของตัวเอง agent เห็นทั้งหมด เรียงตาม updated_at ล่าสุด และกรองด้วย status ได้ |
| `GET/POST /tickets/new` | customer | สร้าง ticket (status = open) |
| `GET /tickets/:id` | เจ้าของ ticket หรือ agent | รายละเอียด + replies เรียงตามเวลา |
| `POST /tickets/:id/replies` | เจ้าของ ticket หรือ agent | เพิ่ม reply และอัปเดต updated_at |
| `POST /tickets/:id/status` | agent | เปลี่ยน status เป็นค่าใดก็ได้ใน enum |

### กฎทางธุรกิจ
1. ถ้า agent ตอบ ticket ที่มีสถานะ `open` ระบบจะเปลี่ยนสถานะเป็น `in_progress` อัตโนมัติ
2. ticket ที่ `closed` ตอบกลับไม่ได้ (ตอบ 400 พร้อมข้อความ) และจะไม่แสดงฟอร์มตอบกลับ แต่ agent ยังเปลี่ยนสถานะกลับได้
3. ถ้า customer เข้าถึง ticket ของคนอื่น ระบบจะตอบ **404**
4. ถ้ายังไม่ login แล้วเข้าหน้าที่ต้อง login ระบบจะ redirect ไป `/login`
5. ถ้า customer เรียก route ที่เป็นของ agent เท่านั้น ระบบจะตอบ **403**

## 6. Validation และ Error handling

- ฟอร์มที่ไม่ผ่าน validation จะแสดงหน้าเดิม (status 400) พร้อมรายการ error และค่าที่กรอกไว้
  - register: name ต้องไม่ว่าง, email ต้องถูกรูปแบบ, password อย่างน้อย 8 ตัวอักษร
  - ticket: subject 1–200 ตัวอักษร, description ต้องไม่ว่าง, category และ priority ต้องอยู่ใน enum
  - reply: body ต้องไม่ว่าง
- ถ้าอีเมลซ้ำ จะแสดงข้อความ "อีเมลนี้ถูกใช้แล้ว"
- ถ้า login ผิด จะแสดงข้อความรวม ๆ ว่า "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
- ถ้าเจอ id ที่ไม่มีอยู่หรือไม่ใช่ตัวเลข จะแสดงหน้า 404
- ถ้าเกิด error ที่ไม่คาดคิด จะแสดงหน้า 500 แบบทั่วไป และ log รายละเอียดลง console

### ความปลอดภัย
- SQL แบบ parameterized ทั้งหมด
- EJS ใช้ `<%= %>` ซึ่ง escape HTML อัตโนมัติ
- session cookie ตั้ง `httpOnly` และ `sameSite: 'lax'` และอ่าน secret จาก `SESSION_SECRET` (มีค่า default ไว้ใช้ตอนพัฒนา)
- bcrypt cost 10

## 7. Seed

`npm run seed` จะสร้างบัญชีต่อไปนี้ (ถ้ามีอยู่แล้วจะข้าม):
- agent: `agent@example.com` / `password123`
- customer ตัวอย่าง: `customer@example.com` / `password123` พร้อม ticket ตัวอย่าง 2 ใบ

## 8. การทดสอบ

แต่ละเทสต์สร้าง app ใหม่ที่ใช้ฐานข้อมูล `:memory:` ของตัวเอง ครอบคลุม:
- สมัคร (สำเร็จ / อีเมลซ้ำ / validation), login (สำเร็จ / ผิด), logout
- เข้าหน้าที่ต้อง login โดยยังไม่ login แล้วถูก redirect
- customer สร้าง ticket และเห็นเฉพาะ ticket ของตัวเอง
- customer A เปิด ticket ของ B แล้วได้ 404
- agent เห็น ticket ทั้งหมด และกรองด้วย status ได้
- agent ตอบ ticket ที่ `open` แล้วสถานะกลายเป็น `in_progress`
- customer เปลี่ยน status แล้วได้ 403
- ตอบ ticket ที่ `closed` แล้วได้ 400

## 9. นอกขอบเขต (บันทึกไว้ใน README ว่าเป็นงานต่อยอด)

แนบไฟล์, แจ้งเตือนทางอีเมล, real-time chat, บทบาท Admin, CSRF token, การแบ่งหน้า, deploy ขึ้นเซิร์ฟเวอร์

## 10. ลำดับ commit ที่คาดหวัง

ตั้งค่าโปรเจกต์ → ฐานข้อมูลและ models → auth → tickets → replies และสถานะ → seed และ README (แต่ละขั้นมีเทสต์ของตัวเอง)
