const express = require('express');
const router = express.Router();
const { getDb } = require('../db/init');
const auth = require('../middleware/auth');

const QUESTIONS = [
  { key: 'feeling', label: 'Wie fühlst du dich gerade?', type: 'emoji', category: 'emotional' },
  { key: 'emotional_topic', label: 'Was bewegt dich emotional diese Woche?', type: 'text', category: 'emotional' },
  { key: 'loved', label: 'Was hat dir das Gefühl gegeben, geliebt zu sein?', type: 'text', category: 'emotional' },
  { key: 'connection', label: 'Wie verbunden fühlst du dich mit mir?', type: 'slider', min: 1, max: 10, category: 'emotional' },
  { key: 'physical', label: 'Wie geht es dir körperlich?', type: 'emoji', category: 'physical' },
  { key: 'energy', label: 'Energielevel diese Woche?', type: 'slider', min: 1, max: 10, category: 'physical' },
  { key: 'intimacy', label: 'Zufriedenheit mit unserer Intimität?', type: 'slider', min: 1, max: 10, category: 'physical', optional: true },
  { key: 'satisfaction', label: 'Zufriedenheit in der Beziehung', type: 'slider', min: 1, max: 10, category: 'relationship' },
  { key: 'improve', label: 'Was sollte besser laufen?', type: 'text', category: 'relationship' },
  { key: 'unsaid', label: 'Gibt es etwas, das dich stört, was du noch nicht gesagt hast?', type: 'text', category: 'relationship' },
  { key: 'grateful', label: 'Wofür bist du in unserer Beziehung dankbar?', type: 'text', category: 'relationship' },
  { key: 'request', label: 'Eine konkrete Bitte für nächste Woche', type: 'text', category: 'actions' },
  { key: 'next_topic', label: 'Wichtigstes Thema für nächste Woche', type: 'text', category: 'actions' },
];

function getWeekKey(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getPrevWeekKey(weekKey) {
  const [year, week] = weekKey.split('-W').map(Number);
  if (week === 1) return `${year - 1}-W52`;
  return `${year}-W${String(week - 1).padStart(2, '0')}`;
}

router.get('/questions', auth, (req, res) => {
  res.json(QUESTIONS);
});

router.get('/current-week', auth, (req, res) => {
  res.json({ week_key: getWeekKey(new Date()) });
});

router.post('/', auth, (req, res) => {
  const { week_key, answers } = req.body;
  if (!week_key || !answers) return res.status(400).json({ error: 'week_key und answers erforderlich' });

  const db = getDb();

  // Upsert: delete existing then insert
  const existing = db.prepare('SELECT id FROM checkins WHERE user_id = ? AND week_key = ?').get(req.user.id, week_key);
  if (existing) {
    db.prepare('DELETE FROM checkin_answers WHERE checkin_id = ?').run(existing.id);
    db.prepare('DELETE FROM checkins WHERE id = ?').run(existing.id);
  }

  const checkin = db.prepare('INSERT INTO checkins (user_id, week_key) VALUES (?, ?)').run(req.user.id, week_key);
  const checkinId = checkin.lastInsertRowid;

  const insertAnswer = db.prepare('INSERT INTO checkin_answers (checkin_id, question_key, answer_type, numeric_value, text_value) VALUES (?, ?, ?, ?, ?)');
  for (const a of answers) {
    insertAnswer.run(checkinId, a.question_key, a.answer_type, a.numeric_value ?? null, a.text_value ?? null);
  }

  res.json({ id: checkinId, week_key });
});

router.get('/week/:weekKey', auth, (req, res) => {
  const db = getDb();
  const { weekKey } = req.params;

  // Own checkin
  const own = db.prepare('SELECT * FROM checkins WHERE user_id = ? AND week_key = ?').get(req.user.id, weekKey);
  let ownAnswers = null;
  if (own) {
    ownAnswers = db.prepare('SELECT question_key, answer_type, numeric_value, text_value FROM checkin_answers WHERE checkin_id = ?').all(own.id);
  }

  // Partner checkin
  const partner = db.prepare('SELECT * FROM checkins WHERE user_id != ? AND week_key = ?').get(req.user.id, weekKey);
  let partnerAnswers = null;
  let partnerSubmitted = false;

  if (partner) {
    partnerSubmitted = true;
    // Only reveal if both have submitted (blind mode)
    if (own) {
      partnerAnswers = db.prepare('SELECT question_key, answer_type, numeric_value, text_value FROM checkin_answers WHERE checkin_id = ?').all(partner.id);
    }
  }

  // Previous week hint
  const prevWeekKey = getPrevWeekKey(weekKey);
  const prevOwn = db.prepare('SELECT * FROM checkins WHERE user_id = ? AND week_key = ?').get(req.user.id, prevWeekKey);
  let prevAnswers = null;
  if (prevOwn) {
    prevAnswers = db.prepare('SELECT question_key, answer_type, numeric_value, text_value FROM checkin_answers WHERE checkin_id = ?').all(prevOwn.id);
  }

  res.json({
    own: ownAnswers,
    partner: partnerAnswers ? { submitted: true, answers: partnerAnswers } : (partnerSubmitted ? { submitted: true } : { submitted: false }),
    previous: prevAnswers,
  });
});

router.get('/trends', auth, (req, res) => {
  const db = getDb();
  const numericKeys = ['feeling', 'connection', 'physical', 'energy', 'intimacy', 'satisfaction'];

  const rows = db.prepare(`
    SELECT c.week_key, c.user_id, u.display_name, ca.question_key, ca.numeric_value
    FROM checkins c
    JOIN checkin_answers ca ON ca.checkin_id = c.id
    JOIN users u ON u.id = c.user_id
    WHERE ca.question_key IN (${numericKeys.map(() => '?').join(',')})
    ORDER BY c.week_key ASC
  `).all(...numericKeys);

  // Group by week_key
  const weeks = {};
  for (const row of rows) {
    if (!weeks[row.week_key]) weeks[row.week_key] = {};
    if (!weeks[row.week_key][row.display_name]) weeks[row.week_key][row.display_name] = {};
    weeks[row.week_key][row.display_name][row.question_key] = row.numeric_value;
  }

  res.json({ weeks, keys: numericKeys });
});

module.exports = router;
