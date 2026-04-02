# Requirements: Data Fetch Performance Improvements

## Problem

After searching by postcode, the app feels slow. The main bottlenecks are:

1. **12 individual Wikipedia image lookups** — each `BirdCard` fires a `/api/bird-image` request on mount, each attempting up to 3 Wikipedia API calls internally.
2. **Heavy Overpass API query** — 11 feature types queried in a single request with a 25s timeout.
3. **No caching** — `@tanstack/react-query` is installed but unused; every search re-fetches everything.
4. **No pagination** — all 12 birds and 10 locations render at once, all images load at once.

## User Stories

### US-1: Batch bird image loading
**As a** user searching for birds near me,
**I want** bird images to load efficiently,
**So that** I don't wait for 12 separate Wikipedia lookups.

**Acceptance Criteria:**
- Bird images are fetched in a single batched API call (or a small number of parallel calls) rather than one per card
- Total image-fetch time is noticeably reduced compared to 12 sequential requests
- Cards that don't yet have an image show the existing skeleton/placeholder

### US-2: Paginated bird results
**As a** user viewing bird sightings,
**I want** to see a smaller initial set and load more on demand,
**So that** the page loads faster and I can browse at my own pace.

**Acceptance Criteria:**
- Initial page shows 6 birds (configurable)
- A "Show more" button or similar control loads the next batch
- The eBird API request size is reduced to match what's actually displayed (no fetching 50 to show 12)

### US-3: Use React Query for caching
**As a** user who re-searches a postcode or navigates back,
**I want** previously fetched data to be served from cache,
**So that** repeat views are instant.

**Acceptance Criteria:**
- Bird, location, and image data are cached client-side using `@tanstack/react-query`
- Searching the same postcode twice does not trigger new API calls (within a reasonable stale time)
- Cache has a sensible stale time (e.g. 5 minutes)

### US-4: Lazy-load images below the fold
**As a** user on a slower connection,
**I want** only visible bird card images to load,
**So that** above-the-fold content appears fast.

**Acceptance Criteria:**
- Bird card images use lazy loading (`loading="lazy"` or Intersection Observer)
- Image fetch API calls are deferred until the card is near the viewport

## Out of Scope

- Server-side rendering or static generation changes
- Changing external API providers (eBird, Overpass, Wikipedia)
- Infinite scroll (simple "Show more" is sufficient)