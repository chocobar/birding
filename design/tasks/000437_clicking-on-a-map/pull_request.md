# Add interactive map modal for location cards

## Summary
Clicking "View on map" on a location card now opens an interactive OpenStreetMap modal, pinning the location so users can explore exactly where the birding spot is.

## Changes
- Install `leaflet`, `react-leaflet`, and `@types/leaflet`
- Create `LocationMap` component (Leaflet map with OpenStreetMap tiles, marker, and popup)
- Create `MapModal` component (modal overlay with backdrop, close button, Escape key, body scroll lock)
- Add "View on map" button to `LocationCard` and pass `latitude`/`longitude` through props
- Update `LocationList` props to include coordinates
- Both new components are dynamically imported (`ssr: false`) to avoid Leaflet SSR issues

## Testing
- `npx tsc --noEmit` passes with zero errors
- `npm run build` compiles successfully
- No new lint errors introduced in modified files