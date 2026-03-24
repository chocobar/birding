# UK Birding Discovery

A Next.js web application that helps users discover common birds and nearby birding locations in the UK based on their postcode.

## Features

- 🐦 **Bird Discovery**: Find the most common bird species in your area
- 📍 **Location Finder**: Discover nearby parks, woodlands, nature reserves, and walking trails
- 🔍 **Postcode Search**: Simple UK postcode-based search
- 📍 **Auto-Location**: Click a button to automatically detect your location and find your postcode
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

1. Enter a valid UK postcode (e.g., "SW1A 1AA" or "M1 1AE")
   - **OR** click the 📍 location button to auto-detect your postcode
2. View the list of common birds in your area
3. Explore nearby birding locations within a 5-mile radius
4. Click on locations to see distance and type (woodland, water, park, etc.)

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
│   │   ├── birdClient.ts       # Bird data (mock/eBird)
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

### Current APIs (V1)

- **Postcodes.io**: Free, no authentication required
- **OpenStreetMap Overpass API**: Free, no authentication required
- **Mock Bird Data**: 15 common UK birds with images from Unsplash

### Future Enhancement

Replace mock bird data with [eBird API 2.0](https://documenter.getpostman.com/view/664302/S1ENwy59):
1. Get API key from https://ebird.org/api/keygen
2. Add to `.env.local`: `NEXT_PUBLIC_EBIRD_API_KEY=your_key`
3. Update `lib/api/birdClient.ts` to use real eBird data

## Data Sources & Attribution

- **Postcode Data**: [Postcodes.io](https://postcodes.io) (Open Government License)
- **Location Data**: [OpenStreetMap](https://www.openstreetmap.org) (ODbL)
- **Bird Images**: [Unsplash](https://unsplash.com) (Free to use)

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