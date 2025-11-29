# Admin Debug Clock Endpoint

Purpose: Quickly compute the geofence distance and diagnostic flags for a given location and coordinates to help debug clock-in/out GPS issues.

Route: `POST /api/admin/debug/clock-check`

Auth: Requires an admin session cookie (`admin_session`) set by logging in via the admin UI.

Request JSON:

```json
{ "locationId": "<id>", "lat": 33.12345, "lng": -96.54321 }
```

- `locationId` (string) — required.
- `lat`, `lng` (number) — optional but recommended for direct checks.

Response: JSON with fields:

- `locationId`
- `locationName`
- `siteLat`, `siteLng`
- `siteRadiusMeters`
- `providedLat`, `providedLng`
- `providedInvalid` (bool)
- `maybeSwapped` (bool)
- `siteCoordsInvalid` (bool)
- `distance` (meters, integer or null)
- `allowed` (boolean)
- `toleranceMeters` (number)

Tolerance: The server uses a small GPS tolerance to allow noise. Current clock-in tolerance is 75 meters. Update the constant in `app/api/clock/route.ts` if you want to change it.

## Example curl (replace `ADMIN_SESSION` and `LOCATION_ID`)

```bash
curl -X POST "http://localhost:3000/api/admin/debug/clock-check" \
  -H "Content-Type: application/json" \
  -H "Cookie: admin_session=ADMIN_SESSION" \
  -d '{"locationId":"LOCATION_ID","lat":33.12345,"lng":-96.54321}'
```

Notes:

- Running the app in development (`NODE_ENV !== "production"`) is recommended when using this endpoint so you can safely reproduce checks without doing an actual clock action.
- The endpoint is read-only for diagnostic purposes and does not create or modify shifts.
