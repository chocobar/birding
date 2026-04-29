# Add interactive map for locations and bird sightings

## Summary
Clicking a map location on search results now opens an interactive OpenStreetMap modal pinning that location. Bird observation cards also now display coordinates (e.g. `📍 Smug Oak Lane, England, GB (51.709, -0.336)`) and clicking the location opens the same map view.

## Changes
- Install `leaflet`, `react-leaflet`, and `@types/leaflet`
- Create `LocationMap` component (Leaflet map with OpenStreetMap tiles, marker, and popup)
- Create `MapModal` component (modal overlay with backdrop, close button, Escape key, body scroll lock)
- Add "View on map" button to `LocationCard` and pass `latitude`/`longitude` through props
- Update `LocationList` props to include coordinates
- Pass `lat`/`lng` through the birds API route (eBird returns them but they were previously dropped)
- Add `latitude`/`longitude` to the `Bird` type
- Update `BirdCard` to display coordinates in the location snippet and make it clickable to open the map modal
- Both new components are dynamically imported (`ssr: false`) to avoid Leaflet SSR issues

## Testing
- `npx tsc --noEmit` passes with zero errors
- `npm run build` compiles successfully
- No new lint errors introduced in modified files