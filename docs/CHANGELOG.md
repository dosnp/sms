# Changelog

## v0.1.2 — 10 November 2026

- Fixed the Public PWA mount-point mismatch (`index.html` now provides `#app`, matching `app.js`).
- Added an Officer Login entry and a secure Admin sign-in screen.
- Added role-aware Admin navigation for Developer, Provincial Officer, Department Sports Officer, District Officer and Divisional Sports Officer.
- Added first Admin UI screens for overview, district registry, division registry, officer accounts, assignments, transfers, reports, audit log and settings.
- Added an explicit HTTP API contract for authentication and Admin operations.
- Added scope-aware page rendering and no-cache handling for authenticated API responses.
- Updated service-worker cache name to `np-sports-pwa-v0.1.2`.
- Preserved the existing NP icon artwork and project asset structure.
- No live database records, Point Pedro data, Apps Script projects, Drive folders or Central Registry records were changed by this frontend update.

## Known integration work

- Public read-only HTTP API is not deployed.
- Authentication and Admin REST adapter are not deployed.
- Admin overview, assignment list, transfer list, audit list, settings and division-catalog read endpoints require server-side implementations or adapters.
- The browser UI does not replace server-side authorisation.
