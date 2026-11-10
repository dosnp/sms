# Proposed Public API Contract

These routes are expected by the frontend but do not exist until implemented in the Apps Script / proxy backend.

- GET `/api/public/v1/province` → province and districts
- GET `/api/public/v1/districts/{districtSlug}` → district and its public divisions
- GET `/api/public/v1/divisions/{districtSlug}/{divisionSlug}` → division and approved public sections

Server-side requirements:
- Resolve slugs against Central Registry; do not trust client-supplied IDs.
- Verify that each division belongs to the requested district.
- Return only fields explicitly marked for public visibility.
- Never return authentication data, passwords, hashes, salts, pepper, session tokens, private assignments, personal contact details, payment data or internal Drive IDs.
- Keep this public API read-only.
