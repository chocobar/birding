# Improve data fetch performance with batching, caching, and pagination

## Summary
Addresses slow data fetching by batching bird image lookups into a single request, adding React Query for client-side caching, reducing eBird API over-fetching, and adding "Show more" pagination to both bird and location results.

## Changes
- **Batch bird image endpoint** — New `POST /api/bird-images` fetches all Wikipedia images in one request (was 12 individual requests). Shared lookup logic extracted to `lib/api/wikiImageLookup.ts`.
- **React Query caching** — Wired up `@tanstack/react-query` (already installed, previously unused) via `Providers.tsx` wrapper and custom hooks (`useBirdSearch`, `useLocationSearch`). Re-searching the same postcode is now instant from cache (5-min stale time).
- **Reduced eBird over-fetching** — `maxResults` reduced from 50 to 20 in `/api/birds` route since only 12 unique species are displayed.
- **Client-side pagination** — Birds show 6 initially, locations show 5 initially, each with a "Show more" button. Newly revealed cards animate in with a subtle fade-in-up transition.
- **Simplified BirdCard** — Removed per-card `useEffect` image fetch; now receives resolved image URL as a prop from parent.

## Testing
- `next build` compiles successfully with no TypeScript errors
- All existing routes preserved (`/api/bird-image` single endpoint still works, refactored to use shared utility)
- New `/api/bird-images` batch endpoint validates input and caps at 20 birds per request