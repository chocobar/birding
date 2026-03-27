# Design: Improve Data Fetch Performance

## Current Architecture

```
User enters postcode
        │
        ▼
  geocodePostcode()          ← postcodes.io (sequential, ~200ms)
        │
        ▼
  Promise.all([              ← parallel
    getBirdsForLocation()    ← /api/birds → eBird API (~500-1500ms)
    getNearbyLocations()     ← Overpass API (~1000-3000ms)
  ])
        │
        ▼
  Render 12 BirdCards        ← each fires useEffect → /api/bird-image
        │                       → 12 individual Wikipedia API calls (~200-500ms each)
        ▼
  Render LocationCards
```

**Total worst-case wait:** ~3000ms for data + ~500ms × 12 image lookups (waterfalled by browser connection limits, typically 6 concurrent per origin, so ~2 batches = ~1000ms).

## Proposed Changes

### 1. Batch Bird Image API (`/api/bird-image`)

**Decision:** Add a new batch endpoint `/api/bird-images` that accepts multiple bird names in one request and returns all image URLs at once.

**Rationale:** Instead of 12 individual HTTP requests from the browser, one request reduces overhead from connection setup, header repetition, and browser concurrency limits. The server can use `Promise.allSettled` to fetch all Wikipedia images in parallel (no browser connection limit on the server side).

**Implementation:**
- New `app/api/bird-images/route.ts` — accepts `POST { birds: [{ name, scientificName }] }` and returns `{ results: { [name]: { imageUrl, attribution } } }`
- Uses the existing `fetchWikipediaImage` logic and in-memory cache from the current route
- Keep the existing single-image endpoint for backward compatibility

### 2. Persistent Image Cache

**Decision:** Use Next.js `fetch()` with `next.revalidate` in the Wikipedia image lookup to leverage Next.js's built-in fetch cache (persists across restarts).

**Rationale:** Wikipedia image URLs for a given species rarely change. The current in-memory `Map` cache is lost on every server restart or redeployment. Next.js's built-in fetch cache is file-system backed and survives restarts — no need to add Redis or a database.

**Implementation:**
- In the Wikipedia fetch call, add `{ next: { revalidate: 86400 } }` (24-hour TTL) to the `fetch` options
- Remove the manual `imageCache` Map (Next.js handles it)

### 3. Server-Side Response Caching (eBird + Overpass)

**Decision:** Add `Cache-Control` headers to API responses and use Next.js fetch caching for upstream API calls.

**Rationale:** eBird data refreshes every few minutes, but for our use case (recent sightings in the last 14 days) a 15-minute cache is acceptable. Overpass geographic data changes very rarely; 1-hour cache is fine.

**Implementation:**
- `/api/birds/route.ts`: Add `{ next: { revalidate: 900 } }` (15 min) to the eBird fetch call
- `locationClient.ts`: Add `{ next: { revalidate: 3600 } }` (1 hour) to the Overpass fetch call. Note: Overpass uses POST, so we may need to implement a simple in-memory cache with TTL here instead since Next.js fetch cache may not cache POST requests.
- Add `Cache-Control` response headers so the browser also caches responses briefly

### 4. Paginated Bird Display ("Show More")

**Decision:** Show 6 birds initially with a "Show more" button to reveal the rest.

**Rationale:** Rendering fewer cards means fewer images to fetch initially. This improves perceived performance and reduces initial network load. Simpler than implementing infinite scroll or virtual scrolling.

**Implementation:**
- `BirdList.tsx`: Add state to track `visibleCount` (default 6), render `birds.slice(0, visibleCount)`, show "Show more" button when there are more birds
- Bird images for hidden birds are not fetched until they become visible (since image fetch is triggered by `BirdCard`'s `useEffect` on mount)
- The batch image API only fetches images for the visible birds; remaining images are fetched when "Show more" is clicked

### 5. Preload Bird Images from Server

**Decision:** Fetch bird images server-side in the `/api/birds` route alongside the eBird data, returning `imageUrl` with each bird.

**Rationale (considered but rejected):** This would move all image fetching to the server and simplify the client. However, it would significantly increase the response time of `/api/birds` (adding up to 12 Wikipedia lookups before responding). The batch client-side approach is better because it allows progressive rendering — bird text data appears immediately while images load.

**Final decision:** Keep image fetching client-side but batch it (approach #1 above).

## Key Technical Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Batch vs individual image requests | Batch POST endpoint | Reduces 12 requests to 1; server has no connection limit for upstream calls |
| Cache strategy | Next.js built-in fetch cache + response headers | No new infrastructure; persists across restarts |
| Pagination approach | "Show more" button | Simpler than infinite scroll; defers image loading naturally |
| Where to fetch images | Client-side (batched) | Allows progressive rendering — text appears before images |
| Overpass caching | In-memory Map with TTL | POST requests may not be cached by Next.js fetch cache |

## Files to Change

| File | Change |
|------|--------|
| `app/api/bird-images/route.ts` | **New** — batch image lookup endpoint |
| `app/api/bird-image/route.ts` | Extract shared `fetchWikipediaImage` + use `next.revalidate` on fetch |
| `app/api/birds/route.ts` | Add `next.revalidate` to eBird fetch call; add `Cache-Control` header |
| `lib/api/locationClient.ts` | Add in-memory TTL cache for Overpass responses |
| `lib/api/birdClient.ts` | Add function to call batch image endpoint |
| `components/BirdCard.tsx` | Accept pre-resolved `imageUrl` prop; skip `useEffect` fetch when image URL already provided |
| `components/BirdList.tsx` | Add "Show more" pagination; call batch image API for visible birds and pass URLs to cards |
| `app/page.tsx` | No changes needed (BirdList handles pagination internally) |

## Codebase Patterns Observed

- **This is a Next.js 16 project** — read `node_modules/next/dist/docs/` before writing code (per `AGENTS.md`)
- **Client components** use `'use client'` directive — all search/results logic is client-side
- **React Query (`@tanstack/react-query`)** is installed but not currently used in the main flow — could be leveraged for caching in a future iteration
- **Tailwind CSS v4** with CSS custom properties for theming (e.g. `var(--warm-sand)`)
- **No testing framework** is set up — changes should be manually verifiable
- **Existing in-memory cache pattern** in `bird-image/route.ts` uses a `Map` — the Overpass cache can follow this pattern with TTL added