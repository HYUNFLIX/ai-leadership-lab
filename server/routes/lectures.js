const express = require('express');
const { getDb } = require('../db/init');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/lectures (공개 - 메인 페이지에서도 사용)
router.get('/', (req, res) => {
  const db = getDb();
  const lectures = db.prepare('SELECT * FROM lectures ORDER BY date DESC').all();
  res.json(lectures);
});

// GET /api/lectures/:id (공개)
router.get('/:id', (req, res) => {
  const db = getDb();
  const lecture = db.prepare('SELECT * FROM lectures WHERE id = ?').get(req.params.id);
  if (!lecture) return res.status(404).json({ error: '강의를 찾을 수 없습니다.' });
  res.json(lecture);
});

// POST /api/lectures (관리자)
router.post('/', requireAuth, (req, res) => {
  const { date, title, client, client_id, category, participants, amount, status, notes } = req.body;
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO lectures (date, title, client, client_id, category, participants, amount, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(date, title, client, client_id, category || '', participants || 0, amount || 0, status || 'confirmed', notes || '');
  res.json({ id: result.lastInsertRowid, success: true });
});

// PUT /api/lectures/:id (관리자)
router.put('/:id', requireAuth, (req, res) => {
  const { date, title, client, client_id, category, participants, amount, status, notes } = req.body;
  const db = getDb();
  db.prepare(`
    UPDATE lectures SET date = ?, title = ?, client = ?, client_id = ?, category = ?,
      participants = ?, amount = ?, status = ?, notes = ?, updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(date, title, client, client_id, category, participants, amount, status, notes, req.params.id);
  res.json({ success: true });
});

// DELETE /api/lectures/:id (관리자)
router.delete('/:id', requireAuth, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM lectures WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
