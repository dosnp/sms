# Public API Contract — v0.1.2

The public portal is read-only. These endpoints must return only information that has been explicitly approved for public release.

## Public endpoints

### 1. Province directory

`GET /api/public/v1/province`

```json
{
  "success": true,
  "data": {
    "province": { "id": "NORTHERN", "name": "Northern Province" },
    "districts": [
      { "id": "DST-...", "code": "JAF", "name": "Jaffna", "slug": "jaffna", "status": "ACTIVE" }
    ]
  }
}
```

### 2. District public page

`GET /api/public/v1/districts/{districtSlug}`

```json
{
  "success": true,
  "data": {
    "district": { "id": "DST-...", "name": "Jaffna", "slug": "jaffna" },
    "divisions": [
      { "id": "DIV-...", "name": "Point Pedro", "slug": "point-pedro", "status": "ACTIVE" }
    ]
  }
}
```

### 3. Division public page

`GET /api/public/v1/divisions/{districtSlug}/{divisionSlug}`

```json
{
  "success": true,
  "data": {
    "district": { "id": "DST-...", "name": "Jaffna", "slug": "jaffna" },
    "division": {
      "id": "DIV-...", "name": "Point Pedro", "slug": "point-pedro",
      "publicDescription": "Approved public description"
    },
    "publicSections": [
      { "title": "Sports events", "description": "Approved public information" }
    ]
  }
}
```

## Authentication endpoints

All authentication endpoints are HTTPS-only and must be rate-limited.

- `POST /api/auth/v1/login` — body: `{ "username": "...", "password": "..." }`; response: `{ "success": true, "data": { "token": "...", "context": { "userId": "...", "username": "...", "fullName": "...", "role": "...", "scopeLevel": "...", "districtId": "...", "district": "...", "divisionId": "...", "division": "...", "assignmentId": "...", "mustChangePassword": false } } }`.
- `GET /api/auth/v1/session` — `Authorization: Bearer <token>`; validates the session and returns the current context. It must resolve the latest effective assignment on the server.
- `POST /api/auth/v1/logout` — `Authorization: Bearer <token>`; revokes the session.
- `POST /api/auth/v1/change-password` — `Authorization: Bearer <token>`; body: `{ "currentPassword": "...", "newPassword": "...", "confirmPassword": "..." }`; response returns a refreshed token and context if the session implementation rotates tokens.

## Authenticated administration endpoints

Every endpoint below requires `Authorization: Bearer <token>`. The backend must resolve the user's current role and assignment from the authoritative identity/assignment store. Do not accept a client-supplied role, user ID, district ID or division ID as proof of access.

- `GET /api/admin/v1/overview` — returns only counts and scope details the signed-in role is allowed to see.
- `GET /api/admin/v1/districts` — maps to the provincial `getDistricts` action.
- `POST /api/admin/v1/districts` — body `{ "districtCode": "KIL", "districtName": "Kilinochchi" }`; maps to `createDistrict`.
- `GET /api/admin/v1/divisions` — returns all registered divisions for Provincial Officer / Department Sports Officer roles, limited to the province. Developer may optionally filter by `districtId`.
- `GET /api/admin/v1/divisions?districtId=...` — maps to `getDivisions` for Developer / District Officer. A District Officer's district must be derived from the active assignment; a supplied different district ID must be rejected.
- `GET /api/admin/v1/division-catalog?districtId=...` — returns the official active Division Catalogue for the authorised district. This read endpoint is required by the Division registration screen.
- `POST /api/admin/v1/divisions` — body `{ "districtId": "...", "divisionCode": "..." }`; maps to `createDivision`. The server validates the district scope and official catalogue entry.
- `GET /api/admin/v1/officers` — Developer-only account listing. Never return password hashes, salts, pepper values or session tokens.
- `POST /api/admin/v1/officers` — Developer-only account creation; body uses the `createUserAccount` fields `username`, `fullName`, `role`, `district`, `division`, `clubName`, `password` and `confirmPassword`. It creates a login identity only; a separate effective-dated assignment must be registered for District / Division access.
- `GET /api/admin/v1/assignments` — returns assignment records within the caller's authorised scope.
- `POST /api/admin/v1/assignments` — body `{ "scopeLevel": "DISTRICT|DIVISION", "userId": "USR-...", "districtId": "...", "divisionId": "...", "effectiveFrom": "YYYY-MM-DD", "transferReference": "...", "notes": "..." }`. `DISTRICT` maps to `provincialApiCall('assignDistrictOfficer', [data], token)`; `DIVISION` maps to `districtApiCall('assignDivisionOfficer', [data], token)`. The server derives the actor's allowed scope and validates the actual effective date.
- `GET /api/admin/v1/transfers` — returns transfer history within the caller's authorised scope.
- `POST /api/admin/v1/transfers` — body `{ "transferType": "DISTRICT|DIVISION_CROSS_DISTRICT|DIVISION_WITHIN_DISTRICT", "userId": "USR-...", "targetDistrictId": "...", "targetDivisionId": "...", "effectiveFrom": "YYYY-MM-DD", "transferReference": "...", "notes": "..." }`. Map the three transfer types to `transferDistrictOfficer`, `transferDivisionOfficerAcrossDistricts` or `transferDivisionOfficer` in the relevant Provincial / District action gateway. The server must check the officer's current assignment and effective-date boundaries.
- `GET /api/admin/v1/reports` — returns only reports the caller is authorised to view.
- `GET /api/admin/v1/audit-log` — Developer-only audit records, with sensitive fields removed.
- `GET /api/admin/v1/settings` — Developer-only safe application configuration. Do not return secrets or internal Drive/Spreadsheet IDs.

The v0.1.0 Apps Script architecture package already provides the authentication and core action functions such as `login`, `logout`, `changePassword`, `provincialApiCall('getDistricts'...)`, `provincialApiCall('createDistrict'...)`, `provincialApiCall('assignDistrictOfficer'...)`, `provincialApiCall('transferDistrictOfficer'...)`, `provincialApiCall('transferDivisionOfficerAcrossDistricts'...)`, `districtApiCall('getDivisions'...)`, `districtApiCall('createDivision'...)`, `districtApiCall('assignDivisionOfficer'...)`, `districtApiCall('transferDivisionOfficer'...)`, `getUserAccounts` and `createUserAccount`. The REST routes above are an HTTP adapter contract for the PWA; they are **not** implemented by the supplied frontend ZIP. Province-wide division listing, division catalogue reads, overview aggregation, assignment/transfer list reads, reports, audit-log and safe settings endpoints require additional server-side read functions or adapters.

## Mandatory security requirements

1. Resolve district and division slugs against the Central Registry on the server.
2. Verify that each division belongs to the requested district.
3. Return only records explicitly approved for public visibility from public endpoints.
4. Admin API scope is derived from the authenticated session and current effective-dated assignment on every request.
5. A Developer can access provincial configuration; Provincial Officers are restricted to provincial functions; District Officers are restricted to their assigned district; Divisional Sports Officers are restricted to their assigned division.
6. Client-side navigation visibility is not an access-control boundary. Enforce all permissions on the server.
7. Never return AUTH_USERS password hashes, salts, pepper, session tokens, private assignments, personal contact details, payment information, private player records, or internal Drive/Spreadsheet IDs to public clients.
8. Never cache `/api/` responses in the service worker. Use `Cache-Control: no-store` for authenticated responses.
9. Apply HTTPS, CORS allow-listing, request validation, rate limits, audit logging and session expiry/revocation.

## Shareable public page URLs

The same PWA deployment provides separate, shareable public routes:

- Province: `/#/province`
- District: `/#/district/jaffna`
- Division: `/#/division/jaffna/point-pedro`
- Admin sign-in: `/#/admin/login`

These are separate public page URLs, not separate deployments. The server must validate each requested slug and must not expose unpublished divisions.
