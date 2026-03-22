const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

let db;

function getDb() {
  if (db) return db;

  const dbPath = path.join(__dirname, '../../data/db/cousy.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      week_key TEXT NOT NULL,
      submitted_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, week_key)
    );

    CREATE TABLE IF NOT EXISTS checkin_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checkin_id INTEGER NOT NULL,
      question_key TEXT NOT NULL,
      answer_type TEXT NOT NULL,
      numeric_value REAL,
      text_value TEXT,
      FOREIGN KEY (checkin_id) REFERENCES checkins(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS action_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checkin_id INTEGER,
      user_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      done INTEGER DEFAULT 0,
      done_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS date_ideas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      location TEXT,
      cost REAL DEFAULT 0,
      category TEXT DEFAULT 'chill',
      indoor_outdoor TEXT DEFAULT 'both',
      wish_level INTEGER DEFAULT 3,
      proposed_by INTEGER,
      status TEXT DEFAULT 'idea',
      rating REAL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (proposed_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      date_start TEXT NOT NULL,
      date_end TEXT,
      location TEXT,
      sleepover INTEGER DEFAULT 0,
      planned_by INTEGER,
      activities TEXT DEFAULT '[]',
      linked_date_idea_id INTEGER,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (planned_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS cycle_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_date TEXT NOT NULL,
      end_date TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cycle_daily (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_entry_id INTEGER,
      date TEXT NOT NULL UNIQUE,
      mood INTEGER,
      symptoms TEXT DEFAULT '[]',
      intensity TEXT DEFAULT 'medium',
      notes TEXT,
      FOREIGN KEY (cycle_entry_id) REFERENCES cycle_entries(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS watchlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      type TEXT DEFAULT 'movie',
      platform TEXT,
      status TEXT DEFAULT 'want',
      rating_dion REAL,
      rating_linda REAL,
      notes TEXT,
      added_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (added_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      icon TEXT DEFAULT '❤️',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // v2.0: Safe column additions for cycle_daily
  const cols = db.prepare("PRAGMA table_info('cycle_daily')").all().map(c => c.name);
  if (!cols.includes('flow')) db.exec("ALTER TABLE cycle_daily ADD COLUMN flow TEXT DEFAULT NULL");
  if (!cols.includes('cervical_mucus')) db.exec("ALTER TABLE cycle_daily ADD COLUMN cervical_mucus TEXT DEFAULT NULL");
  if (!cols.includes('temperature')) db.exec("ALTER TABLE cycle_daily ADD COLUMN temperature REAL DEFAULT NULL");
  if (!cols.includes('energy_level')) db.exec("ALTER TABLE cycle_daily ADD COLUMN energy_level INTEGER DEFAULT NULL");
  if (!cols.includes('libido')) db.exec("ALTER TABLE cycle_daily ADD COLUMN libido INTEGER DEFAULT NULL");
  if (!cols.includes('sleep_quality')) db.exec("ALTER TABLE cycle_daily ADD COLUMN sleep_quality INTEGER DEFAULT NULL");
  if (!cols.includes('exercise')) db.exec("ALTER TABLE cycle_daily ADD COLUMN exercise TEXT DEFAULT NULL");
  if (!cols.includes('skin')) db.exec("ALTER TABLE cycle_daily ADD COLUMN skin TEXT DEFAULT '[]'");
  if (!cols.includes('cravings')) db.exec("ALTER TABLE cycle_daily ADD COLUMN cravings TEXT DEFAULT '[]'");
  if (!cols.includes('is_period_day')) db.exec("ALTER TABLE cycle_daily ADD COLUMN is_period_day INTEGER DEFAULT 0");

  // Seed users if empty
  const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (count === 0) {
    const hash = bcrypt.hashSync('cousy2026', 10);
    const insert = db.prepare('INSERT INTO users (username, display_name, password_hash) VALUES (?, ?, ?)');
    insert.run('dion', 'Dion', hash);
    insert.run('linda', 'Linda', hash);
  }

  return db;
}

module.exports = { getDb };
