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
- The "View on map" button uses the existing `MapPin` icon from lucide-react for consistency