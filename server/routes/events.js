const express = require('express');
const router = express.Router();
const { getDb } = require('../db/init');
const auth = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  const db = getDb();
  let query = `SELECT e.*, u.display_name as planned_by_name, di.category
               FROM events e
               LEFT JOIN users u ON u.id = e.planned_by
               LEFT JOIN date_ideas di ON di.id = e.linked_date_idea_id
               WHERE 1=1`;
  const params = [];

  // v2.0: exact date filter
  if (req.query.date) {
    query += ' AND e.date_start = ?';
    params.push(req.query.date);
  } else if (req.query.month && req.query.year) {
    const start = `${req.query.year}-${String(req.query.month).padStart(2, '0')}-01`;
    const endMonth = Number(req.query.month) === 12 ? 1 : Number(req.query.month) + 1;
    const endYear = Number(req.query.month) === 12 ? Number(req.query.year) + 1 : Number(req.query.year);
    const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
    query += ' AND e.date_start >= ? AND e.date_start < ?';
    params.push(start, end);
  }
  query += ' ORDER BY e.date_start ASC';
  res.json(db.prepare(query).all(...params));
});

router.post('/', auth, (req, res) => {
  const { title, date_start, date_end, location, sleepover, activities, linked_date_idea_id, notes } = req.body;
  if (!title || !date_start) return res.status(400).json({ error: 'Titel und Startdatum erforderlich' });
  const db = getDb();
  const result = db.prepare('INSERT INTO events (title, date_start, date_end, location, sleepover, planned_by, activities, linked_date_idea_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    title, date_start, date_end || null, location || null, sleepover || 0, req.user.id, JSON.stringify(activities || []), linked_date_idea_id || null, notes || null
  );
  // v2.0: auto-update linked date idea status
  if (linked_date_idea_id) {
    db.prepare("UPDATE date_ideas SET status = 'planned' WHERE id = ?").run(linked_date_idea_id);
  }
  res.json({ id: result.lastInsertRowid });
});

router.put('/:id', auth, (req, res) => {
  const db = getDb();
  const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Nicht gefunden' });
  const fields = ['title', 'date_start', 'date_end', 'location', 'sleepover', 'activities', 'linked_date_idea_id', 'notes'];
  const updates = [];
  const values = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      values.push(f === 'activities' ? JSON.stringify(req.body[f]) : req.body[f]);
    }
  }
  if (updates.length === 0) return res.status(400).json({ error: 'Keine Aenderungen' });
  values.push(req.params.id);
  db.prepare(`UPDATE events SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  res.json({ ok: true });
});

// v2.0: Complete event + linked date idea
router.put('/:id/complete', auth, (req, res) => {
  const db = getDb();
  const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Not found' });
  db.prepare("UPDATE events SET notes = COALESCE(notes,'') || ' [completed]' WHERE id = ?").run(ev.id);
  if (ev.linked_date_idea_id) {
    db.prepare("UPDATE date_ideas SET status = 'done' WHERE id = ?").run(ev.linked_date_idea_id);
  }
  res.json({ ok: true });
});

router.delete('/:id', auth, (req, res) => {
  const db = getDb();
  const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  // v2.0: reset linked date idea when event is deleted
  if (ev && ev.linked_date_idea_id) {
    db.prepare("UPDATE date_ideas SET status = 'idea' WHERE id = ?").run(ev.linked_date_idea_id);
  }
  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
