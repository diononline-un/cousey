---
status: in-development
progress: 90
version: "2.0.0"
tags: [express, sqlite, pwa, docker]
scope: "Private Beziehungs-App (Couple Sync) für zwei Nutzer als mobile PWA im Docker-Deployment"
last_updated: "2026-08-13"
next_steps:
  - UI-Feinheiten aus dem Design-Review (Accessibility, Fokus-Zustände) final testen
  - Default-Credentials (cousy2026) durch echte Passwörter im Produktiv-Deployment ersetzen
  - iCal-Feed gegen Google Calendar verifizieren
  - Update-Prompt-Datei abarbeiten bzw. entscheiden, ob v2.0-Scope noch offen ist
  - Backup-Strategie für das SQLite-Volume (cousy_data) auf dem Unraid-NAS festlegen
---

# Aktueller Stand
- Vollständige Feature-Pipeline: Check-Ins mit Blind-Modus, Trends, Dates, Planer, Zyklus, Watchlist, iCal-Feed
- Docker-Deployment läuft auf Unraid (Host-Port 2006, restart: unless-stopped, Volume für SQLite-Daten)
- Kein Build-Schritt, Vanilla-JS-SPA, minimal dependencies (Express 4, better-sqlite3, JWT-Auth)
- Kein Test-Framework, kein Linting vorhanden
- Letzte Commits: v1.0-Release, UI-Optimierung per PR, README/Dockerfile-Refinement
