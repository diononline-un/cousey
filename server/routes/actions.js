const express = require('express');
const router = express.Router();
const { getDb } = require('../db/init');
const auth = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  const db = getDb();
  const items = db.prepare(`
    SELECT a.*, u.display_name FROM action_items a
    JOIN users u ON u.id = a.user_id
    ORDER BY a.done ASC, a.created_at DESC
  `).all();
  res.json(items);
});

router.post('/', auth, (req, res) => {
  const { text, checkin_id } = req.body;
  if (!text) return res.status(400).json({ error: 'Text erforderlich' });
  const db = getDb();
  const result = db.prepare('INSERT INTO action_items (user_id, text, checkin_id) VALUES (?, ?, ?)').run(req.user.id, text, checkin_id || null);
  res.json({ id: result.lastInsertRowid });
});

router.put('/:id', auth, (req, res) => {
  const db = getDb();
  const item = db.prepare('SELECT * FROM action_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Nicht gefunden' });
  const newDone = item.done ? 0 : 1;
  db.prepare('UPDATE action_items SET done = ?, done_at = ? WHERE id = ?').run(newDone, newDone ? new Date().toISOString() : null, req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', auth, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM action_items WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
