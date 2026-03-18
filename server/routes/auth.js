const express = require('express');
const bcrypt = require('bcrypt');
const { getDb } = require('../db/init');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: '이메일과 비밀번호를 입력해 주세요.' });
  }

  const db = getDb();
  const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get(email);

  if (!admin || !bcrypt.compareSync(password, admin.password)) {
    return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
  }

  req.session.user = { id: admin.id, email: admin.email, name: admin.name, role: admin.role };
  res.json({ success: true, user: { email: admin.email, name: admin.name, role: admin.role } });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (req.session && req.session.user) {
    res.json({ user: req.session.user });
  } else {
    res.status(401).json({ error: '인증되지 않았습니다.' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }

  const { currentPassword, newPassword } = req.body;
  const db = getDb();
  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.session.user.id);

  if (!bcrypt.compareSync(currentPassword, admin.password)) {
    return res.status(400).json({ error: '현재 비밀번호가 올바르지 않습니다.' });
  }

  const hashed = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE admins SET password = ? WHERE id = ?').run(hashed, admin.id);
  res.json({ success: true });
});

module.exports = router;
