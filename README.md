# CouSy — Couple Sync

Private relationship app for two users, deployed as a Docker container on Unraid NAS. Used as a mobile PWA.

## Features

| Tab | Description |
|-----|-------------|
| **Home** | Milestone counters, open tasks, upcoming events |
| **Check-In** | Weekly 13-question questionnaire with blind mode — partner answers hidden until both submit |
| **Trends** | Chart.js line/bar charts of check-in data over time |
| **Dates** | Date idea board with categories, status tracking, and random picker |
| **Planer** | Monthly calendar with events + iCal feed for Google Calendar |
| **Zyklus** | Cycle tracker with daily logging and period prediction |
| **Watch** | Movie/series watchlist with individual ratings per user |

## Quick Start

```bash
cp .env.example .env       # Edit JWT_SECRET and ICAL_TOKEN
docker-compose up -d --build
```

App runs at `http://localhost:3099`

Default credentials: `dion` / `cousy2026` and `linda` / `cousy2026`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes | Secret for signing JWT tokens — change in production |
| `ICAL_TOKEN` | Yes | Token for the iCal feed URL |
| `PORT` | No | Internal server port (default: `3000`) |

## iCal Feed

Subscribe in Google Calendar via:
```
http://<host>:3099/cal/feed?token=<ICAL_TOKEN>
```

## Development

```bash
npm install
node server/index.js     # Starts on PORT (default 3000)
```

No build step — vanilla JS/CSS served directly from `dashboard/`.

## Tech Stack

- **Runtime:** Node.js 20 + Express 4
- **Database:** better-sqlite3 (SQLite, WAL mode) — persisted to `./data/db/`
- **Frontend:** Vanilla JS SPA, no framework, no bundler
- **Auth:** JWT via HttpOnly cookie (30-day expiry)
- **Charts:** Chart.js 4 via CDN
- **Deployment:** Docker (node:20-alpine) + docker-compose

## Project Structure

```
cousey/
├── Dockerfile
├── docker-compose.yml
├── package.json
├── .env.example
├── dashboard/
│   ├── index.html        # SPA entry point + PWA meta
│   ├── manifest.json     # PWA manifest
│   ├── css/style.css
│   ├── js/app.js
│   └── icons/
├── server/
│   ├── index.js          # Express entry point
│   ├── middleware/auth.js
│   ├── db/init.js        # Schema + user seeding
│   └── routes/           # auth, checkins, actions, dates, events, cycle, watchlist, milestones, ical
└── data/db/              # SQLite DB (volume-mounted)
```

## Deployment (Unraid)

1. Copy the project folder to your Unraid share
2. Set `JWT_SECRET` and `ICAL_TOKEN` in `.env`
3. Run `docker-compose up -d --build`
4. Add to homescreen on iPhone/Android for PWA experience
