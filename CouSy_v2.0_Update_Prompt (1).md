# CouSy v2.0 — Update Prompt (Addon auf v1.0)

> **Kontext:** CouSy v1.0 ist deployed und laeuft. Dieses Dokument beschreibt NUR die Aenderungen/Ergaenzungen fuer v2.0. Bestehender Code wird nicht neugeschrieben — nur gepatcht, erweitert oder ergaenzt.
>
> **Liefere am Ende:** Komplettes ZIP mit allen Dateien (auch unveraenderte), HANDOVER.md aktualisiert.

---

## Feature A: Kalender als Planungs-Board (Post-it Style)

### A1. Kalender-UI Redesign

**Betrifft:** `dashboard/js/app.js` → Funktion `loadCalendar()` (Zeile ~478), `dashboard/css/style.css`

**Was aendern:**

1. **Monatskalender behalten**, aber jeder Tag wird zu einer "Lane" / Drop-Zone
2. **Events als Post-it-Karten** statt nur Punkte im Grid:
   - Farbige Mini-Karten (Kategorie-basiert) MIT Titel sichtbar direkt im Tages-Feld
   - Farbschema: `romantic` = rosa, `adventure` = orange, `food` = gruen, `culture` = blau, `chill` = lila
3. **Click auf Tag** oeffnet ein Day-Detail-Panel (Bottom-Sheet Modal):
   - Zeigt alle Events des Tages als groessere Post-it-Karten
   - Zeigt Cycle-Status des Tages (Mood, Symptoms falls vorhanden)
   - Quick-Add Button fuer neues Event
   - Quick-Add Button fuer Cycle Daily Log

### A2. Date-Idea → Event Linking (verbessert)

**Betrifft:** `dashboard/js/app.js` → `openEventModal()` (Zeile ~571), `server/routes/events.js`

**Was aendern:**

1. **Im Event-Modal:** Dropdown/Suchfeld "Date-Idee verknuepfen" hinzufuegen
   - Laedt alle `date_ideas` mit `status = 'idea'` oder `'planned'`
   - Bei Auswahl: Titel wird auto-befuellt, `linked_date_idea_id` gesetzt
   - Date-Idea-Status wird automatisch auf `planned` gesetzt wenn Event erstellt wird
2. **Im Event-Modal:** Wenn Event als `done` markiert wird → verknuepfte Date-Idea auf `done` setzen
3. **Backend PATCH:** `POST /api/events` und `PUT /api/events/:id` — wenn `linked_date_idea_id` gesetzt:
   - POST: Setze date_idea.status = 'planned'
   - PUT mit status-Logik: Wenn Event geloescht/done → date_idea.status anpassen

**Neue API-Erweiterung:**

```
GET /api/events/:id/linked-idea   → gibt verknuepfte Date-Idea zurueck
PUT /api/events/:id/complete      → setzt Event + verknuepfte Idea auf done
```

### A3. Kalender CSS-Ergaenzungen

**Betrifft:** `dashboard/css/style.css` — APPEND (nicht ersetzen)

```css
/* v2.0 — Planning Board Calendar */
.cal-day {
  aspect-ratio: auto;           /* OVERRIDE: war 1, jetzt flexibel */
  min-height: 64px;
  padding: 4px;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 2px;
  overflow: hidden;
}
.cal-day-num {
  font-size: 0.7rem;
  color: var(--text3);
  width: 100%;
  text-align: right;
  padding: 0 2px;
}
.cal-day.today .cal-day-num {
  color: var(--accent);
  font-weight: 700;
}
.cal-postit {
  width: 100%;
  padding: 2px 4px;
  border-radius: 4px;
  font-size: 0.6rem;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}
.cal-postit.cat-romantic { background: rgba(233,69,96,0.25); color: #f87171; }
.cal-postit.cat-adventure { background: rgba(251,146,60,0.25); color: #fb923c; }
.cal-postit.cat-food { background: rgba(52,211,153,0.25); color: #34d399; }
.cal-postit.cat-culture { background: rgba(96,165,250,0.25); color: #60a5fa; }
.cal-postit.cat-chill { background: rgba(192,132,252,0.25); color: #c084fc; }
.cal-postit.cat-default { background: rgba(255,255,255,0.08); color: var(--text2); }
.cal-day-more {
  font-size: 0.55rem;
  color: var(--text3);
  text-align: center;
  width: 100%;
}

/* Day Detail Bottom Sheet */
.day-detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.day-detail-date {
  font-size: 1.1rem;
  font-weight: 700;
}
.day-postit-card {
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  margin-bottom: 8px;
  border-left: 4px solid;
  background: var(--card);
}
.day-postit-card.cat-romantic { border-left-color: #f87171; }
.day-postit-card.cat-adventure { border-left-color: #fb923c; }
.day-postit-card.cat-food { border-left-color: #34d399; }
.day-postit-card.cat-culture { border-left-color: #60a5fa; }
.day-postit-card.cat-chill { border-left-color: #c084fc; }
.day-cycle-banner {
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  background: rgba(233,69,96,0.1);
  border: 1px solid rgba(233,69,96,0.2);
  margin-bottom: 12px;
  font-size: 0.85rem;
}

/* Calendar responsive: 2 post-its max on mobile */
@media (max-width: 480px) {
  .cal-day { min-height: 48px; }
  .cal-postit { font-size: 0.55rem; }
}
```

### A4. Kalender JS-Aenderungen

**Betrifft:** `dashboard/js/app.js` — Funktion `loadCalendar()` ERSETZEN, `openDayDetail()` ERSETZEN

**loadCalendar() — Neue Version:**

Kern-Aenderungen gegenueber v1.0:
- Jeder `.cal-day` bekommt jetzt `.cal-day-num` + bis zu 2 `.cal-postit` Karten + optional `.cal-day-more`
- Events werden mit Kategorie-Klasse gerendert (aus linked_date_idea oder fallback 'default')
- Cycle-Daily-Daten werden fuer Day-Detail vorgehalten (nicht nur als Hintergrund-Klasse)

```javascript
// In loadCalendar(), ersetze den Tag-Rendering-Loop:
for (let d = 1; d <= lastDay.getDate(); d++) {
  const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  const isToday = dateStr === now.toISOString().split('T')[0];
  const dayEvents = eventDates[dateStr] || [];
  const isCycle = cycleDates.has(dateStr);
  const isPredicted = predictedDates.has(dateStr);
  const cls = ['cal-day', isToday?'today':'', isCycle?'cycle-period':'', isPredicted&&!isCycle?'cycle-predicted':''].filter(Boolean).join(' ');

  let inner = `<div class="cal-day-num">${d}</div>`;
  const maxShow = 2;
  for (let i = 0; i < Math.min(dayEvents.length, maxShow); i++) {
    const ev = dayEvents[i];
    const cat = ev.category || 'default';
    inner += `<div class="cal-postit cat-${cat}" title="${esc(ev.title)}">${esc(ev.title)}</div>`;
  }
  if (dayEvents.length > maxShow) inner += `<div class="cal-day-more">+${dayEvents.length - maxShow}</div>`;

  html += `<div class="${cls}" onclick="openDayDetail('${dateStr}')">${inner}</div>`;
}
```

**Event-Kategorie vom Backend mitliefern:**
- `GET /api/events` soll jetzt JOINen: `LEFT JOIN date_ideas di ON di.id = e.linked_date_idea_id`
- Zusaetzliches Feld im Response: `category: di.category || 'default'`

**openDayDetail() — Neue Version:**

```javascript
async function openDayDetail(dateStr) {
  const [events, cycleDay] = await Promise.all([
    api(`/events?date=${dateStr}`),
    api(`/cycle/daily?date=${dateStr}`)
  ]);
  const m = document.getElementById('modalContent');
  const dateObj = new Date(dateStr + 'T12:00:00');
  const formatted = dateObj.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  let html = `<div class="day-detail-header">
    <div class="day-detail-date">${formatted}</div>
    <div class="flex gap-8">
      <button class="btn-sm" onclick="openEventModal(null,'${dateStr}')">+ Event</button>
      <button class="btn-sm" onclick="openCycleDayModal('${dateStr}')">+ Log</button>
    </div>
  </div>`;

  // Cycle info banner
  const cd = Array.isArray(cycleDay) ? cycleDay[0] : cycleDay;
  if (cd) {
    const moods = ['','😢','😕','😐','🙂','😊'];
    const symptoms = JSON.parse(cd.symptoms || '[]');
    html += `<div class="day-cycle-banner">
      ${cd.mood ? moods[cd.mood] : ''} ${cd.intensity || ''} ${symptoms.length ? '· ' + symptoms.join(', ') : ''}
      ${cd.notes ? '<br><span class="text-sm text-muted">' + esc(cd.notes) + '</span>' : ''}
    </div>`;
  }

  // Events as post-it cards
  if (events.length) {
    for (const ev of events) {
      const cat = ev.category || 'default';
      html += `<div class="day-postit-card cat-${cat}" onclick="openEventModal(${ev.id})">
        <div class="event-title">${esc(ev.title)}</div>
        <div class="event-detail">${ev.location ? '📍 ' + esc(ev.location) : ''} ${ev.sleepover ? '🌙' : ''}</div>
        ${ev.linked_date_idea_id ? '<div class="text-xs text-muted">🔗 Verknuepfte Date-Idee</div>' : ''}
      </div>`;
    }
  } else {
    html += '<div class="empty-state"><div class="empty-icon">📋</div>Noch nichts geplant</div>';
  }

  m.innerHTML = html;
  openModal();
}
```

### A5. Backend-Patches fuer Kalender

**`server/routes/events.js` — Aenderungen:**

1. GET `/` — Neuer optionaler Query-Param `?date=YYYY-MM-DD` (exakter Tag-Filter)
2. GET `/` — JOIN mit date_ideas fuer Kategorie:
```javascript
let q = `SELECT e.*, u.display_name as planned_by_name, di.category
         FROM events e
         LEFT JOIN users u ON u.id=e.planned_by
         LEFT JOIN date_ideas di ON di.id=e.linked_date_idea_id`;
```
3. POST `/` — Wenn `linked_date_idea_id` gesetzt: auto-update `date_ideas.status = 'planned'`
4. Neuer Endpoint: `PUT /:id/complete`:
```javascript
router.put('/:id/complete', auth, (req, res) => {
  const db = getDb();
  const ev = db.prepare('SELECT * FROM events WHERE id=?').get(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Not found' });
  db.prepare("UPDATE events SET notes = COALESCE(notes,'') || ' [completed]' WHERE id=?").run(ev.id);
  if (ev.linked_date_idea_id) {
    db.prepare("UPDATE date_ideas SET status='done' WHERE id=?").run(ev.linked_date_idea_id);
  }
  res.json({ ok: true });
});
```

**`server/routes/cycle.js` — Aenderungen:**

1. GET `/daily` — Neuer optionaler Query-Param `?date=YYYY-MM-DD` (exakter Tag):
```javascript
if (req.query.date) {
  return res.json(db.prepare('SELECT * FROM cycle_daily WHERE date=?').all(req.query.date));
}
```

---

## Feature B: Intelligenter Zyklus-Tracker

### B1. Erweitertes DB-Schema

**Betrifft:** `server/db/init.js` — In `initTables()` NACH bestehenden CREATE TABLE Statements HINZUFUEGEN:

```sql
-- Erweiterte cycle_daily Spalten (ALTER TABLE, safe mit IF NOT EXISTS-Logik)
-- Da SQLite kein ADD COLUMN IF NOT EXISTS hat, mache es im JS:
```

```javascript
// In initTables(), nach den CREATE TABLE Statements:
// Safe column additions for v2.0
const cols = db.prepare("PRAGMA table_info('cycle_daily')").all().map(c => c.name);
if (!cols.includes('flow')) db.exec("ALTER TABLE cycle_daily ADD COLUMN flow TEXT DEFAULT NULL"); // none, spotting, light, medium, heavy
if (!cols.includes('cervical_mucus')) db.exec("ALTER TABLE cycle_daily ADD COLUMN cervical_mucus TEXT DEFAULT NULL"); // dry, sticky, creamy, watery, egg_white
if (!cols.includes('temperature')) db.exec("ALTER TABLE cycle_daily ADD COLUMN temperature REAL DEFAULT NULL"); // BBT in Celsius
if (!cols.includes('energy_level')) db.exec("ALTER TABLE cycle_daily ADD COLUMN energy_level INTEGER DEFAULT NULL"); // 1-5
if (!cols.includes('libido')) db.exec("ALTER TABLE cycle_daily ADD COLUMN libido INTEGER DEFAULT NULL"); // 1-5
if (!cols.includes('sleep_quality')) db.exec("ALTER TABLE cycle_daily ADD COLUMN sleep_quality INTEGER DEFAULT NULL"); // 1-5
if (!cols.includes('exercise')) db.exec("ALTER TABLE cycle_daily ADD COLUMN exercise TEXT DEFAULT NULL"); // none, light, moderate, intense
if (!cols.includes('skin')) db.exec("ALTER TABLE cycle_daily ADD COLUMN skin TEXT DEFAULT '[]'"); // JSON: clear, oily, dry, acne, glowing
if (!cols.includes('cravings')) db.exec("ALTER TABLE cycle_daily ADD COLUMN cravings TEXT DEFAULT '[]'"); // JSON: sweet, salty, chocolate, carbs
if (!cols.includes('is_period_day')) db.exec("ALTER TABLE cycle_daily ADD COLUMN is_period_day INTEGER DEFAULT 0");
```

### B2. Auto-Inference Logik (Backend)

**Betrifft:** `server/routes/cycle.js` — Neue Logik in `POST /daily`

**Konzept:** Wenn `flow` != 'none' und != null → `is_period_day = 1`. Backend prueft nach jedem Daily-Save, ob ein neuer `cycle_entry` erstellt oder ein bestehender erweitert werden muss.

```javascript
// ERSETZE die bestehende POST /daily Route komplett:
router.post('/daily', auth, (req, res) => {
  const db = getDb();
  const {
    date, mood, symptoms, intensity, notes, cycle_entry_id,
    flow, cervical_mucus, temperature, energy_level, libido,
    sleep_quality, exercise, skin, cravings
  } = req.body;

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

  const ex = db.prepare('SELECT id FROM cycle_daily WHERE date=?').get(date);
  if (ex) {
    const sets = Object.keys(fields).map(k => k + '=?').join(',');
    db.prepare('UPDATE cycle_daily SET ' + sets + ' WHERE id=?').run(...Object.values(fields), ex.id);
  } else {
    const cols = ['date', ...Object.keys(fields)];
    const placeholders = cols.map(() => '?').join(',');
    db.prepare('INSERT INTO cycle_daily (' + cols.join(',') + ') VALUES (' + placeholders + ')').run(date, ...Object.values(fields));
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
    db.prepare('UPDATE cycle_daily SET cycle_entry_id=? WHERE date=?').run(recent.cycle_entry_id, dateStr);
    db.prepare('UPDATE cycle_entries SET end_date=? WHERE id=? AND (end_date IS NULL OR end_date < ?)').run(dateStr, recent.cycle_entry_id, dateStr);
  } else {
    // Start new cycle entry
    const r = db.prepare('INSERT INTO cycle_entries (start_date, end_date) VALUES (?, ?)').run(dateStr, dateStr);
    db.prepare('UPDATE cycle_daily SET cycle_entry_id=? WHERE date=?').run(r.lastInsertRowid, dateStr);
  }
}
```

### B3. Erweiterte Prediction

**Betrifft:** `server/routes/cycle.js` — `GET /predict` ERSETZEN

```javascript
router.get('/predict', auth, (req, res) => {
  const db = getDb();
  const entries = db.prepare('SELECT * FROM cycle_entries WHERE end_date IS NOT NULL ORDER BY start_date DESC LIMIT 12').all();

  if (entries.length < 2) return res.json({ prediction: null, phase: null });

  // Cycle length calculation (weighted: recent cycles count more)
  let totalWeight = 0, weightedCycle = 0, totalDur = 0;
  for (let i = 0; i < entries.length - 1; i++) {
    const cycleLen = (new Date(entries[i].start_date) - new Date(entries[i + 1].start_date)) / 86400000;
    const weight = entries.length - i; // newer = higher weight
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
```

### B4. Zyklus-View Frontend Redesign

**Betrifft:** `dashboard/js/app.js` → `loadCycle()` (Zeile ~622) KOMPLETT ERSETZEN

**Neue Sections in der Cycle-View:**

1. **Phase-Banner** (oben): Zeigt aktuelle Phase + Zyklustag + farbiger Indikator
   - Menstruation: rot
   - Follikulaer: gruen  
   - Ovulation: gelb/gold
   - Luteal: lila
2. **Stats-Grid** (3 Karten): Zykluslaenge, Periodenlaenge, Naechste Periode
3. **Daily Log Form** (Karte): Erweitertes Formular mit allen neuen Feldern
4. **Log-Historie** (unten): Letzte 14 Tage als kompakte Liste

**Daily Log Form — Neue Felder:**

```javascript
// Flow-Picker (ersetzt den alten Intensity-Picker)
const flowOptions = [
  { val: 'none', label: 'Kein', icon: '○' },
  { val: 'spotting', label: 'Schmier', icon: '◔' },
  { val: 'light', label: 'Leicht', icon: '◑' },
  { val: 'medium', label: 'Mittel', icon: '◕' },
  { val: 'heavy', label: 'Stark', icon: '●' }
];

// Symptom-Tags (erweitert)
const symptomsList = [
  'Kraempfe', 'Kopfschmerzen', 'Blaehungen', 'Brustspannen',
  'Rueckenschmerzen', 'Uebelkeit', 'Muedigkeit', 'Stimmungsschwankung',
  'Heisshunger', 'Schlafprobleme', 'Schwindel', 'Hautunreinheiten'
];

// Cervical Mucus (neuer Picker)
const cmOptions = [
  { val: 'dry', label: 'Trocken' },
  { val: 'sticky', label: 'Klebrig' },
  { val: 'creamy', label: 'Cremig' },
  { val: 'watery', label: 'Waessrig' },
  { val: 'egg_white', label: 'Spinnbar' }
];

// Energy, Libido, Sleep: jeweils 1-5 Emoji-Reihe
// Exercise: chip-row (none/light/moderate/intense)
// Skin + Cravings: toggle-tags wie Symptoms
```

### B5. Kalender Cycle-Overlay erweitern

**Betrifft:** `dashboard/js/app.js` → `loadCalendar()` Cycle-Rendering

Zusaetzlich zu bestehenden `.cycle-period` und `.cycle-predicted`:
- **Fertile Window:** `.cycle-fertile` Klasse fuer Tage im fertilen Fenster
- **Ovulation:** `.cycle-ovulation` Klasse fuer geschaetzten Eisprung-Tag

**CSS ergaenzen:**
```css
.cal-day.cycle-fertile { background: rgba(52,211,153,0.12); }
.cal-day.cycle-fertile::before {
  content: ''; position: absolute; top: 3px; right: 3px;
  width: 5px; height: 5px; border-radius: 50%;
  background: var(--success);
}
.cal-day.cycle-ovulation { background: rgba(251,191,36,0.15); }
.cal-day.cycle-ovulation::before {
  content: '✦'; position: absolute; top: 1px; right: 3px;
  font-size: 0.5rem; color: var(--warning);
}

/* Phase Banner */
.phase-banner {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 18px; border-radius: var(--radius);
  margin-bottom: 16px;
  border: 1px solid var(--border);
}
.phase-dot {
  width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0;
}
.phase-menstruation .phase-dot { background: var(--accent); }
.phase-follikulaer .phase-dot { background: var(--success); }
.phase-ovulation .phase-dot { background: var(--warning); }
.phase-luteal .phase-dot { background: var(--accent2); }
.phase-menstruation { background: rgba(233,69,96,0.08); }
.phase-follikulaer { background: rgba(52,211,153,0.08); }
.phase-ovulation { background: rgba(251,191,36,0.08); }
.phase-luteal { background: rgba(192,132,252,0.08); }
.phase-info { flex: 1; }
.phase-name { font-weight: 700; font-size: 0.95rem; }
.phase-detail { font-size: 0.8rem; color: var(--text2); }

/* Daily Log History */
.log-history-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px; border-radius: 8px;
  margin-bottom: 4px; background: var(--card);
  border: 1px solid var(--border); font-size: 0.85rem;
}
.log-date { min-width: 44px; font-weight: 600; color: var(--text2); font-size: 0.8rem; }
.log-flow { min-width: 20px; text-align: center; }
.log-tags { display: flex; gap: 4px; flex-wrap: wrap; flex: 1; }
.log-tag { padding: 1px 6px; border-radius: 6px; font-size: 0.65rem; background: rgba(255,255,255,0.06); color: var(--text3); }

/* Cervical Mucus Picker */
.cm-row { display: flex; gap: 6px; margin: 8px 0; }
.cm-btn {
  padding: 6px 10px; border-radius: 12px; font-size: 0.75rem;
  border: 1px solid var(--border); background: var(--card);
  color: var(--text2); cursor: pointer; transition: all 0.2s;
}
.cm-btn.active { background: rgba(52,211,153,0.15); border-color: var(--success); color: var(--success); }

/* Flow Picker */
.flow-row { display: flex; gap: 8px; justify-content: center; margin: 10px 0; }
.flow-btn {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 8px 10px; border-radius: 10px; font-size: 0.75rem;
  border: 2px solid transparent; background: var(--card);
  color: var(--text2); cursor: pointer; transition: all 0.2s;
}
.flow-btn .flow-icon { font-size: 1.2rem; }
.flow-btn.active { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
```

### B6. Cycle Daily Log Modal (fuer Kalender-Integration)

**Neue Funktion in `app.js`:**

```javascript
function openCycleDayModal(dateStr) {
  // Opens a modal pre-filled for a specific date
  // Same form as the cycle view daily log, but in modal context
  // After save → reload calendar + close modal
  const m = document.getElementById('modalContent');
  m.innerHTML = `<div class="modal-title">Tages-Log: ${new Date(dateStr+'T12:00:00').toLocaleDateString('de-DE', {day:'numeric',month:'long'})}</div>
    <!-- Same form fields as cycle daily log -->
    <div class="form-group"><label>Flow</label>
      <div class="flow-row" id="mFlow">
        ${[['none','Kein','○'],['spotting','Schmier','◔'],['light','Leicht','◑'],['medium','Mittel','◕'],['heavy','Stark','●']].map(([v,l,i]) =>
          '<button class="flow-btn" onclick="selectModalFlow(\''+v+'\',this)"><span class="flow-icon">'+i+'</span>'+l+'</button>'
        ).join('')}
      </div>
    </div>
    <div class="form-group"><label>Stimmung</label>
      <div class="emoji-row" id="mMood">
        ${['😢','😕','😐','🙂','😊'].map((e,i) => '<button class="emoji-btn" onclick="selectModalMood('+(i+1)+',this)">'+e+'</button>').join('')}
      </div>
    </div>
    <div class="form-group"><label>Symptome</label>
      <div class="symptom-tags" id="mSymptoms">
        ${['Kraempfe','Kopfschmerzen','Blaehungen','Brustspannen','Rueckenschmerzen','Uebelkeit','Muedigkeit','Stimmungsschwankung'].map(s =>
          '<button class="symptom-tag" onclick="this.classList.toggle(\'active\')">'+s+'</button>'
        ).join('')}
      </div>
    </div>
    <div class="form-group"><label>Zervixschleim</label>
      <div class="cm-row" id="mCM">
        ${[['dry','Trocken'],['sticky','Klebrig'],['creamy','Cremig'],['watery','Waessrig'],['egg_white','Spinnbar']].map(([v,l]) =>
          '<button class="cm-btn" onclick="selectModalCM(\''+v+'\',this)">'+l+'</button>'
        ).join('')}
      </div>
    </div>
    <div class="form-group"><label>Notizen</label><textarea class="form-input" id="mCycleNotes" rows="2"></textarea></div>
    <div class="modal-actions">
      <button class="btn-accent" onclick="saveModalCycleDaily('${dateStr}')">Speichern</button>
      <button class="btn-ghost" onclick="closeModal()">Abbrechen</button>
    </div>`;
  window._modalFlow = null;
  window._modalMood = null;
  window._modalCM = null;
  openModal();
}

function selectModalFlow(v, btn) { window._modalFlow = v; btn.parentElement.querySelectorAll('.flow-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); }
function selectModalMood(v, btn) { window._modalMood = v; btn.parentElement.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); }
function selectModalCM(v, btn) { window._modalCM = v; btn.parentElement.querySelectorAll('.cm-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); }

async function saveModalCycleDaily(dateStr) {
  const symptoms = [...document.querySelectorAll('#mSymptoms .symptom-tag.active')].map(b => b.textContent);
  await api('/cycle/daily', { method: 'POST', body: {
    date: dateStr,
    flow: window._modalFlow,
    mood: window._modalMood,
    symptoms,
    cervical_mucus: window._modalCM,
    notes: document.getElementById('mCycleNotes').value
  }});
  closeModal();
  loadCalendar();
}
```

---

## Zusammenfassung: Betroffene Dateien

| Datei | Aktion |
|---|---|
| `server/db/init.js` | PATCH: ALTER TABLE Spalten hinzufuegen (B1) |
| `server/routes/cycle.js` | PATCH: POST /daily erweitern (B2), GET /predict ersetzen (B3), GET /daily erweitern (A5) |
| `server/routes/events.js` | PATCH: GET / erweitern mit JOIN + date-Filter (A5), PUT /:id/complete neu (A5) |
| `dashboard/js/app.js` | PATCH: loadCalendar() ersetzen (A4), openDayDetail() ersetzen (A4), loadCycle() ersetzen (B4), neue Funktionen: openCycleDayModal + Helfer (B6) |
| `dashboard/css/style.css` | APPEND: Alle neuen Klassen aus A3 + B5 |
| `HANDOVER.md` | UPDATE: v2.0 Changelog + neue API-Docs |

### Nicht veraendert (1:1 uebernehmen aus v1.0):
- `Dockerfile`, `docker-compose.yml`, `package.json`, `.env.example`, `start.sh`
- `server/index.js`, `server/middleware/auth.js`
- `server/routes/auth.js`, `server/routes/checkins.js`, `server/routes/actions.js`
- `server/routes/dates.js`, `server/routes/watchlist.js`, `server/routes/milestones.js`, `server/routes/ical.js`
- `dashboard/index.html`, `dashboard/manifest.json`, `dashboard/icons/*`

---

## Wichtige Constraints

1. **Vanilla JS only** — kein Framework, kein Build-Step
2. **Mobile-first** — alles muss auf 375px+ funktionieren
3. **Dark Theme** — bestehende CSS-Variablen verwenden
4. **Deutsch** — alle UI-Texte auf Deutsch, keine Umlaute in Code (Ae/Oe/Ue)
5. **SQLite safe** — ALTER TABLE mit Spalten-Check (PRAGMA table_info)
6. **Kein Breaking Change** — bestehende v1.0 Daten muessen erhalten bleiben
7. **Clean code** — keine ueberlangen Funktionen, sinnvolle Kommentare
