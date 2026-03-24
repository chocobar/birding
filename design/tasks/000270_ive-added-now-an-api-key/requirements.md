# Requirements: eBird API Integration for Live Bird Data

## Overview

Replace the mock bird data in `lib/api/birdClient.ts` with real data from the eBird API 2.0, using the API key already available as the `NEXT_PUBLIC_EBIRD_API_KEY` environment variable.

## User Stories

### US-1: See real birds for my location
**As a** user searching by UK postcode,
**I want to** see bird species that have actually been observed near my location,
**So that** I know what birds I might realistically encounter.

**Acceptance Criteria:**
- When I search a postcode, the bird list shows species from eBird's "recent observations" endpoint for that lat/lng
- Each bird card displays: common name, scientific name, observation date, and location name where it was seen
- Results are sorted by observation recency (most recent first)
- The search radius defaults to ~25 km (matching eBird's default) or 5 miles as currently configured

### US-2: Graceful handling when eBird is unavailable
**As a** user,
**I want** the app to still work if the eBird API is down or the API key is missing,
**So that** I always get some result.

**Acceptance Criteria:**
- If the eBird API call fails (network error, 403, 429, etc.), fall back to the existing mock bird data
- If `NEXT_PUBLIC_EBIRD_API_KEY` is not set, skip the API call and use mock data directly
- A subtle indicator tells the user whether they're seeing live or fallback data

### US-3: API key stays secure in production
**As a** developer deploying this app,
**I want** the API key to be loaded from a `.env` file,
**So that** it's never committed to source control.

**Acceptance Criteria:**
- A `.env.local.example` file documents the required variable: `NEXT_PUBLIC_EBIRD_API_KEY=your_key_here`
- `.env*` is already in `.gitignore` (confirmed — it is)
- README is updated to reference the eBird API key setup

## Non-Functional Requirements

- eBird API responses should be cached or debounced so repeated searches for the same postcode don't hit the API again unnecessarily
- The UI should not noticeably change layout — bird cards should still render in the existing grid
- The existing `Bird` TypeScript interface may need minor additions but should remain backward-compatible with mock data