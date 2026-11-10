# Northern Province Sports Management – Public PWA

Version: **0.1.1**

This package is the complete public-frontend source for the Northern Province Department of Sports portal.

## Included

- Responsive provincial homepage
- Five-district directory
- Separate public hash URLs for each district
- Separate public hash URLs for each registered division
- Existing Jaffna → Point Pedro preview entry
- PWA manifest and PNG app icons
- Service worker with scoped cache cleanup and offline fallback
- No officer login, credentials, payment data, private database IDs, password hashes, or secrets

## Current status

This is a frontend preview. It is **not yet connected to the live Central Registry**. The public read-only API must be implemented and security-tested before the portal is presented as an official live-data service.

## Upload the complete project to GitHub

1. Download and extract this ZIP.
2. Open the `dosnp/sms` repository.
3. Choose **Add file → Upload files**.
4. Open the extracted `northern-province-sports-pwa-v0.1.1` folder.
5. Select and upload the contents inside that folder. Do not upload only the ZIP.
6. Ensure `index.html` is at the repository root, beside `service-worker.js` and `manifest.webmanifest`.
7. Commit the changes to the `main` branch.

When GitHub reports that files already exist, choose the normal replace/update action. Do not delete the repository.

## GitHub Pages

Do not change the repository from Private to Public until all repository files have been reviewed for secrets. GitHub Pages plan and visibility requirements must be checked in the repository Settings → Pages before enabling deployment.

The website itself is designed as a public portal. The source repository does not have to be made public if the account plan supports Pages from a private repository.

## Public API integration – later step

The frontend currently has `apiBaseUrl` empty and `previewMode: true` in `assets/js/config.js`.

After a secure read-only public API is deployed, configure the API base URL and test the API contract in `docs/API_CONTRACT.md`.

Never put any of the following in frontend files:
- Passwords or password hashes
- Password salts or pepper
- Session tokens
- AUTH_USERS data
- Private player or officer records
- Payment records
- Internal Google Drive or spreadsheet IDs

Only records explicitly approved for public release may be returned by the public API.
