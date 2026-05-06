# Design: Global Location Support with Autocomplete

## Codebase Patterns

- **Next.js 14+ App Router** with React 19 and TypeScript
- **Client components** use `'use client'` directive; data fetching via `@tanstack/react-query`
- **API clients** live in `lib/api/`, types in `lib/types/`, utilities in `lib/utils/`
- **Downstream consumers are already global** — `birdClient.ts` and `locationClient.ts` only need lat/lng, so the change is isolated to the geocoding/search layer

## Current Flow (UK-only)

```
PostcodeSearch.tsx → postcodeValidator.ts → postcodeClient.ts (Postcodes.io) → lat/lng → birdClient / locationClient
```

The coupling to UK postcodes exists in three places:
1. `PostcodeSearch.tsx` — validates UK format before submitting
2. `postcodeValidator.ts` — UK regex only
3. `postcodeClient.ts` — calls Postcodes.io (UK-only API)

## Proposed Flow (Global)

```
LocationSearch.tsx → geocodeClient.ts (Nominatim) → lat/lng → birdClient / locationClient
                   ↕ (autocomplete)
             Nominatim /search?q=...
```

### Key Decision: OpenStreetMap Nominatim

**Chosen over** Google Geocoding API, Mapbox, Geoapify, etc.

**Rationale:**
- Free, no API key required (matches the project's existing zero-auth pattern)
- Already using OpenStreetMap data (Overpass API) for locations — consistent data source
- Supports both forward geocoding and autocomplete-style search
- Returns structured place names suitable for display

**Constraints to respect (Nominatim usage policy):**
- Max 1 request/second — enforce with debounce (300ms) + a simple throttle
- Must send a custom `User-Agent` header identifying the app
- No heavy bulk usage — autocomplete with debounce is fine

### UK Postcodes — Still Supported, No Special Path

Rather than maintaining a separate UK postcode path, we let Nominatim handle postcodes too. Nominatim geocodes "SW1A 1AA" correctly, returning the right lat/lng. This eliminates the need for `postcodeValidator.ts` and `postcodeClient.ts` entirely.

If Nominatim postcode results prove less accurate in practice, we can add a fallback to Postcodes.io later, but this is not expected to be needed.

## Component Changes

### New: `LocationSearch.tsx` (replaces `PostcodeSearch.tsx`)

- Renames the component from `PostcodeSearch` to `LocationSearch`
- Removes UK postcode validation — accepts any free-text query
- Adds autocomplete dropdown with debounced Nominatim lookups
- Updates placeholder text: `"Search any location…"` (instead of `"Enter your UK postcode…"`)
- Implements ARIA combobox pattern for accessibility (role="combobox", aria-expanded, aria-activedescendant, listbox role on dropdown)
- Keyboard navigation: ↑/↓ to move, Enter to select, Escape to close

### New: `lib/api/geocodeClient.ts` (replaces `postcodeClient.ts`)

Two functions:

1. **`searchLocations(query: string)`** — calls Nominatim `/search` endpoint, returns array of `{ displayName, latitude, longitude }` for autocomplete suggestions
2. **`reverseGeocode(lat, lng)`** — calls Nominatim `/reverse` endpoint, returns a display name for the "Use my location" feature

### New: `lib/types/GeocodedLocation.ts` (replaces `PostcodeResult.ts`)

```
interface GeocodedLocation {
  displayName: string;
  latitude: number;
  longitude: number;
}
```

Simpler than `PostcodeResult` — drops UK-specific fields (`eastings`, `northings`, `parish`, etc.) that nothing downstream uses.

### Updated: `app/page.tsx`

- Import `LocationSearch` instead of `PostcodeSearch`
- `handleSearch` receives a `GeocodedLocation` (with lat/lng already resolved) instead of a postcode string, so it no longer needs to call `geocodePostcode()` itself
- Update the display text ("Enter your postcode" → "Search any location")
- The "Use my location" button now calls `reverseGeocode()` instead of Postcodes.io reverse lookup

### Updated: footer in `app/page.tsx`

- Remove "UK postcodes currently supported" text
- Keep Postcodes.io attribution only if we retain it as fallback; otherwise replace with Nominatim/OpenStreetMap attribution (OpenStreetMap is already credited)

## Files to Remove

- `lib/utils/postcodeValidator.ts` — no longer needed
- `lib/api/postcodeClient.ts` — replaced by `geocodeClient.ts`
- `lib/types/PostcodeResult.ts` — replaced by `GeocodedLocation.ts`

## Files Unchanged

- `lib/api/birdClient.ts` — already takes lat/lng
- `lib/api/locationClient.ts` — already takes lat/lng
- `lib/hooks/useBirdSearch.ts` — already takes lat/lng
- `components/BirdList.tsx`, `BirdCard.tsx`, `LocationList.tsx`, `LocationCard.tsx` — no changes
- `app/api/birds/route.ts` — no changes

## Autocomplete UX Details

- **Trigger:** 3+ characters typed, after 300ms debounce
- **Results:** Show up to 5 suggestions in a dropdown below the search input
- **Display format:** Use Nominatim's `display_name` field (e.g. "Houston, Harris County, Texas, United States")
- **Selection:** Click or Enter fills the input and immediately triggers the search
- **Dismiss:** Escape key or click outside closes the dropdown
- **Loading state:** Show a subtle spinner inside the dropdown while fetching
- **No results:** Show "No locations found" message in the dropdown

## Risk & Mitigations

| Risk | Mitigation |
|------|------------|
| Nominatim rate-limiting | 300ms debounce + respect 1 req/s policy |
| Nominatim downtime | Show a clear error; user can retry. Geolocation button still works (passes coords directly) |
| UK postcode geocoding less precise via Nominatim | Test during implementation; add Postcodes.io fallback if needed |
| Autocomplete dropdown covering content on mobile | Position dropdown absolutely; limit to 5 results; close on scroll |