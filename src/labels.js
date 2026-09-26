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
