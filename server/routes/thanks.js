const express = require('express');
const { getDb } = require('../db/init');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// === 공개 API ===

// GET /api/thanks/names (워드클라우드용)
router.get('/names', (req, res) => {
  const db = getDb();
  const names = db.prepare('SELECT * FROM thanks_names ORDER BY created_at DESC').all();
  res.json(names);
});

// POST /api/thanks/requests (이름 등록 요청)
router.post('/requests', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: '이름을 입력해 주세요.' });
  }

  const db = getDb();
  const result = db.prepare('INSERT INTO thanks_requests (name, status) VALUES (?, ?)').run(name.trim(), 'pending');
  res.json({ id: result.lastInsertRowid, success: true });
});

// === 관리자 API ===

// POST /api/thanks/names (관리자 - 이름 추가)
router.post('/names', requireAuth, (req, res) => {
  const { name, category, message } = req.body;
  if (!name) return res.status(400).json({ error: '이름을 입력해 주세요.' });

  const db = getDb();
  const result = db.prepare('INSERT INTO thanks_names (name, category, message) VALUES (?, ?, ?)').run(name, category || 'other', message || '');
  res.json({ id: result.lastInsertRowid, success: true });
});

// POST /api/thanks/names/bulk (관리자 - 여러 이름 추가)
router.post('/names/bulk', requireAuth, (req, res) => {
  const { names } = req.body;
  if (!names || !Array.isArray(names)) {
    return res.status(400).json({ error: '이름 목록을 입력해 주세요.' });
  }

  const db = getDb();
  const insert = db.prepare('INSERT INTO thanks_names (name, category, message) VALUES (?, ?, ?)');
  const insertMany = db.transaction((list) => {
    for (const n of list) {
      insert.run(typeof n === 'string' ? n : n.name, n.category || 'other', n.message || '');
    }
  });
  insertMany(names);
  res.json({ success: true, count: names.length });
});

// DELETE /api/thanks/names/:id (관리자)
router.delete('/names/:id', requireAuth, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM thanks_names WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// DELETE /api/thanks/names (관리자 - 전체 삭제)
router.delete('/names', requireAuth, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM thanks_names').run();
  res.json({ success: true });
});

// POST /api/thanks/names/import (관리자 - JSON import)
router.post('/names/import', requireAuth, (req, res) => {
  const { data } = req.body;
  if (!data || !Array.isArray(data)) {
    return res.status(400).json({ error: '유효한 데이터를 입력해 주세요.' });
  }

  const db = getDb();
  db.prepare('DELETE FROM thanks_names').run();
  const insert = db.prepare('INSERT INTO thanks_names (name, category, message, created_at) VALUES (?, ?, ?, ?)');
  const importAll = db.transaction((list) => {
    for (const item of list) {
      insert.run(item.name, item.category || 'other', item.message || '', item.createdAt || new Date().toISOString());
    }
  });
  importAll(data);
  res.json({ success: true, count: data.length });
});

// GET /api/thanks/requests (관리자 - 요청 목록)
router.get('/requests', requireAuth, (req, res) => {
  const db = getDb();
  const requests = db.prepare('SELECT * FROM thanks_requests ORDER BY created_at DESC').all();
  res.json(requests);
});

// POST /api/thanks/requests/:id/approve (관리자 - 승인)
router.post('/requests/:id/approve', requireAuth, (req, res) => {
  const db = getDb();
  const request = db.prepare('SELECT * FROM thanks_requests WHERE id = ?').get(req.params.id);
  if (!request) return res.status(404).json({ error: '요청을 찾을 수 없습니다.' });

  // 이름 추가
  db.prepare('INSERT INTO thanks_names (name, category) VALUES (?, ?)').run(request.name, 'other');
  // 요청 삭제
  db.prepare('DELETE FROM thanks_requests WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// DELETE /api/thanks/requests/:id (관리자 - 거절/삭제)
router.delete('/requests/:id', requireAuth, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM thanks_requests WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
