# Northern Province Sports Management – Public PWA

This is the first frontend source package created from scratch for the `sms` repository.

## Included
- Responsive public homepage
- Five Northern Province district cards
- District and division hash-based routes
- Preview of the existing Jaffna → Point Pedro registration
- PWA manifest and service worker
- No login, credentials, private database IDs, password hashes or secrets

## Important status
This is a frontend foundation in preview mode. It is NOT yet connected to the live Central Registry. The public read-only API and data-visibility rules must be implemented and tested before official public launch.

## Upload
Extract the ZIP. In GitHub, open `dosnp/sms` → Add file → Upload files. Upload the extracted folder contents so `index.html` is at the repository root. Commit to `main`.

## GitHub Pages
GitHub Pages on GitHub Free requires a public repository. Pages can use a private repository only on eligible paid plans. The published website itself is public. Do not make any repository public until it contains only reviewed frontend files and no secrets. See GitHub Docs: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site

## API connection (later stage)
After the Apps Script public read API or a secure proxy is deployed, set `apiBaseUrl` in `assets/js/config.js`. Expected GET routes:
- `/api/public/v1/province`
- `/api/public/v1/districts/{districtSlug}`
- `/api/public/v1/divisions/{districtSlug}/{divisionSlug}`

Never expose AUTH_USERS, password hashes/salts, password pepper, sessions, payment records, private player data, officer-only data or internal Drive IDs.
