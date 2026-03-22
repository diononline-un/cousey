const express = require('express');
const router = express.Router();
const { getDb } = require('../db/init');
const auth = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM milestones ORDER BY date ASC').all());
});

router.post('/', auth, (req, res) => {
  const { title, date, icon } = req.body;
  if (!title || !date) return res.status(400).json({ error: 'Titel und Datum erforderlich' });
  const db = getDb();
  const result = db.prepare('INSERT INTO milestones (title, date, icon) VALUES (?, ?, ?)').run(title, date, icon || '❤️');
  res.json({ id: result.lastInsertRowid });
});

router.put('/:id', auth, (req, res) => {
  const db = getDb();
  const ms = db.prepare('SELECT * FROM milestones WHERE id = ?').get(req.params.id);
  if (!ms) return res.status(404).json({ error: 'Nicht gefunden' });
  const { title, date, icon } = req.body;
  db.prepare('UPDATE milestones SET title = ?, date = ?, icon = ? WHERE id = ?').run(
    title || ms.title, date || ms.date, icon !== undefined ? icon : ms.icon, req.params.id
  );
  res.json({ ok: true });
});

router.delete('/:id', auth, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM milestones WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
