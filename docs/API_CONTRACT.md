# Proposed Public API Contract

This is the frontend integration contract. These endpoints are not implemented by this frontend package.

## 1. Province directory

`GET /api/public/v1/province`

Expected response data:

```json
{
  "province": {
    "id": "NORTHERN",
    "name": "Northern Province"
  },
  "districts": [
    {
      "id": "DISTRICT_ID",
      "code": "JAF",
      "name": "Jaffna",
      "slug": "jaffna",
      "status": "ACTIVE"
    }
  ]
}
```

## 2. District public page

`GET /api/public/v1/districts/{districtSlug}`

Expected response data:

```json
{
  "district": {
    "id": "DISTRICT_ID",
    "name": "Jaffna",
    "slug": "jaffna"
  },
  "divisions": [
    {
      "id": "DIVISION_ID",
      "name": "Point Pedro",
      "slug": "point-pedro",
      "status": "ACTIVE"
    }
  ]
}
```

## 3. Division public page

`GET /api/public/v1/divisions/{districtSlug}/{divisionSlug}`

Expected response data:

```json
{
  "district": {
    "id": "DISTRICT_ID",
    "name": "Jaffna",
    "slug": "jaffna"
  },
  "division": {
    "id": "DIVISION_ID",
    "name": "Point Pedro",
    "slug": "point-pedro",
    "publicDescription": "Approved public description"
  },
  "publicSections": [
    {
      "title": "Sports events",
      "description": "Approved public information"
    }
  ]
}
```

## Mandatory server-side security rules

- Resolve all slugs against the Central Registry on the server.
- Verify that the division belongs to the requested district.
- Return only records explicitly marked and approved for public visibility.
- Never return AUTH_USERS, password hashes, salts, pepper, session tokens, private assignments, personal contact details, payment information, player-private records, or internal Drive IDs.
- Keep this API read-only.
- Do not trust client-side visibility checks as a security boundary.
- Log and rate-limit public requests appropriately.
