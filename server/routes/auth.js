const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getDb } = require('../db/init');
const auth = require('../middleware/auth');

const SECRET = process.env.JWT_SECRET || 'cousy-secret';

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username und Passwort erforderlich' });

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
  }

  const token = jwt.sign({ id: user.id, username: user.username, display_name: user.display_name }, SECRET, { expiresIn: '30d' });
  res.cookie('token', token, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000, sameSite: 'lax' });
  res.json({ user: { id: user.id, username: user.username, display_name: user.display_name }, token });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

router.get('/verify', auth, (req, res) => {
  res.json({ user: req.user });
});

router.put('/password', auth, (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) return res.status(400).json({ error: 'Beide Passwörter erforderlich' });

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(current_password, user.password_hash)) {
    return res.status(401).json({ error: 'Aktuelles Passwort falsch' });
  }

  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ ok: true });
});

module.exports = router;
