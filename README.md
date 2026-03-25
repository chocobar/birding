# Birding Discovery

A Next.js web application that helps users discover common birds and nearby birding locations anywhere in the world.

**Current Coverage:** UK postcodes (expanding to global locations soon)

## Features

- 🐦 **Bird Discovery**: Find the most common bird species in your area
- 📍 **Location Finder**: Discover nearby parks, woodlands, nature reserves, and walking trails
- 🔍 **Location Search**: Search by postcode or address (UK postcodes currently supported)
- 📍 **Auto-Location**: Click a button to automatically detect your location
- 🌍 **Global Vision**: Built for worldwide expansion (starting with UK)
- 📱 **Responsive Design**: Works on mobile, tablet, and desktop
- ♿ **Accessible**: WCAG 2.1 AA compliant with keyboard navigation and screen reader support

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **APIs**:
  - [Postcodes.io](https://postcodes.io) - UK postcode geocoding
  - [OpenStreetMap Overpass API](https://overpass-api.de) - Location data
  - Mock bird data (to be replaced with eBird API)

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd birding-3
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

1. Enter your location (currently supporting UK postcodes like "SW1A 1AA" or "M1 1AE")
   - **OR** click the 📍 location button to auto-detect your location
2. View the list of common birds in your area
3. Explore nearby birding locations within a 5-mile radius
4. Click on locations to see distance and type (woodland, water, park, etc.)

**Note:** While the app is built for global use, UK postcodes are currently the primary supported format. International location support is planned for future releases.

### Auto-Location Feature

The app can automatically detect your location using your browser's geolocation API:
- Click the green map pin (📍) button next to the search box
- Allow location access when prompted by your browser
- The app will find your nearest UK postcode and search automatically
- Works on both desktop and mobile browsers

## Project Structure

```
birding-3/
├── app/
│   ├── api/
│   │   └── birds/
│   │       └── route.ts    # eBird API proxy (server-side, protects API key)
│   ├── layout.tsx          # Root layout with metadata
│   ├── page.tsx            # Main home page
│   └── globals.css         # Global styles
├── components/
│   ├── PostcodeSearch.tsx  # Search input component
│   ├── BirdCard.tsx        # Individual bird display
│   ├── BirdList.tsx        # Bird grid with loading states
│   ├── LocationCard.tsx    # Individual location display
│   ├── LocationList.tsx    # Location list
│   └── ErrorBoundary.tsx   # Error handling component
├── lib/
│   ├── api/
│   │   ├── postcodeClient.ts   # Postcodes.io integration
│   │   ├── birdClient.ts       # Bird data (eBird live + mock fallback)
│   │   └── locationClient.ts   # OpenStreetMap integration
│   ├── types/
│   │   ├── Bird.ts
│   │   ├── Location.ts
│   │   └── PostcodeResult.ts
│   └── utils/
│       ├── postcodeValidator.ts  # UK postcode validation
│       └── distanceCalculator.ts # Haversine distance formula
└── public/                 # Static assets
```

## API Integration

### Current APIs

- **Postcodes.io**: Free, no authentication required — UK postcode geocoding
- **OpenStreetMap Overpass API**: Free, no authentication required — nearby location data
- **[eBird API 2.0](https://documenter.getpostman.com/view/664302/S1ENwy59)**: Live bird observation data — requires a free API key
- **Fallback Bird Data**: 15 common UK birds with images from Unsplash (used when eBird is unavailable)

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

## Data Sources & Attribution

This project uses data from multiple sources. We are committed to proper attribution and license compliance.

### Current Data Sources

- **Postcode Data (UK)**: [Postcodes.io](https://postcodes.io) 
  - License: Open Government License (OGL) v3.0
  - Contains OS data © Crown copyright
  - No API key required
  - Coverage: United Kingdom only (global geocoding APIs planned)
  
- **Location Data (Global)**: [OpenStreetMap](https://www.openstreetmap.org)
  - License: Open Database License (ODbL) 1.0
  - © OpenStreetMap contributors
  - No API key required
  - Coverage: Worldwide
  
- **Bird Images**: [Unsplash](https://unsplash.com)
  - License: Unsplash License
  - Free to use, attribution appreciated
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

- ✅ Postcodes.io - Free, no registration (UK only currently)
- ✅ OpenStreetMap Overpass API - Free, no registration (global coverage)
- ✅ Unsplash - Hotlinking allowed, no key needed
- 🔑 **eBird API** - Free, requires registration at https://ebird.org/api/keygen. Set `EBIRD_API_KEY` in `.env.local`. The app works without it (falls back to sample data).

### Expanding Beyond the UK

The app is architected for global use. Future enhancements will include:
- Google Geocoding API or similar for international addresses
- Country-specific postcode/zip code formats
- Regional bird data from eBird API
- Multi-language support

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

## Known Limitations

- **UK-only**: Only supports UK postcodes
- **Mock Bird Data**: V1 uses static bird data; real-time observations require eBird API integration
- **OSM Coverage**: Some rural areas may have limited location data
- **No Authentication**: No user accounts or saved searches in V1

## Future Enhancements

- [ ] Interactive map view (Leaflet.js)
- [ ] Seasonal bird migration patterns
- [ ] User favorites (localStorage)
- [ ] eBird hotspot integration
- [ ] Weather integration
- [ ] Bird call audio samples
- [ ] Share results via URL

## Contributing

This is a prototype/hobby project. Contributions welcome!

## License

MIT License - See LICENSE file for details

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

- **Personal Use** - Individual, non-commercial use
- **Educational Use** - Schools and universities
- **Small Business Use** - Companies with < 250 employees and < $10M annual revenue
- **Open Source Projects** - Non-commercial open source work

For commercial use outside these terms, please see [LICENSE.md](LICENSE.md) for details.

**You are not allowed to:**
- Use this software to build a competing product
- Redistribute commercially without permission

See [LICENSE.md](LICENSE.md) for complete license terms.

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
git clone https://github.com/YOUR-USERNAME/birding-3.git
cd birding-3
npm install
npm run dev
```

## Contact

For questions or feedback, please open an issue on GitHub.

---

Built with ❤️ for UK bird enthusiasts