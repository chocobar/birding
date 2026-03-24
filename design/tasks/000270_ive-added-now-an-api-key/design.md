# Design: eBird API Integration for Live Bird Data

## Current Architecture

The birding-3 app is a Next.js 16 client-side app with this data flow:

1. User enters UK postcode → `postcodeClient.ts` calls Postcodes.io → returns lat/lng
2. lat/lng → `birdClient.ts` returns **hardcoded mock data** (15 static UK birds, ignores coordinates)
3. lat/lng → `locationClient.ts` calls OpenStreetMap Overpass API → returns real nearby locations

The bird data is the only mock piece. Locations and geocoding are already live.

## Key Codebase Facts (Discovered During Planning)

- **Environment variable is already set:** `NEXT_PUBLIC_EBIRD_API_KEY` is currently in the environment — but this prefix exposes it to the browser, so we will **rename it to `EBIRD_API_KEY`** (server-only)
- **`.env*` is already gitignored** — no changes needed to `.gitignore`
- **No Next.js API routes exist yet** — we will create the first one at `app/api/birds/route.ts`
- **The `Bird` type** in `lib/types/Bird.ts` has: `id`, `commonName`, `scientificName`, `imageUrl?`, `description?`, `frequency?`, `conservationStatus?`, `season?`
- **BirdCard component** renders: name, scientific name, image, description, conservation status badge, frequency bar
- **Next.js 16 has breaking changes** — the `AGENTS.md` warns to check `node_modules/next/dist/docs/` before writing code

## Security: Why a Server-Side Proxy

**Problem:** The original plan used `NEXT_PUBLIC_EBIRD_API_KEY` and called eBird directly from the browser. This means:
- The API key is bundled into client-side JavaScript (visible in page source)
- The API key is sent as an `X-eBirdApiToken` HTTP header (visible in browser DevTools → Network tab)
- Anyone inspecting traffic can copy and abuse the key

**Solution:** Route all eBird requests through a Next.js API route. The browser calls `/api/birds?lat=...&lng=...` (no key needed). The server-side route reads `EBIRD_API_KEY` from `process.env` (never bundled to the client) and forwards the request to eBird.

## New Architecture (with API route)

```
Browser                          Server (Next.js)                    eBird API
──────                          ────────────────                    ─────────
1. User searches postcode
2. postcodeClient → Postcodes.io → lat/lng
3. birdClient calls:
   GET /api/birds?lat=51.5&lng=-0.12
   (no API key sent)
                                4. Route handler reads
                                   process.env.EBIRD_API_KEY
                                5. Calls eBird API with key
                                   in X-eBirdApiToken header
                                                                   6. Returns observations
                                7. Maps + deduplicates
                                8. Returns JSON to browser
9. Renders bird cards
```

## eBird API 2.0 Details

### Endpoint

**GET** `https://api.ebird.org/v2/data/obs/geo/recent`

| Param | Value | Notes |
|-------|-------|-------|
| `lat` | from postcode geocoding | Required |
| `lng` | from postcode geocoding | Required |
| `dist` | `8` (km) ≈ 5 miles | Matches current radius |
| `maxResults` | `12` | Matches current slice(0, 12) |
| `back` | `14` | Last 14 days of observations |

**Header:** `X-eBirdApiToken: <EBIRD_API_KEY>`

### eBird Response Shape

```json
[
  {
    "speciesCode": "eurrob1",
    "comName": "European Robin",
    "sciName": "Erithacus rubecula",
    "locName": "Hyde Park",
    "obsDt": "2025-01-15 08:30",
    "howMany": 3,
    "lat": 51.507,
    "lng": -0.165,
    "subId": "S123456"
  }
]
```

### Mapping eBird → Bird Type

| Bird field | eBird source | Notes |
|------------|-------------|-------|
| `id` | `speciesCode` | Unique per species |
| `commonName` | `comName` | Direct map |
| `scientificName` | `sciName` | Direct map |
| `description` | Generated | e.g. "Observed at Hyde Park on Jan 15, 2025 (3 individuals)" |
| `locationName` | `locName` | New optional field |
| `observationDate` | `obsDt` | New optional field |
| `frequency` | Not available | Omit — the frequency bar won't show (BirdCard already handles `undefined`) |
| `imageUrl` | Not available | Omit — BirdCard already shows a placeholder icon when missing |
| `conservationStatus` | Not available | Omit — badge won't render (already handled) |

## Design Decisions

### 1. Server-side API route proxy (protects the API key)

**Decision:** Create a Next.js Route Handler at `app/api/birds/route.ts` that proxies requests to eBird. The browser only calls `/api/birds?lat=...&lng=...`.

**Rationale:** The `NEXT_PUBLIC_` prefix exposes environment variables to the browser bundle. Even though eBird keys are free, the user's key is tied to their account and could be rate-limited or revoked if abused. A server-side proxy keeps the key in `process.env` only — never in client JS or network requests visible in DevTools.

**Implication:** The env var must be renamed from `NEXT_PUBLIC_EBIRD_API_KEY` to `EBIRD_API_KEY`. The `.env.local` file (and any deployment config like Vercel) should use the new name.

### 2. Input validation on the API route

The route handler validates `lat` and `lng` query parameters before forwarding to eBird:
- Both must be present and numeric
- `lat` must be between -90 and 90
- `lng` must be between -180 and 180
- Returns 400 with a clear error if validation fails

### 3. Deduplicate by species

The eBird "recent observations" endpoint returns one entry per observation, so the same species can appear multiple times (from different locations/dates). The server-side route deduplicates by `speciesCode`, keeping the most recent observation per species.

### 4. Fallback to mock data (client-side)

If the `/api/birds` call fails (server error, missing key, eBird down), `birdClient.ts` catches the error and returns the existing mock data. The response from the API route includes an `isLiveData: boolean` flag so the UI can indicate the data source. On fallback, `birdClient.ts` sets this to `false`.

### 5. No image changes

eBird doesn't provide images via the observations API. The BirdCard already handles missing `imageUrl` with a placeholder bird icon. No changes needed to the card component for images.

## Files to Change

| File | Change |
|------|--------|
| `app/api/birds/route.ts` | **New file** — Next.js Route Handler that reads `EBIRD_API_KEY` from `process.env`, calls eBird, deduplicates, and returns mapped `Bird[]` JSON with an `isLiveData` flag |
| `lib/api/birdClient.ts` | Replace mock implementation: call `/api/birds?lat=...&lng=...` instead of returning hardcoded data. Fall back to mock data on error |
| `lib/types/Bird.ts` | Add optional fields: `locationName?: string`, `observationDate?: string` |
| `components/BirdCard.tsx` | Show observation location and date below the description when `locationName` or `observationDate` are present |
| `components/BirdList.tsx` | Add a small data source indicator below the heading (e.g. "Live data from eBird" vs "Sample data") via an `isLiveData` prop |
| `app/page.tsx` | Pass `isLiveData` flag through to `BirdList` |
| `.env.local.example` | Create with `EBIRD_API_KEY=your_key_here` (no `NEXT_PUBLIC_` prefix) |
| `README.md` | Update API section: eBird is now live, document `.env.local` setup with `EBIRD_API_KEY` |

## What NOT to Change

- `postcodeClient.ts` — geocoding works fine as-is
- `locationClient.ts` — already uses live OpenStreetMap data
- `next.config.ts` — no new image domains needed (eBird doesn't serve images)
- `.gitignore` — `.env*` is already ignored
- No new npm dependencies needed — using native `fetch` on both client and server

## Implementation Notes

### Environment Variable Handling
- The `NEXT_PUBLIC_EBIRD_API_KEY` env var was already set in the environment. We renamed it to `EBIRD_API_KEY` (dropped `NEXT_PUBLIC_` prefix) and created a `.env.local` file with the server-only name.
- Next.js 16 loads `.env.local` automatically — confirmed in dev server output: `Environments: .env.local`
- The `.env.local` file is already gitignored by the default `.gitignore` pattern `.env*`.

### Next.js 16 Route Handlers
- Checked `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` — the standard pattern `export async function GET(request: Request)` works unchanged in Next.js 16.
- Route Handlers use Web standard `Request`/`Response` APIs. `Response.json()` works directly.
- The build correctly identifies `/api/birds` as `ƒ (Dynamic)` — server-rendered on demand, which is what we need since it reads `process.env` at runtime.
- `NextRequest` from `next/server` provides `nextUrl.searchParams` for easy query parameter access.

### eBird API Details
- Endpoint: `GET https://api.ebird.org/v2/data/obs/geo/recent`
- Auth header: `X-eBirdApiToken: <key>` — returns 403 without it.
- Response is a flat JSON array of observation objects (not paginated, not wrapped).
- We request `maxResults=50` then deduplicate by `speciesCode` (same species seen at multiple locations) and limit to 12 unique species.
- The `howMany` field is optional — some observations don't report count.
- The `obsDt` format is `"YYYY-MM-DD HH:MM"` — we split on space to display just the date in the UI.

### Fallback Behavior
- When `EBIRD_API_KEY` is missing, the server route returns `{ birds: [], isLiveData: false }` with status 200 (not an error status). The client-side `birdClient.ts` detects `isLiveData: false` and serves mock data instead.
- The UI adapts its heading: "Recent Bird Sightings" (live) vs "Common Birds in Your Area" (fallback), and shows a colored data source indicator.

### Security Verification
- Confirmed via browser DevTools Network tab: the `/api/birds?lat=...&lng=...` request contains NO API key in headers, URL, or body. The key only exists server-side in `process.env`.
- The eBird API call happens entirely on the Next.js server — the browser never contacts `api.ebird.org` directly.

### Gotchas
- When testing without the API key, you must actually remove/rename `.env.local` and restart the dev server. Setting `EBIRD_API_KEY=` as an inline env override doesn't work because `.env.local` takes precedence in Next.js's env loading order.
- The Overpass API (for locations) occasionally returns 504 Gateway Timeout — this is pre-existing and unrelated to our changes. The `locationClient.ts` already has mock fallback for this.