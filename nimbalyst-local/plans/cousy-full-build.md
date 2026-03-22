---
planStatus:
  planId: plan-cousy-full-build
  title: CouSy v2.0 — Full App Build
  status: in-review
  startDate: "2026-03-22"
  planType: feature
  priority: high
  owner: dion
  stakeholders:
    - linda
  tags:
    - full-stack
    - pwa
    - docker
    - vanilla-js
    - express
    - sqlite
  created: "2026-03-22"
  updated: "2026-03-22T21:05:00.000Z"
  progress: 100
---
# CouSy v2.0 — Full App Build

Build the complete CouSy couple app from scratch. Node.js backend, Vanilla JS frontend, SQLite DB, Docker deployment on Unraid. Mobile-first PWA.

## Phases

### Phase 1: Project Skeleton & Infrastructure
- [x] `package.json` with all dependencies
- [x] `.env.example` with JWT_SECRET, ICAL_TOKEN, PORT
- [x] `Dockerfile` (node:20-alpine)
- [x] `docker-compose.yml` (port 3099→3000, volume for data/)
- [x] `server/index.js` — Express entry, static serving, SPA fallback
- [x] `server/middleware/auth.js` — JWT verification (cookie + header)
- [x] `server/db/init.js` — SQLite schema creation + user seeding

### Phase 2: Auth System
- [x]`server/routes/auth.js` — login, logout, verify, password change
- [x]Frontend login screen (German labels)
- [x]JWT cookie handling in frontend fetch wrapper

### Phase 3: Frontend Shell
- [x]`dashboard/index.html` — SPA entry + PWA meta tags
- [x]`dashboard/manifest.json` — PWA manifest
- [x]`dashboard/css/style.css` — Full dark theme, design system (colors, spacing, typography)
- [x]`dashboard/js/app.js` — SPA router, bottom nav (7 tabs), modal system, fetch wrapper
- [x]Bottom navigation with inline SVG icons (Feather style)

### Phase 4: Home Dashboard
- [x]Home view: milestone counter, open action items, upcoming events
- [x]Milestones CRUD — `server/routes/milestones.js`
- [x]Days-since counter display

### Phase 5: Weekly Check-In (Blind Mode)
- [x]`server/routes/checkins.js` — 13 questions definition, submit, blind-mode retrieval
- [x]Check-in form UI: emoji picker (5 emojis), sliders (1-10), text inputs
- [x]Progress bar across questions
- [x]Blind mode: "Partner hat bereits ausgefüllt" hint, no answer leakage
- [x]Comparison view (side-by-side) when both submitted
- [x]Previous-week hint (own answers as muted reference)

### Phase 6: Trends / Charts
- [x]`server/routes/checkins.js` — trends endpoint (aggregated data)
- [x]Chart.js integration (CDN)
- [x]Line/bar charts: satisfaction, connection, energy over time

### Phase 7: Action Items
- [x]`server/routes/actions.js` — CRUD + toggle done
- [x]Action items UI: list with checkboxes, add form

### Phase 8: Date Ideas Board
- [x]`server/routes/dates.js` — CRUD + random picker + filters
- [x]Date ideas grid UI with category filter chips
- [x]Random picker feature
- [x]Status tracking (idea → planned → done → again)

### Phase 9: Wochenplaner / Calendar
- [x]`server/routes/events.js` — CRUD + month/year filter
- [x]Month calendar grid (7×N) with dot indicators
- [x]Event create/edit bottom-sheet modal
- [x]`server/routes/ical.js` — iCal feed with token auth

### Phase 10: Zyklus-Tracker
- [x]`server/routes/cycle.js` — period entries, daily logs, prediction
- [x]Calendar overlay: red background for period days, dashed border for predictions
- [x]Daily logging (mood 1-5, symptoms, intensity)
- [x]Prediction algorithm: average of last 6 cycles

### Phase 11: Watchlist
- [x]`server/routes/watchlist.js` — CRUD + type/status filters
- [x]Watchlist UI: cards with status chips, individual ratings (dion/linda)
- [x]Filter by type (movie/series/docu) and status (want/watching/watched)

### Phase 12: Polish & Deploy
- [x]PWA icons (192px + 512px placeholders)
- [x]Touch target audit (44×44px minimum)
- [x]Test all flows end-to-end
- [x]Verify Docker build and deployment

## Technical Constraints

- **Frontend**: Single `index.html`, single `app.js`, single `style.css` — no build step
- **UI Language**: All German
- **Design**: Dark theme, `#e5484d` accent, no gradients/glassmorphism/blur, max 8px border-radius
- **Auth**: JWT in HttpOnly cookie, 30-day expiry
- **DB**: SQLite with WAL mode, better-sqlite3
