# Implementation Tasks

- [x] Install dependencies: `leaflet`, `react-leaflet`, and `@types/leaflet` (devDependency)
- [x] Create `components/LocationMap.tsx` — client-only Leaflet map component with `MapContainer`, `TileLayer` (OpenStreetMap), `Marker`, and `Popup` showing location name/type/distance. Fix the default marker icon path issue.
- [x] Create `components/MapModal.tsx` — modal overlay that wraps `LocationMap`, with backdrop, close button, Escape key handling, and body scroll lock. Dynamically import with `next/dynamic` (`ssr: false`) to avoid SSR issues with Leaflet.
- [x] Modify `components/LocationCard.tsx` — add `latitude` and `longitude` to `LocationCardProps`, add a "View on map" button (using the existing `MapPin` icon), and manage modal open/close state.
- [x] Modify `components/LocationList.tsx` — pass `latitude` and `longitude` through to `LocationCard` in the props.
- [x] Import Leaflet CSS (either in the map component or via a link tag in the modal) so tiles and markers render correctly.
- [x] Verify mobile responsiveness — map modal should be near full-screen on small viewports (~90vw × 80vh on desktop).
- [x] Manual test: search a postcode, click "View on map" on a location card, confirm marker is pinned at the correct spot, pan/zoom works, and modal dismisses cleanly.