# Requirements: eBird API Integration for Live Bird Data

## Overview

Replace the mock bird data in `lib/api/birdClient.ts` with real data from the eBird API 2.0. The API key is available as an environment variable and must be kept server-side only (not exposed to the browser) by proxying requests through a Next.js API route.

## User Stories

### US-1: See real birds for my location
**As a** user searching by UK postcode,
**I want to** see bird species that have actually been observed near my location,
**So that** I know what birds I might realistically encounter.

**Acceptance Criteria:**
- When I search a postcode, the bird list shows species from eBird's "recent observations" endpoint for that lat/lng
- Each bird card displays: common name, scientific name, observation date, and location name where it was seen
- Results are sorted by observation recency (most recent first)
- The search radius defaults to ~8 km (≈ 5 miles, matching the current configured radius)

### US-2: Graceful handling when eBird is unavailable
**As a** user,
**I want** the app to still work if the eBird API is down or the API key is missing,
**So that** I always get some result.

**Acceptance Criteria:**
- If the eBird API call fails (network error, 403, 429, etc.), fall back to the existing mock bird data
- If `EBIRD_API_KEY` is not set on the server, skip the API call and use mock data directly
- A subtle indicator tells the user whether they're seeing live or fallback data

### US-3: API key is never exposed to the browser
**As a** developer deploying this app,
**I want** the eBird API key to stay server-side only,
**So that** it cannot be leaked through browser DevTools or network inspection.

**Acceptance Criteria:**
- The environment variable is named `EBIRD_API_KEY` (no `NEXT_PUBLIC_` prefix) so Next.js does not bundle it into client code
- All eBird API calls go through a server-side Next.js API route (`/api/birds`) — the browser never contacts eBird directly
- The API key is never present in any client-side JavaScript bundle or browser network request
- A `.env.local.example` file documents the required variable: `EBIRD_API_KEY=your_key_here`
- `.env*` is already in `.gitignore` (confirmed — it is)
- README is updated to reference the `.env.local` setup with the server-only variable name

## Non-Functional Requirements

- The server-side API route should validate incoming query parameters (lat, lng) before forwarding to eBird
- The UI should not noticeably change layout — bird cards should still render in the existing grid
- The existing `Bird` TypeScript interface may need minor additions but should remain backward-compatible with mock data