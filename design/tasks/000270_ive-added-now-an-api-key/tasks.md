# Implementation Tasks

- [ ] Check Next.js 16 docs in `node_modules/next/dist/docs/` for any breaking changes related to environment variables or client-side fetch
- [ ] Create `.env.local.example` with `NEXT_PUBLIC_EBIRD_API_KEY=your_key_here`
- [ ] Update `lib/types/Bird.ts` — add optional fields: `locationName?: string`, `observationDate?: string`
- [ ] Rewrite `lib/api/birdClient.ts` — replace mock `getBirdsForLocation()` with real eBird API call (`GET https://api.ebird.org/v2/data/obs/geo/recent`) using `NEXT_PUBLIC_EBIRD_API_KEY` header, deduplicate results by `speciesCode`, map response to `Bird` type, fall back to existing mock data on error or missing key
- [ ] Update `components/BirdCard.tsx` — show observation location and date below the description when `locationName` or `observationDate` are present
- [ ] Update `components/BirdList.tsx` — add a small data source indicator below the heading (e.g. "Live data from eBird" vs "Sample data") by accepting and displaying an `isLiveData` prop
- [ ] Update `app/page.tsx` — pass live/mock data source flag through to `BirdList` (the flag comes from `birdClient.ts` return value)
- [ ] Update `README.md` — update the API Integration section to reflect eBird is now live, document `.env.local` setup steps
- [ ] Manual test: run `npm run dev`, search a UK postcode (e.g. "SW1A 1AA"), verify real bird observations appear with species names, locations, and dates
- [ ] Manual test: unset `NEXT_PUBLIC_EBIRD_API_KEY`, verify fallback mock data renders with "Sample data" indicator
- [ ] Run `npm run build` to confirm no TypeScript or build errors