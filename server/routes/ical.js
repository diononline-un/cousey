const express = require('express');
const router = express.Router();
const ical = require('ical-generator');
const { getDb } = require('../db/init');

const ICAL_TOKEN = process.env.ICAL_TOKEN || 'cousy-cal-secret';

router.get('/feed', (req, res) => {
  if (req.query.token !== ICAL_TOKEN) return res.status(401).send('Ungültiger Token');

  const db = getDb();
  const events = db.prepare('SELECT * FROM events ORDER BY date_start ASC').all();

  const cal = ical.default({ name: 'CouSy' });
  for (const ev of events) {
    cal.createEvent({
      start: new Date(ev.date_start),
      end: ev.date_end ? new Date(ev.date_end) : new Date(ev.date_start),
      summary: ev.title,
      location: ev.location || undefined,
      description: ev.notes || undefined,
    });
  }

  res.set('Content-Type', 'text/calendar; charset=utf-8');
  res.send(cal.toString());
});

module.exports = router;
