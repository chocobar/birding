# Birding Discovery

A Next.js web application that helps users discover common birds and nearby birding locations anywhere in the world.

**Current Coverage:** Worldwide

## Features

- 🐦 **Bird Discovery**: Find the most common bird species in your area with images from Wikipedia/Wikimedia Commons
- 📍 **Location Finder**: Discover nearby parks, woodlands, nature reserves, and walking trails
- 🔍 **Location Search**: Search any place worldwide — city, region, or postcode — with autocomplete suggestions
- 📍 **Auto-Location**: Click a button to automatically detect your location
- 🗺️ **Interactive Map**: View birding locations on an interactive Leaflet.js map with markers and popups
- 🔗 **Learn More**: Click outbound links on bird cards to learn more about each species
- 🌍 **Global Vision**: Search for birds anywhere in the world
- 📱 **Responsive Design**: Works on mobile, tablet, and desktop
- ♿ **Accessible**: WCAG 2.1 AA compliant with keyboard navigation and screen reader support

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Icons**: Lucide React
- **Data Fetching**: TanStack React Query
- **Maps**: Leaflet.js + React-Leaflet
- **APIs**:
  - [OpenStreetMap Nominatim](https://nominatim.openstreetmap.org) — Global geocoding and search suggestions
  - [Geoapify](https://www.geoapify.com/) Places & Geocoding APIs — OpenStreetMap-derived location data and geocoding
  - [eBird API 2.0](https://documenter.getpostman.com/view/664302/S1ENwy59) — Live bird observation data
  - [Wikimedia Commons](https://commons.wikimedia.org) — Bird images
  - Mock bird data (fallback when eBird is unavailable)

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Clone the repository:
```bash
git clone git@github.com:chocobar/birding.git
cd birding
```

2. Install dependencies:
```bash
npm install
```

3. (Optional) Copy the environment template:
```bash
cp .env.local.example .env.local
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Build for Production

```bash
npm run build
npm start
```

## Usage

1. Search for any location worldwide — city, region, or postcode (e.g. "Vellore, India", "Houston, TX", "SW1A 1AA")
   - Autocomplete suggestions appear as you type
   - **OR** click the 📍 location button to auto-detect your location
2. View the list of common birds in your area, with images sourced from Wikipedia/Wikimedia Commons
3. Explore nearby birding locations within a 5-mile radius
4. Click on a location to open the interactive map and see it pinned
5. Click **Learn more** on any bird card to open its species information

**Note:** The app supports any location that can be geocoded via OpenStreetMap — cities, regions, addresses, and postcodes worldwide.

### Auto-Location Feature

The app can automatically detect your location using your browser's geolocation API:
- Click the green map pin (📍) button next to the search box
- Allow location access when prompted by your browser
- The app uses your coordinates directly and shows the nearest place name
- Works on both desktop and mobile browsers

### Interactive Map

Click any birding location to open a full-screen modal map powered by Leaflet.js:
- View all nearby locations as interactive markers
- Click markers for location details (name, type, distance)
- Pan and zoom to explore the surrounding area

## Project Structure

```
birding/
├── app/
│   ├── api/
│   │   ├── birds/route.ts         # eBird API proxy (server-side, protects API key)
│   │   ├── geocode/route.ts       # Nominatim geocoding proxy (User-Agent + rate throttle)
│   │   ├── bird-image/route.ts    # Single bird image proxy
│   │   └── bird-images/route.ts   # Batch bird image proxy
│   ├── layout.tsx                 # Root layout with metadata
│   ├── page.tsx                   # Main home page
│   └── globals.css                # Global styles
├── components/
│   ├── LocationSearch.tsx         # Location search with autocomplete
│   ├── BirdCard.tsx               # Individual bird display with Learn more link
│   ├── BirdList.tsx               # Bird grid with loading states
│   ├── LocationCard.tsx           # Individual location display
│   ├── LocationList.tsx           # Location list
│   ├── LocationMap.tsx            # Leaflet.js interactive map component
│   ├── MapModal.tsx               # Full-screen map modal
│   ├── ErrorBoundary.tsx          # Error handling component
│   └── Providers.tsx              # React Query provider
├── lib/
│   ├── api/
│   │   ├── geocodeClient.ts       # Geocoding search + reverse geocoding (via /api/geocode)
│   │   ├── birdClient.ts          # Bird data (eBird live + mock fallback)
│   │   ├── locationClient.ts      # OpenStreetMap integration
│   │   └── wikiImageLookup.ts     # Wikipedia/Wikimedia image resolver with caching
│   ├── hooks/
│   │   └── useBirdSearch.ts       # React Query hooks for bird & location search
│   ├── types/
│   │   ├── Bird.ts
│   │   ├── Location.ts
│   │   ├── GeocodedLocation.ts
│   │   └── index.ts               # Barrel exports
│   └── utils/
│       └── distanceCalculator.ts   # Haversine distance formula
└── public/                        # Static assets
```

## API Integration

### Current APIs

- **OpenStreetMap Nominatim**: Free, no authentication required — global geocoding and search suggestions (fallback when Geoapify is not configured)
- **[Geoapify](https://www.geoapify.com/) Places & Geocoding APIs**: Managed, OpenStreetMap-derived geocoding and location data — requires a free API key; powers nearby locations and is used for geocoding when configured
- **[eBird API 2.0](https://documenter.getpostman.com/view/664302/S1ENwy59)**: Live bird observation data — requires a free API key
- **Wikimedia Commons**: Bird species images resolved via Wikipedia API — free, no authentication required
- **Fallback Bird Data**: 15 common UK birds (used when eBird is unavailable)

### eBird API Setup

The app fetches real bird sighting data from eBird. The API key is kept **server-side only** (never exposed to the browser) via a Next.js API route proxy.

1. Get a free API key from https://ebird.org/api/keygen
2. Copy the example env file:
   ```bash
   cp .env.local.example .env.local
   ```
3. Add your key to `.env.local`:
   ```
   EBIRD_API_KEY=your_key_here
   ```
4. Restart the dev server (`npm run dev`)

> **Security note:** The variable is named `EBIRD_API_KEY` (no `NEXT_PUBLIC_` prefix) so that Next.js does **not** bundle it into client-side JavaScript. All eBird requests are proxied through `/api/birds` on the server.

If `EBIRD_API_KEY` is not set, the app gracefully falls back to sample bird data.

### Geoapify Setup

Geoapify powers the nearby-locations feature and is also the primary geocoding provider when configured. It serves OpenStreetMap-derived data through a keyed, managed API, avoiding the public Nominatim instances' queueing and usage-policy throttling.

1. Create a free account and project at https://myprojects.geoapify.com (free plan: 3,000 requests/day)
2. Copy the API key from the project's API Keys section
3. Add it to `.env.local`:
   ```
   GEOAPIFY_API_KEY=your_key_here
   ```
4. Restart the server

> **Security note:** Like `EBIRD_API_KEY`, the variable has no `NEXT_PUBLIC_` prefix, so the key is never bundled into client-side JavaScript. All Geoapify requests are proxied through `/api/geocode` and `/api/locations` on the server.

> **Required:** `GEOAPIFY_API_KEY` must be set for the nearby-locations feature to work (`/api/locations` returns an error without it). Geocoding falls back to the public Nominatim service when the key is absent or a Geoapify call fails.

## Data Sources & Attribution

This project uses data from multiple sources. We are committed to proper attribution and license compliance.

### Current Data Sources

- **Geocoding (Global)**: [Nominatim](https://nominatim.openstreetmap.org) by OpenStreetMap
  - License: Open Database License (ODbL) 1.0
  - © OpenStreetMap contributors
  - No API key required
  - Coverage: Worldwide (place names, addresses, postcodes)
  - Usage policy: max 1 request/second — enforced via debounced autocomplete and a server-side proxy with identifying User-Agent

- **Location Data (Global)**: [OpenStreetMap](https://www.openstreetmap.org) via [Geoapify](https://www.geoapify.com/)
  - License: Open Database License (ODbL) 1.0
  - © OpenStreetMap contributors
  - Requires a free Geoapify API key
  - Coverage: Worldwide

- **Bird Images**: [Wikimedia Commons](https://commons.wikimedia.org)
  - License: Individual image licenses (CC-BY-SA, etc.)
  - Attribution provided per image
  - No API key required

### Compliance

All data sources are properly attributed in the application footer and we comply with all license requirements. For complete details on:
- License terms and obligations
- Attribution requirements
- API usage limits
- Future eBird API integration plans
- Global expansion plans

Please see **[DATA_ATTRIBUTION.md](DATA_ATTRIBUTION.md)** for comprehensive licensing information.

### API Keys

- ✅ Nominatim — Free, no registration (worldwide, usage policy applies)
- ✅ Wikimedia Commons — Free, no registration
- 🔑 **Geoapify** — **Required** for nearby locations. Free plan (3,000 requests/day), registration at https://myprojects.geoapify.com. Set `GEOAPIFY_API_KEY` in `.env.local`.
- 🔑 **eBird API** — Free, requires registration at https://ebird.org/api/keygen. Set `EBIRD_API_KEY` in `.env.local`. The app works without it (falls back to sample data).

### Geocoding Architecture

Location search is powered by Geoapify when `GEOAPIFY_API_KEY` is set, with OpenStreetMap Nominatim as the automatic fallback. Future enhancements may include:
- Search result caching to reduce upstream calls
- Multi-language place names

## SEO

The app ships with the technical SEO foundations in place:

- **Metadata** (`app/layout.tsx`): canonical URL, Open Graph and Twitter card tags, robots directives (`max-image-preview:large`), and a Google Search Console verification meta tag when `GOOGLE_SITE_VERIFICATION` is set in `.env.local`
- **`robots.txt`** generated from `app/robots.ts` (allows crawling, disallows `/api/`, points at the sitemap)
- **`sitemap.xml`** generated from `app/sitemap.ts`
- **Open Graph image** generated from `app/opengraph-image.tsx` (used for both `og:image` and `twitter:image`)
- **Structured data**: JSON-LD `WebSite` + `WebApplication` schema injected in the root layout

## Browser Support

- Chrome (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)
- Edge (last 2 versions)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Accessibility

- Semantic HTML throughout
- ARIA labels on interactive elements
- Keyboard navigation support
- Screen reader compatible
- Color contrast ratios meet WCAG AA standards

## Performance

- Initial page load: < 3 seconds
- Search results: < 2 seconds
- Lazy-loaded images
- Optimized bundle size
- React Query caching for fast repeat visits

## Known Limitations

- **OSM Coverage**: Some rural areas may have limited location data
- **No Authentication**: No user accounts or saved searches in V1

## Future Enhancements

- [ ] Seasonal bird migration patterns
- [ ] User favorites (localStorage)
- [ ] eBird hotspot integration
- [ ] Weather integration
- [ ] Bird call audio samples
- [ ] Share results via URL

## Contributing

We welcome contributions! 🎉

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Code of conduct
- Development setup
- Coding standards
- Pull request process
- How to report bugs
- How to suggest features

**Quick start for contributors:**
```bash
git clone git@github.com:chocobar/birding.git
cd birding
npm install
npm run dev
```

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project to Vercel
3. Deploy (automatic)

### Other Platforms

The app works on any platform supporting Next.js:
- Netlify
- Cloudflare Pages
- AWS Amplify
- Self-hosted Node.js

## License

This project is licensed under terms similar to the Helix license. You can use this software for free for:

- **Personal Use** — Individual, non-commercial use
- **Educational Use** — Schools and universities
- **Small Business Use** — Companies with < 250 employees and < $10M annual revenue
- **Open Source Projects** — Non-commercial open source work

For commercial use outside these terms, please see [LICENSE.md](LICENSE.md) for details.

**You are not allowed to:**
- Use this software to build a competing product
- Redistribute commercially without permission

See [LICENSE.md](LICENSE.md) for complete license terms.

## Contact

For questions or feedback, please open an issue on GitHub.

---

Built with ❤️ for bird enthusiasts everywhere
