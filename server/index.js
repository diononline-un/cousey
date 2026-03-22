const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const { getDb } = require('./db/init');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../dashboard')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/checkins', require('./routes/checkins'));
app.use('/api/actions', require('./routes/actions'));
app.use('/api/dates', require('./routes/dates'));
app.use('/api/events', require('./routes/events'));
app.use('/api/cycle', require('./routes/cycle'));
app.use('/api/watchlist', require('./routes/watchlist'));
app.use('/api/milestones', require('./routes/milestones'));
app.use('/cal', require('./routes/ical'));

// SPA Fallback
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../dashboard/index.html')));

getDb(); // Init DB
app.listen(PORT, '0.0.0.0', () => console.log('CouSy running on port ' + PORT));
