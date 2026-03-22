# implementation-plan.md


# CouSy v2.0 — Complete Build Prompt for Claude Code

> **Ziel:** Baue die CouSy Couple-App komplett from scratch. Node.js Backend, Vanilla JS Frontend, SQLite DB, Docker-Deployment auf Unraid. Mobile-first, flat, clean UI — kein AI-Dashboard-Look.

---

## 1. Projekt-Überblick

**CouSy** (Couple Sync) ist eine private Beziehungs-App für zwei Personen (Dion + Linda). Sie läuft als Docker-Container auf einem Unraid-NAS und wird primär über Smartphone (PWA / Add-to-Homescreen) genutzt.

### Kern-Features:
1. **Weekly Check-In** — 13 Fragen (Emoji, Slider, Freitext) mit Blind-Modus
2. **Trends** — Chart.js Linien-/Balkendiagramme über Zeit
3. **Date-Ideen Board** — Sammlung + Random-Picker + Status-Tracking
4. **Wochenplaner / Kalender** — Monatskalender mit Events + iCal-Feed
5. **Zyklus-Tracker** — Perioden-Einträge, Daily Logging, Prognose
6. **Watchlist** — Filme/Serien mit Status + individuelle Bewertungen
7. **Milestones** — Relationship-Meilensteine mit Tage-Counter

---

## 2. Tech Stack

| Komponente | Technologie |
| --- | --- |
| Runtime | Node.js 20 |
| Framework | Express 4 |
| Datenbank | better-sqlite3 (SQLite, WAL-Mode) |
| Frontend | Vanilla JS SPA (kein Build-Step, kein Framework) |
| Styling | Vanilla CSS (kein Tailwind, kein Framework) |
| Charts | Chart.js 4 (via CDN) |
| Auth | JWT (jsonwebtoken), bcryptjs, HttpOnly Cookie (30d) |
| Container | Docker (node:20-alpine) + docker-compose |
| PWA | manifest.json + meta-Tags für Add-to-Homescreen |

**Keine externen Dependencies außer:** express, cookie-parser, better-sqlite3, jsonwebtoken, bcryptjs, ical-generator, chart.js (CDN).

---

## 3. Dateistruktur

```
cousy/
  Dockerfile
  docker-compose.yml
  package.json
  .env.example
  HANDOVER.md
  dashboard/
    index.html            # SPA Entry Point + PWA Meta
    manifest.json         # PWA Manifest
    icons/
      icon-192.png
      icon-512.png
    css/
      style.css           # Komplettes Styling
    js/
      app.js              # Komplette SPA-Logik
  server/
    index.js              # Express Entry + Static Serving
    middleware/
      auth.js             # JWT-Middleware
    db/
      init.js             # SQLite Schema + User Seeding
    routes/
      auth.js             # Login/Logout/Verify/Password
      checkins.js         # Weekly Check-In + Trends
      actions.js          # Action Items
      dates.js            # Date Ideas + Random
      events.js           # Wochenplaner
      ical.js             # iCal-Feed
      cycle.js            # Zyklus-Tracker + Prediction
      watchlist.js        # Film/Serien Watchlist
      milestones.js       # Milestones
  data/
    db/                   # SQLite DB (auto-created, Volume-mounted)
```

---

## 4. Datenbank-Schema (SQLite)

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE checkins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  week_key TEXT NOT NULL,          -- Format: "2026-W12"
  submitted_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, week_key)
);

CREATE TABLE checkin_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  checkin_id INTEGER NOT NULL,
  question_key TEXT NOT NULL,      -- z.B. "feeling", "connection", "improve"
  answer_type TEXT NOT NULL,       -- "emoji", "slider", "text"
  numeric_value REAL,              -- für Emoji (1-5) und Slider (1-10)
  text_value TEXT,                 -- für Freitext
  FOREIGN KEY (checkin_id) REFERENCES checkins(id) ON DELETE CASCADE
);

CREATE TABLE action_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  checkin_id INTEGER,
  user_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  done INTEGER DEFAULT 0,
  done_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE date_ideas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  cost REAL DEFAULT 0,
  category TEXT DEFAULT 'chill',   -- chill, adventure, romantic, food, culture
  indoor_outdoor TEXT DEFAULT 'both',
  wish_level INTEGER DEFAULT 3,    -- 1-5 Sterne
  proposed_by INTEGER,
  status TEXT DEFAULT 'idea',      -- idea, planned, done, again
  rating REAL,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (proposed_by) REFERENCES users(id)
);

CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  date_start TEXT NOT NULL,
  date_end TEXT,
  location TEXT,
  sleepover INTEGER DEFAULT 0,
  planned_by INTEGER,
  activities TEXT DEFAULT '[]',    -- JSON Array
  linked_date_idea_id INTEGER,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (planned_by) REFERENCES users(id)
);

CREATE TABLE cycle_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  start_date TEXT NOT NULL,
  end_date TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE cycle_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_entry_id INTEGER,
  date TEXT NOT NULL UNIQUE,
  mood INTEGER,                    -- 1-5
  symptoms TEXT DEFAULT '[]',      -- JSON Array
  intensity TEXT DEFAULT 'medium', -- light, medium, heavy
  notes TEXT,
  FOREIGN KEY (cycle_entry_id) REFERENCES cycle_entries(id) ON DELETE CASCADE
);

CREATE TABLE watchlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  type TEXT DEFAULT 'movie',       -- movie, series, docu
  platform TEXT,
  status TEXT DEFAULT 'want',      -- want, watching, watched
  rating_dion REAL,
  rating_linda REAL,
  notes TEXT,
  added_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (added_by) REFERENCES users(id)
);

CREATE TABLE milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  icon TEXT DEFAULT '❤️',
  created_at TEXT DEFAULT (datetime('now'))
);
```

### User-Seeding bei erster Initialisierung:
```javascript
// Wenn users-Tabelle leer ist:
// User "dion" (Display: "Dion") mit Passwort "cousy2026"
// User "linda" (Display: "Linda") mit Passwort "cousy2026"
```

---

## 5. API-Endpoints

Alle `/api/*` Routen sind JWT-geschützt (außer `/api/auth/login`).
Auth via HttpOnly Cookie `token`.

### Auth
| Method | Path | Beschreibung |
| --- | --- | --- |
| POST | `/api/auth/login` | Login → setzt Cookie + gibt Token zurück |
| POST | `/api/auth/logout` | Löscht Cookie |
| GET | `/api/auth/verify` | Gibt aktuellen User zurück |
| PUT | `/api/auth/password` | Passwort ändern (current_password + new_password) |

### Check-Ins
| Method | Path | Beschreibung |
| --- | --- | --- |
| GET | `/api/checkins/questions` | Gibt die 13 Fragen-Definition zurück |
| GET | `/api/checkins/current-week` | Gibt aktuelle `week_key` zurück (ISO-Woche) |
| POST | `/api/checkins` | Speichert Check-In (upsert per user+week) |
| GET | `/api/checkins/week/:weekKey` | Holt eigene + Partner-Antworten (Blind-Modus!) |
| GET | `/api/checkins/trends` | Aggregierte Daten für Charts |

#### Blind-Modus-Logik:
- Partner-Antworten werden **nur** zurückgegeben, wenn **beide** für die Woche submitted haben
- Wenn nur Partner submitted hat: `{ submitted: true }` (ohne Antworten)
- Previous-Week-Hint: eigene Antworten der Vorwoche als Referenz

#### Die 13 Fragen:
```javascript
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
```

### Actions
| Method | Path | Beschreibung |
| --- | --- | --- |
| GET | `/api/actions` | Alle Action Items (sortiert: offen zuerst) |
| POST | `/api/actions` | Neues Action Item |
| PUT | `/api/actions/:id` | Toggle done/undone |
| DELETE | `/api/actions/:id` | Löschen |

### Date Ideas
| Method | Path | Beschreibung |
| --- | --- | --- |
| GET | `/api/dates` | Alle, optional `?category=` und `?status=` Filter |
| GET | `/api/dates/random` | Zufällige Idee (aus status=idea) |
| POST | `/api/dates` | Neue Idee |
| PUT | `/api/dates/:id` | Aktualisieren |
| DELETE | `/api/dates/:id` | Löschen |

### Events (Wochenplaner)
| Method | Path | Beschreibung |
| --- | --- | --- |
| GET | `/api/events` | Alle, optional `?month=&year=` Filter |
| POST | `/api/events` | Neues Event |
| PUT | `/api/events/:id` | Aktualisieren |
| DELETE | `/api/events/:id` | Löschen |

### Cycle (Zyklus-Tracker)
| Method | Path | Beschreibung |
| --- | --- | --- |
| GET | `/api/cycle` | Alle Perioden-Einträge (DESC) |
| POST | `/api/cycle` | Neuer Eintrag |
| PUT | `/api/cycle/:id` | Aktualisieren |
| DELETE | `/api/cycle/:id` | Löschen |
| GET | `/api/cycle/daily` | Daily Logs, optional `?month=&year=` |
| POST | `/api/cycle/daily` | Daily Log upsert (per Datum) |
| GET | `/api/cycle/predict` | Prognose basierend auf letzten 6 Zyklen |

#### Prognose-Algorithmus:
- Letzte 6 abgeschlossene Zyklen (mit end_date)
- Durchschnittliche Zykluslänge (Tage zwischen start_dates)
- Durchschnittliche Periodendauer
- Nächste Periode = letzter start_date + avg_cycle_length

### Watchlist
| Method | Path | Beschreibung |
| --- | --- | --- |
| GET | `/api/watchlist` | Alle, optional `?type=&status=` Filter |
| POST | `/api/watchlist` | Neuer Eintrag |
| PUT | `/api/watchlist/:id` | Aktualisieren |
| DELETE | `/api/watchlist/:id` | Löschen |

### Milestones
| Method | Path | Beschreibung |
| --- | --- | --- |
| GET | `/api/milestones` | Alle |
| POST | `/api/milestones` | Neuer Milestone |
| PUT | `/api/milestones/:id` | Aktualisieren |
| DELETE | `/api/milestones/:id` | Löschen |

### iCal Feed
| Method | Path | Beschreibung |
| --- | --- | --- |
| GET | `/cal/feed?token=TOKEN` | iCal-Feed für Google Calendar Abo |

Token wird via `ICAL_TOKEN` env-Variable gesetzt. Enthält alle Events.

---

## 6. Frontend-Architektur (SPA)

### Grundstruktur:
- **Single ****`index.html`** mit allen Screens
- **Ein ****`app.js`** mit aller Logik (kein Module-Bundler)
- **Ein ****`style.css`** mit allem Styling
- Login-Screen + Main-App-Screen (Toggle via JS)
- Bottom Navigation mit 7 Tabs
- Content-Bereich rendert Views dynamisch
- Modals slideen von unten rein (Bottom-Sheet-Style)

### Navigation (Bottom-Bar, 7 Tabs):
1. **Home** — Milestone-Counter, offene Actions, nächste Events
2. **Check-In** — Wöchentlicher Fragebogen mit Progress-Bar
3. **Trends** — Charts (Zufriedenheit, Verbundenheit, Energie)
4. **Dates** — Date-Ideen Grid mit Filter + Random-Picker
5. **Planer** — Monatskalender + Events
6. **Zyklus** — Perioden-Tracker mit Kalender-Overlay
7. **Watch** — Film/Serien-Watchlist

### Key UI-Patterns:
- **Emoji-Picker:** 5 Emojis (😢😕😐🙂😊) als Buttons für Stimmung
- **Slider:** Range-Input 1-10 mit großer Zahl-Anzeige
- **Category Tabs:** Horizontal scrollbare Filter-Chips
- **Cards:** Einfache Container für Einträge
- **Bottom-Sheet Modal:** Für alle Create/Edit-Formulare
- **Calendar Grid:** 7×N Grid mit Dot-Indikatoren
- **Progress Bar:** Für Check-In-Fortschritt
- **Comparison View:** Seite-an-Seite wenn beide submitted haben

---

## 7. UI Design Constraints (WICHTIG — Uncodixify)

Die UI muss clean, flat und restrained sein. **Keine AI-Dashboard-Ästhetik.**

### Farbschema (Dark Theme):
```css
--bg: #0a0a0a;        /* Haupthintergrund — fast schwarz */
--bg2: #141414;       /* Sekundär-Hintergrund */
--card: #1a1a1a;      /* Card-Background */
--card-hover: #1f1f1f;
--accent: #e5484d;    /* Gedämpftes Rot — einzige Akzentfarbe */
--accent-hover: #d13438;
--text: #e8e8e8;      /* Primärtext */
--text2: #777777;     /* Sekundärtext */
--text3: #444444;     /* Tertiärtext/Disabled */
--success: #2b9a66;   /* Grün für Erfolg/Positiv */
--warning: #e5a500;   /* Gelb/Orange für Warnung */
--border: rgba(255,255,255,0.06);  /* Subtle Borders */
```

### VERBOTEN — Diese Patterns NICHT verwenden:
- ❌ Gradients jeglicher Art (Hintergründe, Buttons, Text)
- ❌ Glassmorphism / Frosted Glass / Blur-Effekte
- ❌ Border-Radius > 8px (keine Pills, keine oversized Rounded Corners)
- ❌ Box-Shadow > `0 1px 3px rgba(0,0,0,0.1)` — keine dramatischen Schatten
- ❌ Lila/Purple als Farbe — nirgends
- ❌ Blaue Akzentfarben
- ❌ Dekorative Hero-Sections oder Banner
- ❌ Eyebrow-Labels (uppercase + letter-spacing über Content)
- ❌ Decorative Copy / generische Beschreibungstexte
- ❌ Transform-Animationen auf Hover
- ❌ Floating/detached Panels
- ❌ Colored Glows oder Blur-Halos
- ❌ `<small>` Tags als Labels über Headlines
- ❌ KPI-Metrik-Cards als erstes Element im Dashboard
- ❌ Oversized Padding (>20px auf Mobile)
- ❌ Serif-Fonts oder Mixed-Font-Combos
- ❌ Status-Dots mit `::before` Pseudo-Elements

### ERLAUBT / GEWÜNSCHT:
- ✅ System-Font-Stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`
- ✅ Border-Radius: 6-8px max
- ✅ Borders: `1px solid rgba(255,255,255,0.06)` — subtil
- ✅ Transitions: 100-200ms ease, nur opacity/color/background
- ✅ Spacing-Scale: 4/6/8/12/16/20px — konsistent
- ✅ Typography: 14-15px Body, klare Hierarchie durch Gewicht statt Größe
- ✅ `font-variant-numeric: tabular-nums` für Zahlen
- ✅ Touch-Targets: Minimum 44×44px
- ✅ Icons: Inline SVG, Stroke-Style (Feather/Lucide), 20×20px, `stroke-width: 1.5`
- ✅ Content max-width: 480-560px, zentriert
- ✅ Modals: Bottom-Sheet-Style (von unten, `border-radius` nur oben)

### Referenz-Ästhetik:
Denke an **Linear**, **Raycast**, **Things 3** — nicht an Dribbble-Dashboards.
Restrained, funktional, leise. Die UI tritt zurück, der Content steht im Vordergrund.

---

## 8. PWA-Konfiguration

```json
{
  "name": "CouSy",
  "short_name": "CouSy",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#0a0a0a",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

HTML Meta-Tags:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="#0a0a0a">
```

---

## 9. Docker-Deployment

### Dockerfile:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm ci --omit=dev
COPY server/ ./server/
COPY dashboard/ ./dashboard/
RUN mkdir -p data/db
EXPOSE 3000
CMD ["node", "server/index.js"]
```

### docker-compose.yml:
```yaml
version: "3.8"
services:
  cousy:
    build: .
    container_name: cousy
    restart: unless-stopped
    ports:
      - "3099:3000"
    volumes:
      - ./data:/app/data
    environment:
      - JWT_SECRET=${JWT_SECRET:-cousy-secret}
      - ICAL_TOKEN=${ICAL_TOKEN:-cousy-cal-secret}
      - PORT=3000
```

### .env.example:
```
JWT_SECRET=change-me-to-something-secure
ICAL_TOKEN=change-me-for-ical-feed
PORT=3000
```

---

## 10. Server-Entry (server/index.js)

```javascript
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
```

---

## 11. Auth-Middleware (server/middleware/auth.js)

```javascript
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
```

---

## 12. Navigation Icons (Inline SVG, Feather-Style)

Verwende diese SVGs für die Bottom-Navigation:

| Tab | SVG Path |
| --- | --- |
| Home | `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>` |
| Check-In | `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>` |
| Trends | `<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>` |
| Dates | `<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>` |
| Planer | `<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>` |
| Zyklus | `<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>` |
| Watch | `<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>` |

Alle Icons: `viewBox="0 0 24 24"`, `stroke="currentColor"`, `fill="none"`, `stroke-width="1.5"`, `stroke-linecap="round"`, `stroke-linejoin="round"`, 20×20px.

---

## 13. Wichtige Verhaltens-Details

### Check-In Blind-Modus:
- Jeder User sieht nur seine eigenen Antworten, bis **beide** für dieselbe Woche submitted haben
- Wenn Partner submitted hat aber man selbst noch nicht: Hinweis "Partner hat bereits ausgefüllt" — aber keine Antworten zeigen
- Nach beiderseitigem Submit: Vergleichs-View (Side-by-Side)

### Previous-Week-Hint:
- Im Check-In-Formular: eigene Antworten der Vorwoche als dezenten Hinweis unter jeder Frage anzeigen (kleiner Text, muted color)

### Kalender-Overlay (Zyklus):
- Perioden-Tage: dezenter roter Hintergrund auf Kalender-Zellen
- Prognose-Tage: gestrichelte Border (nicht ausgefüllt)
- Events: kleiner Dot unter dem Datum

### Google Calendar Integration:
- iCal-Feed unter `/cal/feed?token=TOKEN`
- Alle Events als VCALENDAR exportieren
- Token-basierte Authentifizierung (kein JWT nötig)

### Default Login:
- Username: `dion` / Passwort: `cousy2026`
- Username: `linda` / Passwort: `cousy2026`
- Passwort kann über API geändert werden

---

## 14. Zusammenfassung für Claude Code

**Baue die komplette App in einem Durchgang.** Alle Dateien, vollständig funktionsfähig.

Prioritäten:
1. **Funktionalität:** Alle 7 Features müssen komplett funktionieren
2. **UI-Qualität:** Clean, flat, mobile-first — Uncodixify-Constraints einhalten
3. **Code-Qualität:** Einfach, lesbar, keine Over-Engineering
4. **Deployment:** Docker-ready, ein `docker-compose up -d --build` muss reichen

Deutsche UI-Texte überall. Keine englischen Labels im Frontend.

Das Ergebnis soll ein ZIP sein, das man auf Unraid entpackt und direkt deployed.
