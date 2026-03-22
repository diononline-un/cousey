const express = require('express');
const router = express.Router();
const { getDb } = require('../db/init');
const auth = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  const db = getDb();
  let query = 'SELECT w.*, u.display_name as added_by_name FROM watchlist w LEFT JOIN users u ON u.id = w.added_by WHERE 1=1';
  const params = [];
  if (req.query.type) { query += ' AND w.type = ?'; params.push(req.query.type); }
  if (req.query.status) { query += ' AND w.status = ?'; params.push(req.query.status); }
  query += ' ORDER BY w.created_at DESC';
  res.json(db.prepare(query).all(...params));
});

router.post('/', auth, (req, res) => {
  const { title, type, platform, notes } = req.body;
  if (!title) return res.status(400).json({ error: 'Titel erforderlich' });
  const db = getDb();
  const result = db.prepare('INSERT INTO watchlist (title, type, platform, notes, added_by) VALUES (?, ?, ?, ?, ?)').run(
    title, type || 'movie', platform || null, notes || null, req.user.id
  );
  res.json({ id: result.lastInsertRowid });
});

router.put('/:id', auth, (req, res) => {
  const db = getDb();
  const item = db.prepare('SELECT * FROM watchlist WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Nicht gefunden' });
  const fields = ['title', 'type', 'platform', 'status', 'rating_dion', 'rating_linda', 'notes'];
  const updates = [];
  const values = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[f]); }
  }
  if (updates.length === 0) return res.status(400).json({ error: 'Keine Änderungen' });
  values.push(req.params.id);
  db.prepare(`UPDATE watchlist SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  res.json({ ok: true });
});

router.delete('/:id', auth, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM watchlist WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
