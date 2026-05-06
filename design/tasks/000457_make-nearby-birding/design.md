# Design: Make Nearby Birding Locations More Exciting

## Architecture Overview

This feature enhances the existing Nearby Birding Locations section by (1) fetching walking/hiking route relations from OpenStreetMap, (2) rendering route polylines on the map, (3) enriching location cards with richer metadata, and (4) adding client-side type filters. No new APIs, services, or dependencies are needed — everything builds on the existing Overpass API integration and Leaflet map.

## Key Decisions

### 1. Fetch route relations from Overpass (not a separate API)

The app already queries the Overpass API in `lib/api/locationClient.ts`. We extend that same query to include route relations (`type=route`, `route=hiking|foot|walking`). This keeps the architecture simple — one data source, one query, no new API keys.

**Alternative considered:** Integrating a dedicated trails API (Komoot, AllTrails, Waymarked Trails). Rejected because they require API keys, have usage limits, and add complexity. OSM route data is already good in the UK.

### 2. Fetch geometry with `out geom` for routes only

Currently the query uses `out center tags` which returns only the center point of ways. For routes, we need the full polyline. The Overpass API supports `out geom;` to return full geometry for ways and relations. We'll use a two-part query strategy:

- **Existing location types** (parks, water, woodland): keep `out center tags` — we only need a pin
- **Route relations**: use `out geom` to get the line coordinates for polyline rendering

This avoids fetching heavy geometry data for locations that only need a marker.

### 3. Add `route` as a new location type

The current `Location['type']` union is `'water' | 'woodland' | 'park' | 'nature_reserve' | 'trail'`. We add `'route'` to distinguish named, multi-way hiking/walking routes from simple footpaths (`trail`). This maps to OSM relations with `type=route`.

### 4. Store route geometry in the Location type

Extend the `Location` interface with optional fields:

```
// In lib/types/Location.ts
export interface Location {
  // ... existing fields ...
  routeGeometry?: [number, number][];  // lat/lng pairs for polyline rendering
  lengthKm?: number;                   // route length in km (from OSM or calculated)
  surface?: string;                    // e.g. "paved", "gravel", "dirt"
}
```

`routeGeometry` is only populated for routes/trails. Regular locations remain unchanged.

### 5. Polyline rendering in MapModal via Leaflet

The existing `LocationMap` component uses `react-leaflet` with `MapContainer`, `TileLayer`, and `Marker`. For routes, we conditionally render a `Polyline` instead of (or in addition to) a `Marker`. We use Leaflet's `fitBounds()` to auto-zoom the map to the route extent. No new dependencies needed — `react-leaflet` already exports `Polyline`.

### 6. Client-side filtering (no server round-trip)

The location list is already fully loaded client-side (max 10-20 results). Filtering by type is a simple `useState` + `.filter()` in `LocationList.tsx`. No API changes needed.

## Codebase Patterns & Constraints

- **This project uses Next.js 16 with React 19** — check `node_modules/next/dist/docs/` before using any Next.js API (per AGENTS.md)
- **Client components use `'use client'` directive** — all interactive components (LocationCard, LocationList, LocationMap) are client components
- **Leaflet is loaded via `next/dynamic` with `ssr: false`** — the MapModal dynamically imports LocationMap to avoid SSR issues. The same pattern must be used for any Leaflet-dependent code
- **Data fetching uses TanStack React Query** — the `useLocationSearch` hook wraps `getNearbyLocations()` in a `useQuery` call. No changes needed to the hook
- **Overpass API is called directly from the client** (in `locationClient.ts`) — no Next.js API route involved for locations
- **CSS uses CSS custom properties** (e.g., `var(--brand-green)`, `var(--warm-sand)`) defined in `globals.css`, plus Tailwind utility classes
- **Icons come from `lucide-react`** — use existing icons like `Route`, `Footprints`, `Filter`
- **The `Location` type is defined in `lib/types/Location.ts`** and re-exported from `lib/types/index.ts`

## Files to Change

| File | Change |
|------|--------|
| `lib/types/Location.ts` | Add `'route'` to type union; add `routeGeometry?`, `lengthKm?`, `surface?` fields |
| `lib/api/locationClient.ts` | Extend Overpass query to fetch route relations with geometry; parse route data; calculate route length; extract surface tags |
| `components/LocationCard.tsx` | Show route length, surface info; add icons/styling for `route` type; update type maps |
| `components/LocationList.tsx` | Add filter chip row; filter locations by selected type; update count display |
| `components/LocationMap.tsx` | Accept optional `routeGeometry` prop; render `Polyline` when present; use `fitBounds` for routes |
| `components/MapModal.tsx` | Pass `routeGeometry` through to `LocationMap` |

## Route Length Calculation

OSM route relations sometimes include a `distance` tag. When absent, we calculate length by summing Haversine distances between consecutive points in the geometry. The existing `calculateDistance()` utility in `lib/utils/distanceCalculator.ts` handles this.

## Data Attribution

OpenStreetMap route data is covered by the same ODbL license already acknowledged in the app footer and `DATA_ATTRIBUTION.md`. No new attribution obligations.

## UI Sketch

### Location Card (route variant)
```
┌─────────────────────────────────────────────┐
│ 🥾  The Thames Path                   📍 0.8 mi │
│     ┌──────────┐                              │
│     │  Route   │  3.2 km · Paved              │
│     └──────────┘                              │
│     Walking route along the river — ideal     │
│     for waterfowl spotting                    │
│     ┌─────┐ ┌───────┐      ┌────────────┐    │
│     │river│ │hiking │      │ View on map│    │
│     └─────┘ └───────┘      └────────────┘    │
└─────────────────────────────────────────────┘
```

### Filter Chips (above location list)
```
[ All (12) ] [ Routes (3) ] [ Parks (4) ] [ Water (2) ] [ Woodland (2) ] [ Reserves (1) ]
```

### Map Modal (route variant)
Instead of a single pin, the map shows a coloured polyline tracing the route, with the map zoomed to fit the full route.