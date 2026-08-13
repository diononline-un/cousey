# Changelog

## 2026-08-13 — Docker-Stack im Port-Ring gestartet

- Host-Port auf Ring gemappt: 2006 (Container 3000 unverändert)
- Fix: `./data:/app/data` auf named Volume umgestellt (root-owned-Bindmount verhinderte SQLite-Zugriff), Container läuft stabil
