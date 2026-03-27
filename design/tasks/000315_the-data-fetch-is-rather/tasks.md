# Implementation Tasks

## 1. Batch Bird Image Endpoint

- [ ] Create `app/api/bird-images/route.ts` — new POST endpoint that accepts `{ birds: [{ name, scientificName }] }` and returns `{ results: { [name]: { imageUrl, attribution } } }`
- [ ] Extract shared `fetchWikipediaImage` and `toWikiTitle` helpers from `app/api/bird-image/route.ts` into a shared module (e.g. `lib/api/wikipediaImage.ts`) so both the single and batch endpoints can use them
- [ ] In the batch endpoint, use `Promise.allSettled` to fetch all Wikipedia images in parallel on the server side
- [ ] Update `app/api/bird-image/route.ts` to import shared helpers from the new module (keep endpoint working for backward compat)

## 2. Persistent Image Caching (Wikipedia)

- [ ] In the shared `fetchWikipediaImage` helper, add `{ next: { revalidate: 86400 } }` to the Wikipedia `fetch()` call to leverage Next.js built-in fetch cache (24-hour TTL, survives restarts)
- [ ] Remove the manual `imageCache` Map from `app/api/bird-image/route.ts` (Next.js fetch cache replaces it)
- [ ] **Note:** Read `node_modules/next/dist/docs/` first to confirm Next.js 16 fetch caching API — may differ from training data

## 3. Server-Side Response Caching (eBird + Overpass)

- [ ] In `app/api/birds/route.ts`, add `{ next: { revalidate: 900 } }` (15 min) to the eBird API `fetch()` call
- [ ] In `app/api/birds/route.ts`, add `Cache-Control: public, s-maxage=900, stale-while-revalidate=60` response header
- [ ] In `lib/api/locationClient.ts`, add a simple in-memory cache with TTL (1 hour) for Overpass responses, keyed by `lat,lng,radius` — Overpass uses POST so Next.js fetch cache may not apply
- [ ] Keep fallback behaviour unchanged — cache misses still go to the live APIs

## 4. Paginated Bird Display ("Show More")

- [ ] In `components/BirdList.tsx`, add `visibleCount` state (default: 6)
- [ ] Render only `birds.slice(0, visibleCount)` instead of all birds
- [ ] Add a "Show more" button below the grid when `birds.length > visibleCount`
- [ ] Clicking "Show more" sets `visibleCount` to `birds.length` (reveal all)
- [ ] Style the button to match existing design (Tailwind, CSS custom properties)

## 5. Client-Side Batch Image Fetching

- [ ] In `components/BirdList.tsx`, add a `useEffect` that calls `/api/bird-images` (batch POST) with the currently visible birds
- [ ] Store resolved image URLs in a `Map<string, string>` state variable
- [ ] Pass `resolvedImageUrl` as a prop to each `BirdCard`
- [ ] When "Show more" is clicked, fetch images for the newly visible birds (merge into existing map)

## 6. Update BirdCard to Accept Pre-Resolved Image

- [ ] In `components/BirdCard.tsx`, add optional `resolvedImageUrl` prop
- [ ] When `resolvedImageUrl` is provided, use it directly and skip the `useEffect` Wikipedia fetch
- [ ] When `resolvedImageUrl` is not provided, fall back to the existing per-card `useEffect` fetch (backward compat)

## 7. Verification

- [ ] Start dev server, search a postcode, confirm bird cards appear with 6 visible initially
- [ ] Confirm "Show more" reveals remaining birds and triggers image fetch for new cards
- [ ] Check browser DevTools Network tab: confirm 1 batch image request instead of 12 individual ones
- [ ] Confirm repeat searches for the same postcode are faster (server cache hit)
- [ ] Confirm the app still works with mock/fallback data when eBird API key is not set