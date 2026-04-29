# Design: Click Location to Open Interactive Map

## Overview

Add an interactive OpenStreetMap view that opens when a user clicks on a location card in the search results. The map shows a pin at the location's coordinates so the user can explore where the birding spot is.

## Architecture

### Approach: Modal Map Overlay

When the user clicks a "View on map" button on a `LocationCard`, a modal dialog opens containing a Leaflet map centered on that location with a marker and popup.

**Why a modal?** It's the simplest approach — no layout changes to the existing results page, no routing changes, and easy to dismiss. The map gets full attention without navigating away from results.

### New Dependencies

| Package | Purpose |
|---------|---------|
| `leaflet` | Map rendering engine |
| `react-leaflet` | React bindings for Leaflet |
| `@types/leaflet` | TypeScript types (devDependency) |

These are lightweight, well-maintained, and the standard choice for OpenStreetMap in React apps.

### Component Structure

```
LocationCard (existing, modified)
  └── "View on map" button → opens modal with location data

MapModal (new)
  ├── Modal backdrop + close button
  └── LocationMap (new)
        ├── MapContainer (react-leaflet)
        ├── TileLayer (OpenStreetMap tiles)
        └── Marker + Popup (location pin with name/type/distance)
```

### Key Decisions

1. **`react-leaflet` over iframe embed** — An `<iframe>` pointing to `openstreetmap.org/export/embed` would be zero-dependency but offers no marker customization or programmatic control. `react-leaflet` gives us proper markers with popups and full interactivity.

2. **Dynamic import for the map component** — Leaflet requires `window` and doesn't work with SSR. The `MapModal` component will be loaded via `next/dynamic` with `ssr: false`.

3. **Leaflet CSS** — Leaflet's CSS must be imported for tiles and markers to render correctly. Import it in the map component file or via a `<link>` tag in the modal.

4. **Default marker icon fix** — Leaflet's default marker icon paths break with bundlers. The implementation must set `L.Icon.Default` options to point to the marker icon assets from the `leaflet` package (a well-known gotcha).

5. **Pass coordinates through to LocationCard** — The `LocationCardProps` interface currently omits `latitude`/`longitude`. These fields need to be added so the card can pass them to the map modal.

### Data Flow

```
page.tsx
  └── LocationList (receives Location[] with lat/lng — already has them)
        └── LocationCard (needs lat/lng added to its props)
              └── onClick "View on map"
                    └── setState → opens MapModal
                          └── MapModal receives { name, type, distance, latitude, longitude }
                                └── Renders Leaflet map centered on [lat, lng] with marker
```

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `components/MapModal.tsx` | **Create** | Modal overlay with map, dynamically imported |
| `components/LocationMap.tsx` | **Create** | Leaflet map with marker + popup (client-only) |
| `components/LocationCard.tsx` | **Modify** | Add lat/lng to props, add "View on map" button, manage modal state |
| `components/LocationList.tsx` | **Modify** | Pass `latitude`/`longitude` through to LocationCard |
| `package.json` | **Modify** | Add `leaflet`, `react-leaflet`, `@types/leaflet` |

### Map Configuration

- **Tile URL**: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`
- **Attribution**: `© OpenStreetMap contributors` (already credited in footer)
- **Default zoom**: 15 (neighborhood level — good for finding a specific park/lake)
- **Marker popup**: Location name, type badge, distance from searched postcode

### UI Behavior

- Modal appears with a smooth fade-in, backdrop dims the page
- Map takes up most of the viewport (~90vw × 80vh on desktop, full-screen on mobile)
- Close via × button in corner, clicking backdrop, or pressing Escape
- The "View on map" button uses the `Map` icon from lucide-react (not `MapPin`, which is already used for the distance indicator)

## Implementation Notes

### What was built
- **`components/LocationMap.tsx`** — Client-only Leaflet map component. Imports `leaflet/dist/leaflet.css` directly. Fixes the well-known default marker icon issue by pointing `L.Icon.Default` options to unpkg CDN URLs for the marker images.
- **`components/MapModal.tsx`** — Modal overlay with flat props (`name`, `type`, `distance`, `latitude`, `longitude`, `onClose`). Uses `next/dynamic` with `ssr: false` to load `LocationMap`. Handles Escape key dismissal and body scroll lock via `useEffect`.
- **`components/LocationCard.tsx`** — Added `latitude`/`longitude` to `LocationCardProps`. Added a "View on map" button at the bottom-right of each card. Uses `useState` to manage modal open/close. The `MapModal` is conditionally rendered (not using an `isOpen` prop — the component simply mounts/unmounts).
- **`components/LocationList.tsx`** — Only change was adding `latitude` and `longitude` to the inline `locations` type in `LocationListProps`. No other modifications needed since `LocationCard` receives the full location object.

### Key patterns used
- **Conditional rendering over `isOpen` prop** — `LocationCard` renders `{isMapOpen && <MapModal ... />}` rather than passing `isOpen` as a prop. This avoids the map loading until the user actually clicks "View on map".
- **Double dynamic import** — `LocationCard` dynamically imports `MapModal`, and `MapModal` dynamically imports `LocationMap`. Both use `ssr: false`. This keeps the Leaflet bundle completely out of the initial page load.
- **Flat props on MapModal** — Originally designed with a `location` object prop + `isOpen`, but simplified to flat props since `LocationCard` already has the values destructured. The type label (e.g. "Water Body") is resolved in `LocationCard` and passed as `type` string.

### Gotchas encountered
- **Leaflet marker icon fix** — The `delete L.Icon.Default.prototype._getIconUrl` hack requires `as any` cast because TypeScript's `L.Icon.Default` type doesn't expose `_getIconUrl`. Used `// eslint-disable-next-line @typescript-eslint/no-explicit-any` to suppress the lint warning.
- **Marker icon CDN URLs** — Used `https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png` (and retina/shadow variants) rather than trying to import from node_modules, which avoids bundler path resolution issues.
- **Pre-existing lint error in LocationList.tsx** — The `useEffect(() => setVisibleCount(PAGE_SIZE), [locations])` pattern triggers a `react-hooks/set-state-in-effect` error. This is pre-existing and unrelated to our changes.

### Build verification
- `npx tsc --noEmit` — passes with zero errors
- `npm run build` — compiles successfully, all routes generate correctly
- `npx eslint` on modified files — no new errors introduced