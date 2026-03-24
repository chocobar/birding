# Design: eBird API Integration for Live Bird Data

## Current Architecture

The birding-3 app is a Next.js 16 client-side app with this data flow:

1. User enters UK postcode → `postcodeClient.ts` calls Postcodes.io → returns lat/lng
2. lat/lng → `birdClient.ts` returns **hardcoded mock data** (15 static UK birds, ignores coordinates)
3. lat/lng → `locationClient.ts` calls OpenStreetMap Overpass API → returns real nearby locations

The bird data is the only mock piece. Locations and geocoding are already live.

## Key Codebase Facts (Discovered During Planning)

- **Environment variable is already set:** `NEXT_PUBLIC_EBIRD_API_KEY` is available in the environment
- **`.env*` is already gitignored** — no changes needed to `.gitignore`
- **No Next.js API routes exist** — all API calls happen client-side (the `NEXT_PUBLIC_` prefix makes the key available in browser code, which is fine for eBird — it's a free, non-sensitive key)
- **The `Bird` type** in `lib/types/Bird.ts` has: `id`, `commonName`, `scientificName`, `imageUrl?`, `description?`, `frequency?`, `conservationStatus?`, `season?`
- **BirdCard component** renders: name, scientific name, image, description, conservation status badge, frequency bar
- **Next.js 16 has breaking changes** — the `AGENTS.md` warns to check `node_modules/next/dist/docs/` before writing code

## eBird API 2.0 Integration

### Endpoint

**GET** `https://api.ebird.org/v2/data/obs/geo/recent`

| Param | Value | Notes |
|-------|-------|-------|
| `lat` | from postcode geocoding | Required |
| `lng` | from postcode geocoding | Required |
| `dist` | `8` (km) ≈ 5 miles | Matches current radius |
| `maxResults` | `12` | Matches current slice(0, 12) |
| `back` | `14` | Last 14 days of observations |

**Header:** `X-eBirdApiToken: <API_KEY>`

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
| `frequency` | Not available | Omit — the frequency bar won't show (BirdCard already handles `undefined`) |
| `imageUrl` | Not available | Omit — BirdCard already shows a placeholder icon when missing |
| `conservationStatus` | Not available | Omit — badge won't render (already handled) |

## Design Decisions

### 1. Client-side fetch (no API route)

**Decision:** Call eBird directly from the browser, same as the current mock pattern.

**Rationale:** The `NEXT_PUBLIC_` prefix is already chosen by the user, indicating intent for client-side use. eBird API keys are free and non-sensitive (rate-limited, not billing-linked). Adding a server-side API route would add complexity with no security benefit for this use case.

### 2. Deduplicate by species

The eBird "recent observations" endpoint returns one entry per observation, so the same species can appear multiple times (from different locations/dates). We should deduplicate by `speciesCode`, keeping the most recent observation per species.

### 3. Fallback to mock data

If the API call fails or the key is missing, return the existing mock data. This keeps the demo functional without an API key. A small text indicator below the bird list heading will say "Live data from eBird" or "Sample data (eBird unavailable)" so the user knows what they're seeing.

### 4. No image changes

eBird doesn't provide images via the observations API. The BirdCard already handles missing `imageUrl` with a placeholder bird icon. No changes needed to the card component.

## Files to Change

| File | Change |
|------|--------|
| `lib/api/birdClient.ts` | Replace mock implementation with eBird API call + fallback |
| `lib/types/Bird.ts` | Add optional `locationName?: string` and `observationDate?: string` fields |
| `components/BirdCard.tsx` | Show observation location/date when available (small text below description) |
| `components/BirdList.tsx` | Add data source indicator ("Live data" vs "Sample data") |
| `.env.local.example` | Create with `NEXT_PUBLIC_EBIRD_API_KEY=your_key_here` |
| `README.md` | Update API section to reflect eBird is now integrated |

## What NOT to Change

- `postcodeClient.ts` — geocoding works fine as-is
- `locationClient.ts` — already uses live OpenStreetMap data
- `page.tsx` — the search flow and state management don't need changes
- `next.config.ts` — no new image domains needed (eBird doesn't serve images)
- No new dependencies needed — using native `fetch`
