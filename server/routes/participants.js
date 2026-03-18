const express = require('express');
const { getDb } = require('../db/init');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// === 공개 API (신청/조회) ===

// GET /api/participants/settings
router.get('/settings', (req, res) => {
  const db = getDb();
  const setting = db.prepare("SELECT value FROM settings WHERE key = 'registration_closed'").get();
  res.json({ closed: setting ? setting.value === 'true' : false });
});

// POST /api/participants/register
router.post('/register', (req, res) => {
  const { name, phone, email } = req.body;
  if (!name || !phone || !email) {
    return res.status(400).json({ error: '모든 필드를 입력해 주세요.' });
  }

  const db = getDb();

  // 마감 여부 체크
  const setting = db.prepare("SELECT value FROM settings WHERE key = 'registration_closed'").get();
  if (setting && setting.value === 'true') {
    return res.status(400).json({ error: '신청이 마감되었습니다.' });
  }

  // 중복 체크
  const normalizedPhone = phone.replace(/[^0-9]/g, '');
  const existing = db.prepare('SELECT id FROM participants WHERE name = ? AND phone = ?').get(name, normalizedPhone);
  if (existing) {
    return res.status(409).json({ error: '이미 동일한 이름과 전화번호로 신청된 내역이 있습니다.' });
  }

  const result = db.prepare('INSERT INTO participants (name, phone, email, status) VALUES (?, ?, ?, ?)').run(name, normalizedPhone, email, 'confirmed');
  res.json({ id: result.lastInsertRowid, success: true });
});

// POST /api/participants/check
router.post('/check', (req, res) => {
  const { name, phone } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: '이름과 전화번호를 입력해 주세요.' });
  }

  const db = getDb();
  const normalizedPhone = phone.replace(/[^0-9]/g, '');
  const participant = db.prepare('SELECT * FROM participants WHERE name = ? AND phone = ?').get(name, normalizedPhone);

  if (!participant) {
    return res.json({ found: false });
  }

  res.json({ found: true, data: participant });
});

// PUT /api/participants/:id (공개 - 본인 수정)
router.put('/:id', (req, res) => {
  const { name, phone, email } = req.body;
  const db = getDb();
  const normalizedPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
  db.prepare('UPDATE participants SET name = ?, phone = ?, email = ? WHERE id = ?').run(name, normalizedPhone, email, req.params.id);
  res.json({ success: true });
});

// DELETE /api/participants/:id (공개 - 본인 취소)
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM participants WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// === 관리자 API ===

// GET /api/participants (관리자 - 전체 목록)
router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const participants = db.prepare('SELECT * FROM participants ORDER BY created_at DESC').all();
  res.json(participants);
});

// PUT /api/participants/:id/admin (관리자 수정)
router.put('/:id/admin', requireAuth, (req, res) => {
  const { name, phone, email, status } = req.body;
  const db = getDb();
  const normalizedPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
  db.prepare('UPDATE participants SET name = ?, phone = ?, email = ?, status = ? WHERE id = ?').run(name, normalizedPhone, email, status, req.params.id);
  res.json({ success: true });
});

// DELETE /api/participants/:id/admin (관리자 삭제)
router.delete('/:id/admin', requireAuth, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM participants WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// PUT /api/participants/settings/registration
router.put('/settings/registration', requireAuth, (req, res) => {
  const { closed } = req.body;
  const db = getDb();
  db.prepare("UPDATE settings SET value = ? WHERE key = 'registration_closed'").run(closed ? 'true' : 'false');
  res.json({ success: true });
});

module.exports = router;
