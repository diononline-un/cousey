const express = require('express');
const router = express.Router();
const { getDb } = require('../db/init');
const auth = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  const db = getDb();
  let query = 'SELECT d.*, u.display_name as proposed_by_name FROM date_ideas d LEFT JOIN users u ON u.id = d.proposed_by WHERE 1=1';
  const params = [];
  if (req.query.category) { query += ' AND d.category = ?'; params.push(req.query.category); }
  if (req.query.status) { query += ' AND d.status = ?'; params.push(req.query.status); }
  query += ' ORDER BY d.created_at DESC';
  res.json(db.prepare(query).all(...params));
});

router.get('/random', auth, (req, res) => {
  const db = getDb();
  const idea = db.prepare('SELECT * FROM date_ideas WHERE status = ? ORDER BY RANDOM() LIMIT 1').get('idea');
  res.json(idea || null);
});

router.post('/', auth, (req, res) => {
  const { title, description, location, cost, category, indoor_outdoor, wish_level } = req.body;
  if (!title) return res.status(400).json({ error: 'Titel erforderlich' });
  const db = getDb();
  const result = db.prepare('INSERT INTO date_ideas (title, description, location, cost, category, indoor_outdoor, wish_level, proposed_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    title, description || null, location || null, cost || 0, category || 'chill', indoor_outdoor || 'both', wish_level || 3, req.user.id
  );
  res.json({ id: result.lastInsertRowid });
});

router.put('/:id', auth, (req, res) => {
  const db = getDb();
  const idea = db.prepare('SELECT * FROM date_ideas WHERE id = ?').get(req.params.id);
  if (!idea) return res.status(404).json({ error: 'Nicht gefunden' });
  const fields = ['title', 'description', 'location', 'cost', 'category', 'indoor_outdoor', 'wish_level', 'status', 'rating', 'notes'];
  const updates = [];
  const values = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[f]); }
  }
  if (updates.length === 0) return res.status(400).json({ error: 'Keine Änderungen' });
  values.push(req.params.id);
  db.prepare(`UPDATE date_ideas SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  res.json({ ok: true });
});

router.delete('/:id', auth, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM date_ideas WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
