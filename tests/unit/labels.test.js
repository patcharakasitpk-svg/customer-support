const test = require('node:test');
const assert = require('node:assert/strict');
const labels = require('../../src/labels');
const { CATEGORIES, PRIORITIES, STATUSES } = require('../../src/models/tickets');

test('every stored value has a Thai label', () => {
  assert.deepEqual(Object.keys(labels.category), CATEGORIES);
  assert.deepEqual(Object.keys(labels.priority), PRIORITIES);
  assert.deepEqual(Object.keys(labels.status), STATUSES);
  assert.deepEqual(Object.keys(labels.role), ['customer', 'agent']);
});

test('labels use the agreed Thai wording', () => {
  assert.equal(labels.status.open, 'เปิด');
  assert.equal(labels.status.in_progress, 'กำลังดำเนินการ');
  assert.equal(labels.status.closed, 'ปิดแล้ว');
  assert.equal(labels.category.billing, 'การเงิน');
  assert.equal(labels.priority.high, 'สูง');
  assert.equal(labels.role.agent, 'เจ้าหน้าที่');
});

test('formatDate converts SQLite UTC time to Bangkok time (UTC+7)', () => {
  assert.equal(labels.formatDate('2026-09-26 03:00:00'), '26 ก.ย. 2569 10:00');
});

test('formatDate rolls over to the next day and year in Bangkok', () => {
  assert.equal(labels.formatDate('2026-09-26 20:30:00'), '27 ก.ย. 2569 03:30');
  assert.equal(labels.formatDate('2026-12-31 18:00:00'), '1 ม.ค. 2570 01:00');
});
