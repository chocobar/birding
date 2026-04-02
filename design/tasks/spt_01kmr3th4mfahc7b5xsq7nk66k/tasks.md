# Implementation Tasks

## Batch bird image fetching

- [x] Create a new `/api/bird-images` (plural) batch endpoint in `app/api/bird-images/route.ts` that accepts a JSON body with an array of `{ name, scientificName }` objects and returns all image URLs in one response, reusing the existing Wikipedia lookup + cache logic from the single-image route
- [x] Update `BirdCard.tsx` to remove the per-card `useEffect` that individually fetches `/api/bird-image`; instead accept an optional `resolvedImageUrl` prop passed down from the parent
- [x] Update `BirdList.tsx` to call the batch endpoint once when `birds` changes, then pass resolved image URLs down to each `BirdCard`

## Reduce eBird over-fetching

- [x] In `app/api/birds/route.ts`, reduce `maxResults` from `'50'` to `'20'` since only 12 unique species are displayed — less data over the wire and faster eBird response

## Add pagination to bird results

- [x] Update `BirdList.tsx` to show a "Show more" button that displays 6 birds initially and loads more on click (client-side pagination of already-fetched data)

## Add pagination to location results

- [x] Update `LocationList.tsx` to initially show 5 locations with a "Show more" button that reveals the rest

## Use React Query for caching

- [x] Set up a `QueryClientProvider` in `app/layout.tsx` (the `@tanstack/react-query` dependency already exists but is unused)
- [x] Convert the manual `handleSearch` fetch logic in `page.tsx` to use `useQuery` hooks for birds and locations, keyed by postcode — this gives automatic caching so re-searching the same postcode is instant
- [x] Convert the batch bird-image fetch to a `useQuery` call keyed by the list of bird names

## Loading UX improvements

- [x] Show bird cards with skeleton placeholders progressively as data arrives (locations and birds can appear independently since they already use separate loading states)
- [~] Add a subtle fade-in animation when paginated results append