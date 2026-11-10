# Northern Province Sports Management PWA

Version: **0.1.2**

This is the next source revision of the existing Northern Province Sports PWA. It retains the v0.1.1 project structure and icon assets while adding the first role-aware Admin UI shell alongside the Public View.

## Included

- Responsive, login-free Public View for Province, District and Division pages.
- Five official Northern Province district directory entries.
- Shareable page routes for each district and registered division.
- Existing Jaffna → Point Pedro preview entry only; no other division names are invented.
- Admin sign-in screen and role-aware administration shell.
- Role navigation for Developer, Provincial Officer, Department Sports Officer, District Officer and Divisional Sports Officer, including province-wide division visibility for Provincial roles.
- Initial Admin pages for overview, districts, divisions, officer accounts, assignments, transfers, reports, audit log and settings.
- PWA manifest, existing NP SVG/PNG icons and updated service-worker cache version.
- Service worker explicitly bypasses `/api/` requests; authenticated API data is never cached.

## Important current status

This remains a frontend source package. `apiEnabled` is deliberately `false` in `assets/js/config.js`.

- Public pages use the existing safe preview data until the read-only public API is deployed.
- The Admin login UI is present, but sign-in is deliberately disabled until the secure authentication API is connected.
- No demo credentials, fake users, mock live records or browser-side login bypass have been added.
- The Admin UI's role-based navigation is for usability only. The server must enforce every role and district/division scope on every request.
- The supplied Central Architecture v0.1.0 contains Apps Script authentication and action functions, but it does not itself expose the HTTP REST endpoints required by this static PWA. An authenticated server-side HTTP adapter is still required. See `docs/API_CONTRACT.md`.

## Public page routes

- Province: `/#/province`
- District: `/#/district/jaffna`
- Division: `/#/division/jaffna/point-pedro`
- Admin sign-in: `/#/admin/login`

Each District and Division has its own shareable page route while using one common PWA deployment. The public API must resolve the slugs against the Central Registry and return only approved public information.

## Project structure

```text
index.html
manifest.webmanifest
service-worker.js
assets/
  css/styles.css
  js/app.js
  js/config.js
  icons/np.svg
  icons/np-icon-180.png
  icons/np-icon-192.png
  icons/np-icon-512.png
docs/
  API_CONTRACT.md
  CHANGELOG.md
  screenshots/
```

## API configuration

Edit only the deployment configuration in `assets/js/config.js` after the secure server API is ready:

- `apiEnabled`: set to `true` only after the endpoints are deployed and tested.
- `apiBaseUrl`: leave empty for same-origin API routes, or set the HTTPS API origin.
- `publicApiPrefix`: read-only public API prefix.
- `authApiPrefix`: login/session/logout/password API prefix.
- `adminApiPrefix`: authenticated administration API prefix.

Do not put passwords, tokens, password hashes, salts, pepper, private spreadsheet IDs or internal Drive IDs in frontend files.

## Security and data protection

- Public View is read-only and requires no login.
- Admin View requires authenticated accounts.
- Divisional users must be limited to their active Division; District Officers to their active District; Provincial roles to provincial functions.
- Public data must be explicitly approved for publication.
- No AUTH_USERS data, credentials, private assignments, contact details, payment records, private player data or internal storage IDs may be returned to public clients.
- API responses must not be cached by the service worker.

## QA note

The v0.1.1 rendering defect was corrected: the JavaScript mount point now uses `id="app"`, matching `document.getElementById("app")` in `app.js`.

The Public and Admin interfaces have been syntax-checked and browser-tested in preview mode. Live API authentication, database operations, role enforcement and public data publication cannot be certified until the HTTP adapter and backend are deployed.

## Screenshot notes

The screenshots in `docs/screenshots/` are visual QA captures. Files containing `ui-preview` or `mobile` use temporary test responses generated only during browser testing; they are not live Central Registry records and no test credentials are included in the application.
