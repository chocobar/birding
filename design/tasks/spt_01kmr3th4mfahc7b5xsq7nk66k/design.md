# Design: Data Fetch Performance Improvements

## Codebase Observations

- **Next.js 16 app** with `app/` router, client-side data fetching via `useState` in `page.tsx`.
- **Three external APIs hit per search:** postcodes.io (geocoding), eBird (birds via `/api/birds` proxy), Overpass/OSM (locations).
- Birds + locations already fetched in parallel via `Promise.all` in `page.tsx` — good.
- **`@tanstack/react-query` is installed** (`package.json`) but completely unused — all fetching is manual `fetch()` + `useState`.
- Each `BirdCard` individually calls `/api/bird-image` on mount (Wikipedia lookup), creating up to 12 parallel requests with up to 3 Wikipedia API attempts each. **This is the single biggest bottleneck.**
- The eBird proxy requests `maxResults: '50'` but only displays 12 birds. Wasted bandwidth.
- Overpass query searches 11 feature types in one large query. Results capped at 10 client-side.
- No pagination — all results rendered at once, no way to load more.
- No caching — repeat searches re-fetch everything.

## Architecture

### Strategy 1: Batch bird image fetching (biggest win)

Instead of 12 individual `/api/bird-image?name=X` calls from each `BirdCard`, create a single **batch endpoint** `/api/bird-images` that accepts multiple bird names and returns all image URLs in one response.

- Server-side: use `Promise.allSettled` to fetch all Wikipedia images concurrently.
- The existing in-memory `imageCache` in `bird-image/route.ts` already helps on repeat requests — the batch endpoint reuses it.
- `BirdCard` stops fetching its own image; `BirdList` fetches all images in one call and passes URLs down as props.

### Strategy 2: Adopt React Query for caching + deduplication

Wire up `@tanstack/react-query` (already installed) to handle:

- **Caching** — identical postcode searches return instantly from cache.
- **Stale-while-revalidate** — show cached data immediately, refresh in background.
- **Deduplication** — rapid re-searches don't fire duplicate requests.

Create custom hooks: `useBirdSearch(lat, lng)`, `useLocationSearch(lat, lng)`, `useBirdImages(birdNames)`.

### Strategy 3: Reduce eBird over-fetching

Change `maxResults` from `'50'` to `'15'` in `/api/birds/route.ts`. We only display 12 after dedup, so 15 gives enough headroom without wasting bandwidth.

### Strategy 4: Pagination for bird results

Add simple "Show more" pagination to the bird list:

- Display 6 birds initially (2 rows of 3 on desktop).
- "Show more" button loads the next 6.
- This is **client-side pagination** of already-fetched data — no extra API calls needed since we fetch 12-15 birds total.
- Reduces initial render time and image fetches (only 6 images needed upfront).

### Strategy 5: Skeleton loading improvements

The app already has skeleton loaders. With React Query, loading states become more granular:

- Birds and locations can show/hide their skeletons independently (already separate `isLoadingBirds` / `isLoadingLocations`).
- Bird images can show individual placeholders while the batch image request resolves.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Batch vs individual image fetch | Batch endpoint | Reduces 12 HTTP requests to 1; biggest perf win |
| Caching library | `@tanstack/react-query` | Already installed, zero new deps |
| Pagination approach | Client-side "Show more" | Data set is small (12-15 birds); no server pagination needed |
| Initial page size | 6 birds | Two clean rows on desktop grid; halves initial image load |
| eBird maxResults | Reduce 50 → 15 | Only need 12 after dedup; saves bandwidth |

## What We're NOT Doing

- **Server-side pagination of eBird** — overkill for 12-15 results.
- **Infinite scroll** — "Show more" button is simpler and more appropriate for this data size.
- **Redis/persistent caching** — in-memory cache + React Query is sufficient for this app's scale.
- **Optimising the Overpass query** — it returns in reasonable time and results are capped at 10.