const express = require('express');
const router = express.Router();
const { getDb } = require('../db/init');
const auth = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM cycle_entries ORDER BY start_date DESC').all());
});

router.post('/', auth, (req, res) => {
  const { start_date, end_date, notes } = req.body;
  if (!start_date) return res.status(400).json({ error: 'Startdatum erforderlich' });
  const db = getDb();
  const result = db.prepare('INSERT INTO cycle_entries (start_date, end_date, notes) VALUES (?, ?, ?)').run(start_date, end_date || null, notes || null);
  res.json({ id: result.lastInsertRowid });
});

router.put('/:id', auth, (req, res) => {
  const db = getDb();
  const entry = db.prepare('SELECT * FROM cycle_entries WHERE id = ?').get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Nicht gefunden' });
  const { start_date, end_date, notes } = req.body;
  db.prepare('UPDATE cycle_entries SET start_date = ?, end_date = ?, notes = ? WHERE id = ?').run(
    start_date || entry.start_date, end_date !== undefined ? end_date : entry.end_date, notes !== undefined ? notes : entry.notes, req.params.id
  );
  res.json({ ok: true });
});

router.delete('/:id', auth, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM cycle_entries WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Daily logs
router.get('/daily', auth, (req, res) => {
  const db = getDb();

  // v2.0: exact date filter
  if (req.query.date) {
    return res.json(db.prepare('SELECT * FROM cycle_daily WHERE date = ?').all(req.query.date));
  }

  let query = 'SELECT * FROM cycle_daily WHERE 1=1';
  const params = [];
  if (req.query.month && req.query.year) {
    query += ' AND date LIKE ?';
    params.push(`${req.query.year}-${String(req.query.month).padStart(2, '0')}%`);
  }
  query += ' ORDER BY date DESC';
  res.json(db.prepare(query).all(...params));
});

// v2.0: Extended daily log with auto-inference
router.post('/daily', auth, (req, res) => {
  const db = getDb();
  const {
    date, mood, symptoms, intensity, notes, cycle_entry_id,
    flow, cervical_mucus, temperature, energy_level, libido,
    sleep_quality, exercise, skin, cravings
  } = req.body;

  if (!date) return res.status(400).json({ error: 'Datum erforderlich' });

  const isPeriod = flow && flow !== 'none' ? 1 : 0;

  const fields = {
    mood: mood || null,
    symptoms: JSON.stringify(symptoms || []),
    intensity: intensity || 'medium',
    notes: notes || '',
    cycle_entry_id: cycle_entry_id || null,
    flow: flow || null,
    cervical_mucus: cervical_mucus || null,
    temperature: temperature || null,
    energy_level: energy_level || null,
    libido: libido || null,
    sleep_quality: sleep_quality || null,
    exercise: exercise || null,
    skin: JSON.stringify(skin || []),
    cravings: JSON.stringify(cravings || []),
    is_period_day: isPeriod
  };

  const ex = db.prepare('SELECT id FROM cycle_daily WHERE date = ?').get(date);
  if (ex) {
    const sets = Object.keys(fields).map(k => k + ' = ?').join(', ');
    db.prepare('UPDATE cycle_daily SET ' + sets + ' WHERE id = ?').run(...Object.values(fields), ex.id);
  } else {
    const cols = ['date', ...Object.keys(fields)];
    const placeholders = cols.map(() => '?').join(', ');
    db.prepare('INSERT INTO cycle_daily (' + cols.join(', ') + ') VALUES (' + placeholders + ')').run(date, ...Object.values(fields));
  }

  // Auto-inference: manage cycle_entries based on period days
  if (isPeriod) {
    autoLinkCycleEntry(db, date);
  }

  res.json({ ok: true, is_period_day: isPeriod });
});

function autoLinkCycleEntry(db, dateStr) {
  const d = new Date(dateStr);
  const yesterday = new Date(d.getTime() - 86400000).toISOString().split('T')[0];
  const twoDaysAgo = new Date(d.getTime() - 2 * 86400000).toISOString().split('T')[0];

  // Check if yesterday or day before was also a period day (with entry)
  const recent = db.prepare(
    'SELECT cycle_entry_id FROM cycle_daily WHERE date IN (?, ?) AND is_period_day = 1 AND cycle_entry_id IS NOT NULL ORDER BY date DESC LIMIT 1'
  ).get(yesterday, twoDaysAgo);

  if (recent && recent.cycle_entry_id) {
    // Extend existing entry
    db.prepare('UPDATE cycle_daily SET cycle_entry_id = ? WHERE date = ?').run(recent.cycle_entry_id, dateStr);
    db.prepare('UPDATE cycle_entries SET end_date = ? WHERE id = ? AND (end_date IS NULL OR end_date < ?)').run(dateStr, recent.cycle_entry_id, dateStr);
  } else {
    // Start new cycle entry
    const r = db.prepare('INSERT INTO cycle_entries (start_date, end_date) VALUES (?, ?)').run(dateStr, dateStr);
    db.prepare('UPDATE cycle_daily SET cycle_entry_id = ? WHERE date = ?').run(r.lastInsertRowid, dateStr);
  }
}

// v2.0: Enhanced prediction with phases and fertile window
router.get('/predict', auth, (req, res) => {
  const db = getDb();
  const entries = db.prepare('SELECT * FROM cycle_entries WHERE end_date IS NOT NULL ORDER BY start_date DESC LIMIT 12').all();

  if (entries.length < 2) return res.json({ prediction: null, phase: null });

  // Cycle length calculation (weighted: recent cycles count more)
  let totalWeight = 0, weightedCycle = 0, totalDur = 0;
  for (let i = 0; i < entries.length - 1; i++) {
    const cycleLen = (new Date(entries[i].start_date) - new Date(entries[i + 1].start_date)) / 86400000;
    const weight = entries.length - i;
    weightedCycle += cycleLen * weight;
    totalWeight += weight;
  }
  for (const e of entries) totalDur += (new Date(e.end_date) - new Date(e.start_date)) / 86400000 + 1;

  const avgCycle = Math.round(weightedCycle / totalWeight);
  const avgDur = Math.round(totalDur / entries.length);
  const lastStart = new Date(entries[0].start_date);
  const nextPredicted = new Date(lastStart.getTime() + avgCycle * 86400000);

  // Current phase calculation
  const today = new Date();
  const daysSinceLast = Math.floor((today - lastStart) / 86400000);
  let phase, phaseDay;
  if (daysSinceLast < avgDur) {
    phase = 'menstruation';
    phaseDay = daysSinceLast + 1;
  } else if (daysSinceLast < Math.round(avgCycle * 0.4)) {
    phase = 'follikulaer';
    phaseDay = daysSinceLast - avgDur + 1;
  } else if (daysSinceLast < Math.round(avgCycle * 0.5)) {
    phase = 'ovulation';
    phaseDay = daysSinceLast - Math.round(avgCycle * 0.4) + 1;
  } else {
    phase = 'luteal';
    phaseDay = daysSinceLast - Math.round(avgCycle * 0.5) + 1;
  }

  // Fertile window estimate (5 days before ovulation + ovulation day)
  const ovulationDay = Math.round(avgCycle * 0.45);
  const fertileStart = new Date(lastStart.getTime() + (ovulationDay - 5) * 86400000);
  const fertileEnd = new Date(lastStart.getTime() + ovulationDay * 86400000);

  res.json({
    avg_cycle: avgCycle,
    avg_duration: avgDur,
    last_start: entries[0].start_date,
    next_predicted: nextPredicted.toISOString().split('T')[0],
    current_phase: phase,
    phase_day: phaseDay,
    cycle_day: daysSinceLast + 1,
    fertile_window: {
      start: fertileStart.toISOString().split('T')[0],
      end: fertileEnd.toISOString().split('T')[0]
    },
    total_logged_cycles: entries.length
  });
});

module.exports = router;
