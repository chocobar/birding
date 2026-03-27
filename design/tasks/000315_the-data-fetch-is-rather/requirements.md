# Requirements: Improve Data Fetch Performance

## Background

The Birding Discovery app fetches data from multiple external APIs when a user searches by postcode. The current flow is:

1. Geocode postcode → `postcodes.io` (sequential, required first)
2. Fetch birds + locations in parallel → eBird API + Overpass API
3. Fetch bird images → 12 individual Wikipedia API calls (one per `BirdCard` via `useEffect`)

The main bottlenecks identified:
- **12 individual Wikipedia image requests** fired independently from each `BirdCard` component on render — these waterfall and are not batched
- **Overpass API** queries are complex (11 sub-queries) and can be slow
- **All 12 bird results rendered at once** — no pagination or progressive loading
- **No persistent caching** — the in-memory image cache in `/api/bird-image/route.ts` is lost on server restart; no caching for eBird or Overpass responses

## User Stories

### US-1: Faster perceived load time
**As a** user searching for birds near a postcode,
**I want** results to appear progressively rather than waiting for everything,
**So that** the app feels responsive even when external APIs are slow.

**Acceptance Criteria:**
- Bird cards appear with placeholder images immediately after bird data loads
- Bird images load progressively without blocking the card content
- Users see meaningful content within 2 seconds of submitting a search (assuming reasonable network)

### US-2: Batched image fetching
**As a** user viewing bird results,
**I want** bird images to load efficiently,
**So that** I don't experience a long delay waiting for all images to appear.

**Acceptance Criteria:**
- Bird image lookups are batched into a single API request (or a small number of parallel requests) instead of 12 individual requests
- Image loading does not block the display of bird names, descriptions, and other text data

### US-3: Paginated bird results
**As a** user viewing bird results,
**I want** to see a manageable number of birds at first with the option to load more,
**So that** initial page load is fast and I'm not overwhelmed with content.

**Acceptance Criteria:**
- Initially display 6 birds (instead of 12)
- A "Show more" button loads the remaining birds
- Image fetches are deferred for birds not yet visible

### US-4: Response caching
**As a** returning user or someone refining their search,
**I want** previously fetched data to load instantly from cache,
**So that** repeat searches are fast.

**Acceptance Criteria:**
- eBird API responses are cached on the server for a reasonable TTL (e.g. 15 minutes — data is "recent sightings" so freshness matters but not to the second)
- Overpass API responses are cached on the server for a longer TTL (e.g. 1 hour — geographic features change rarely)
- Wikipedia image URLs are cached persistently (e.g. written to a simple JSON file or using `next` built-in fetch caching) so they survive server restarts
- Client-side caching via React Query's existing setup is leveraged where possible

## Out of Scope

- Changing the external APIs used (eBird, Overpass, Wikipedia)
- Adding a database or Redis — keep it simple with file/memory caching and Next.js built-in capabilities
- Changing the visual design of the cards or layout
- Server-side rendering of the search results (the app is client-rendered with `'use client'`)