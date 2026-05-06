# Implementation Tasks

## Extend data model

- [ ] Add `'route'` to the `Location['type']` union in `lib/types/Location.ts`
- [ ] Add optional fields to `Location` interface: `routeGeometry?: [number, number][]`, `lengthKm?: number`, `surface?: string`

## Enhance Overpass API query

- [ ] Extend the Overpass query in `lib/api/locationClient.ts` to fetch walking/hiking route relations (`type=route`, `route=hiking|foot|walking`) using `out geom` to get polyline coordinates
- [ ] Parse route relation elements: extract geometry array, name, surface tag, and distance tag from Overpass response
- [ ] Calculate route length from geometry points when OSM `distance` tag is missing (use existing `calculateDistance` util)
- [ ] Map route relations to the `route` location type in `determineLocationType()`
- [ ] Generate richer descriptions using actual OSM tags (surface, access, operator) instead of generic text
- [ ] Update mock/fallback data to include a sample route with geometry

## Update LocationCard

- [ ] Add `route` entry to `locationIcons`, `locationColors`, `iconContainerColors`, and `locationTypeLabels` maps in `LocationCard.tsx`
- [ ] Display route length (e.g., "3.2 km") on cards when `lengthKm` is present
- [ ] Display surface type (e.g., "Paved", "Gravel") when `surface` is present
- [ ] Pass `routeGeometry` to `MapModal` when opening the map

## Add filter chips to LocationList

- [ ] Add filter state (`useState`) with options: All, Routes, Parks, Water, Woodland, Reserves, Trails
- [ ] Render a row of filter chip buttons above the location cards
- [ ] Filter the displayed locations based on the selected type
- [ ] Update the result count text to reflect the filtered list
- [ ] Reset filter to "All" when locations data changes (new search)

## Render route polylines on the map

- [ ] Update `LocationMap.tsx` to accept an optional `routeGeometry` prop
- [ ] Conditionally render a `Polyline` (from `react-leaflet`) when `routeGeometry` is provided
- [ ] Use `fitBounds()` to auto-zoom the map to the route extent instead of centering on a single point
- [ ] Keep the existing single-marker behavior for non-route locations
- [ ] Update `MapModal.tsx` to pass `routeGeometry` through to `LocationMap`

## Polish and test

- [ ] Verify the Overpass query works for a few UK postcodes and returns route data
- [ ] Confirm the app builds without errors (`npm run build`)
- [ ] Check that existing location types (park, water, woodland, nature_reserve, trail) still render correctly
- [ ] Test the filter chips reset and count correctly
- [ ] Test the map modal shows polylines for routes and pins for other locations