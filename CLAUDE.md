# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CouSy** (Couple Sync) is a private relationship app for two users (Dion + Linda), deployed as a Docker container on Unraid NAS. Used primarily as a mobile PWA.

## Tech Stack

- **Runtime:** Node.js 20 with Express 4
- **Database:** better-sqlite3 (SQLite, WAL mode)
- **Frontend:** Vanilla JS SPA — single `index.html`, single `app.js`, single `style.css`. No build step, no framework, no bundler.
- **Auth:** JWT via HttpOnly cookie (30-day expiry), bcryptjs for passwords
- **Charts:** Chart.js 4 via CDN
- **Deployment:** Docker (node:20-alpine) + docker-compose

**Minimal dependencies only:** express, cookie-parser, better-sqlite3, jsonwebtoken, bcryptjs, ical-generator.

## Build & Run Commands

```bash
# Development
npm install
node server/index.js          # Starts on PORT (default 3000)

# Docker deployment
docker-compose up -d --build  # Maps host 3099 → container 3000

# Environment
cp .env.example .env          # Set JWT_SECRET, ICAL_TOKEN, PORT
```

No test framework is configured. No linting setup. No build step for frontend.

## Architecture

### Backend (`server/`)

- `index.js` — Express entry point, static file serving from `dashboard/`, SPA fallback
- `middleware/auth.js` — JWT verification from cookie or Authorization header
- `db/init.js` — SQLite schema creation + user seeding (dion/linda with password `cousy2026`)
- `routes/` — One file per feature: `auth.js`, `checkins.js`, `actions.js`, `dates.js`, `events.js`, `cycle.js`, `watchlist.js`, `milestones.js`, `ical.js`

All `/api/*` routes are JWT-protected except `/api/auth/login`. The iCal feed (`/cal/feed`) uses a separate token via `ICAL_TOKEN` env var.

### Frontend (`dashboard/`)

Single-page app with bottom navigation (7 tabs): Home, Check-In, Trends, Dates, Planer, Zyklus, Watch. Modals use bottom-sheet style (slide up from bottom). All UI text is in German.

### Key Business Logic

**Check-In Blind Mode:** Partner answers are only revealed when *both* users have submitted for the same week. Until then, only a "Partner hat bereits ausgefüllt" hint is shown — no answers leaked.

**Cycle Prediction:** Averages the last 6 completed cycles to predict next period start date and duration.

## UI Design Constraints (Critical)

Dark theme with muted red accent (`#e5484d`). Design reference: Linear, Raycast, Things 3.

**Forbidden patterns:**
- No gradients, glassmorphism, blur effects
- No border-radius > 8px
- No purple or blue accent colors
- No dramatic shadows, glows, or decorative elements
- No serif fonts, no mixed font combos
- No oversized padding (>20px on mobile)

**Required patterns:**
- System font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`)
- Spacing scale: 4/6/8/12/16/20px
- Transitions: 100-200ms ease, only opacity/color/background
- Touch targets: minimum 44×44px
- Icons: inline SVG, Feather/Lucide stroke style, 20×20px, stroke-width 1.5
- Content max-width: 480-560px, centered
