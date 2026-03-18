const express = require('express');
const { getDb } = require('../db/init');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/clients
router.get('/', (req, res) => {
  const db = getDb();
  const clients = db.prepare('SELECT * FROM clients ORDER BY updated_at DESC').all();
  // interest를 JSON 파싱
  const result = clients.map(c => ({ ...c, interest: JSON.parse(c.interest || '[]') }));
  res.json(result);
});

// GET /api/clients/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: '고객을 찾을 수 없습니다.' });
  client.interest = JSON.parse(client.interest || '[]');
  res.json(client);
});

// POST /api/clients
router.post('/', (req, res) => {
  const { company, contact_name, phone, email, status, interest, contract_amount, notes } = req.body;
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO clients (company, contact_name, phone, email, status, interest, contract_amount, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(company, contact_name, phone, email, status || 'lead', JSON.stringify(interest || []), contract_amount || 0, notes || '');
  res.json({ id: result.lastInsertRowid, success: true });
});

// PUT /api/clients/:id
router.put('/:id', (req, res) => {
  const { company, contact_name, phone, email, status, interest, contract_amount, notes } = req.body;
  const db = getDb();
  db.prepare(`
    UPDATE clients SET company = ?, contact_name = ?, phone = ?, email = ?, status = ?,
      interest = ?, contract_amount = ?, notes = ?, updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(company, contact_name, phone, email, status, JSON.stringify(interest || []), contract_amount || 0, notes || '', req.params.id);
  res.json({ success: true });
});

// PATCH /api/clients/:id/status
router.patch('/:id/status', (req, res) => {
  const { status } = req.body;
  const db = getDb();
  db.prepare("UPDATE clients SET status = ?, updated_at = datetime('now', 'localtime') WHERE id = ?").run(status, req.params.id);
  res.json({ success: true });
});

// DELETE /api/clients/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// === Client History ===

// GET /api/clients/:id/history
router.get('/:id/history', (req, res) => {
  const db = getDb();
  const history = db.prepare('SELECT * FROM client_history WHERE client_id = ? ORDER BY date DESC').all(req.params.id);
  res.json(history);
});

// POST /api/clients/:id/history
router.post('/:id/history', (req, res) => {
  const { type, date, content } = req.body;
  const db = getDb();
  const result = db.prepare('INSERT INTO client_history (client_id, type, date, content) VALUES (?, ?, ?, ?)').run(req.params.id, type, date, content);
  res.json({ id: result.lastInsertRowid, success: true });
});

// DELETE /api/clients/:clientId/history/:historyId
router.delete('/:clientId/history/:historyId', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM client_history WHERE id = ? AND client_id = ?').run(req.params.historyId, req.params.clientId);
  res.json({ success: true });
});

module.exports = router;
