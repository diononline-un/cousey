const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'cousy-secret';

module.exports = (req, res, next) => {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Nicht eingeloggt' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token ungültig' });
  }
};
