# Requirements: Make Nearby Birding Locations More Exciting

## Background

The "Nearby Birding Locations" section currently shows a flat list of locations (parks, water bodies, woodlands, nature reserves, trails) with a name, type badge, distance, a short generic description, and a "View on map" button that shows a single marker. Users have requested making this section more exciting, specifically by adding walking routes.

### What exists today

- `LocationCard` displays: icon, name, type badge, distance, description, tags, and a map modal with a single pin
- `locationClient.ts` queries the Overpass API (OpenStreetMap) and already fetches `highway=path` and `highway=footway` ways
- The `Location` type supports types: `water | woodland | park | nature_reserve | trail`
- Leaflet + react-leaflet are already installed for map rendering
- All data sources are free (Overpass API, Postcodes.io) — no API keys needed

## User Stories

### US-1: See walking/birding routes near me
**As a** birdwatcher searching by postcode,
**I want to** see nearby walking routes and trails that are good for birding,
**So that** I can plan a walk rather than just visit a point on a map.

**Acceptance Criteria:**
- The Overpass query fetches walking/hiking routes (`route=hiking`, `route=foot`, `route=walking`) in addition to current location types
- Routes are displayed in the location list alongside existing location types
- Each route shows its name, distance from user, and length (km/miles) if available

### US-2: See route shape on the map
**As a** user viewing a walking route,
**I want to** see the route drawn as a line/polyline on the map,
**So that** I can understand where the route goes before I visit.

**Acceptance Criteria:**
- When a user clicks "View on map" for a route, the map modal shows the route as a coloured polyline (not just a pin)
- The map auto-zooms to fit the full route geometry
- Regular locations (parks, water, etc.) continue to show a pin marker as before

### US-3: See richer location details
**As a** user browsing nearby locations,
**I want to** see more useful details at a glance,
**So that** I can decide which location to visit.

**Acceptance Criteria:**
- Location cards show route length for trails/routes (e.g., "2.3 km")
- Location cards show surface type when available (e.g., "Paved", "Gravel", "Dirt")
- Location cards show accessibility hints when OSM data includes them (e.g., wheelchair access)
- Descriptions are more specific, using actual OSM tag data rather than generic text

### US-4: Filter locations by type
**As a** user who specifically wants walking routes,
**I want to** filter the location list by type,
**So that** I can focus on what interests me.

**Acceptance Criteria:**
- A row of filter chips appears above the location list (e.g., "All", "Routes", "Parks", "Water", "Woodland", "Reserves")
- Selecting a filter shows only matching locations
- The count updates to reflect the filtered results
- "All" is selected by default

## Out of Scope

- Turn-by-turn navigation or GPX export
- User accounts or saving favourite routes
- Route difficulty ratings (not reliably available in OSM)
- Integration with third-party route APIs (Komoot, AllTrails, etc.) — we stick to free OSM data
- Circular vs. linear route classification

## Data Source

**OpenStreetMap Overpass API** — already used by the app, free, no API key, ODbL licensed. Walking route relations (`type=route`, `route=hiking|foot|walking`) are well-populated in the UK and most of Europe. Route way geometry can be fetched with `out geom;` instead of `out center;`.