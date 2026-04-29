# Requirements: Click Location to Open Interactive Map

## User Stories

**As a birder viewing search results**, I want to click on a location card and see it pinned on an interactive map, so I can explore exactly where the birding spot is and plan my visit.

## Acceptance Criteria

1. **Clickable location cards** — Each `LocationCard` in the search results has a clear, clickable element (e.g., a "View on map" button or the map pin icon) that triggers a map view.

2. **Interactive map opens** — Clicking the element opens an interactive OpenStreetMap-based map (using Leaflet.js via `react-leaflet`) displayed as a modal/overlay or an inline expanded panel.

3. **Location is pinned** — The selected location is shown as a pin/marker on the map at its correct `latitude`/`longitude` coordinates.

4. **Marker has info** — The map marker shows a popup with the location's name, type, and distance from the searched postcode.

5. **Map is interactive** — The user can pan, zoom, and explore the surrounding area on the map.

6. **Map can be dismissed** — The user can close the map and return to the search results.

7. **Mobile-friendly** — The map view works well on both desktop and mobile screen sizes.

## Out of Scope

- Showing multiple locations on a single map view (future enhancement).
- Turn-by-turn directions or routing.
- Satellite/aerial imagery layers.

## Codebase Context

- **Location data already has coordinates**: The `Location` type (`lib/types/Location.ts`) includes `latitude` and `longitude` fields, sourced from the OpenStreetMap Overpass API.
- **LocationCard doesn't receive coordinates currently**: The `LocationCardProps` interface in `components/LocationCard.tsx` omits `latitude` and `longitude` — these need to be passed through.
- **No map library installed yet**: `package.json` has no Leaflet or map dependency. `react-leaflet` + `leaflet` will need to be added.
- **OSM is the correct tile source**: The app already uses and credits OpenStreetMap in the footer.