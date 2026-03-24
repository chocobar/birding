# Implementation Tasks

- [ ] Check Next.js 16 docs in `node_modules/next/dist/docs/` for any breaking changes related to Route Handlers, environment variables, or server-side fetch
- [ ] Rename environment variable from `NEXT_PUBLIC_EBIRD_API_KEY` to `EBIRD_API_KEY` in deployment config / local environment (drop the `NEXT_PUBLIC_` prefix so Next.js does not bundle it into client code)
- [ ] Create `.env.local.example` with `EBIRD_API_KEY=your_key_here`
- [ ] Update `lib/types/Bird.ts` — add optional fields: `locationName?: string`, `observationDate?: string`
- [ ] Create `app/api/birds/route.ts` — new Next.js Route Handler that: reads `EBIRD_API_KEY` from `process.env`, validates `lat`/`lng` query params (numeric, in range), calls `GET https://api.ebird.org/v2/data/obs/geo/recent` with the key in `X-eBirdApiToken` header, deduplicates results by `speciesCode`, maps eBird response to `Bird[]`, returns JSON with `{ birds: Bird[], isLiveData: true }`. If the key is missing or eBird call fails, return `{ birds: [], isLiveData: false }` with appropriate status
- [ ] Rewrite `lib/api/birdClient.ts` — replace mock `getBirdsForLocation()` to call `/api/birds?lat=...&lng=...` via fetch, parse the response, and fall back to existing mock bird data if the request fails or `isLiveData` is false. Return both `birds` and `isLiveData` flag to the caller
- [ ] Update `components/BirdCard.tsx` — show observation location and date below the description when `locationName` or `observationDate` are present
- [ ] Update `components/BirdList.tsx` — add a small data source indicator below the heading (e.g. "Live data from eBird" vs "Sample data") by accepting and displaying an `isLiveData` prop
- [ ] Update `app/page.tsx` — adjust `handleSearch` to receive and pass `isLiveData` flag from `birdClient` through to `BirdList`
- [ ] Update `README.md` — update the API Integration section to reflect eBird is now live, document `.env.local` setup with `EBIRD_API_KEY` (server-only, no `NEXT_PUBLIC_` prefix)
- [ ] Manual test: run `npm run dev`, search a UK postcode (e.g. "SW1A 1AA"), verify real bird observations appear with species names, locations, and dates. Confirm the API key does NOT appear in browser DevTools Network tab requests
- [ ] Manual test: unset `EBIRD_API_KEY`, restart dev server, verify fallback mock data renders with "Sample data" indicator
- [ ] Run `npm run build` to confirm no TypeScript or build errors