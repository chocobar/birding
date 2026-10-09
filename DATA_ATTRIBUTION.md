# Data Attribution & Licensing Compliance

This document details all external data sources used by Birding Discovery, their licenses, and our compliance obligations.

---

## 📊 Data Sources Overview

| Data Source | Purpose | License | API Key Required | Attribution Required |
|-------------|---------|---------|------------------|---------------------|
| Geoapify (Places & Geocoding APIs) | Primary geocoding + location data (when `GEOAPIFY_API_KEY` is set) | Serves OpenStreetMap data under ODbL 1.0 | ✅ Yes (free) | ✅ Yes (© OpenStreetMap contributors) |
| Overpass (OpenStreetMap) | Trail discovery: named walking-route relations | ODbL 1.0 | ❌ No | ✅ Yes |
| Nominatim (OpenStreetMap) | Fallback geocoding (search + reverse) | ODbL 1.0 | ❌ No | ✅ Yes |
| Unsplash | Bird photography | Unsplash License | ❌ No | ✅ Yes (per image) |
| Xeno-canto | Bird song/call playback on bird cards | Per-recording CC license (varies) | ⚠️ Optional (free with account) | ✅ Yes (recordist + license, per clip) |
| Mock Bird Data | Bird species information | Original content | N/A | ❌ No |

---

## 1️⃣ Geoapify (Places & Geocoding APIs)

### What We Use
- Nearby location data: parks, nature reserves, greens, water bodies and named path ways
- On-demand geometry for trail-route relations and path ways (Place Details API)
- Forward geocoding (place name/postcode → latitude/longitude) and reverse geocoding

### API Endpoints
```
https://api.geoapify.com/v2/places
https://api.geoapify.com/v2/place-details
https://api.geoapify.com/v1/geocode
```

### Data Source & License

Geoapify serves **OpenStreetMap-derived data**, so the underlying data license is the same ODbL 1.0 that applies to our direct OSM usage:
- ✅ **Attribution required** ("© OpenStreetMap contributors") — displayed in the app footer
- ✅ **Share-Alike** obligations unchanged — we only fetch and display data, no derivative database

### Our Compliance

**Attribution (displayed in the app):**
```
Location data © OpenStreetMap contributors · Powered by Geoapify
```
The OSM credit appears in the site footer and beneath the results list; the "Powered by Geoapify" credit is shown whenever the results were served by Geoapify (the `/api/locations` response includes a `source` field, so the credit reflects the provider that actually served the data).

**Key handling:**
- API key stored server-side only (`GEOAPIFY_API_KEY`, no `NEXT_PUBLIC_` prefix), proxied through `/api/geocode`, `/api/locations` and `/api/geometry`
- **The nearby-locations feature requires this key** — without it, `/api/locations` returns an explanatory error

**License URL:** https://opendatacommons.org/licenses/odbl/1.0/
**Geoapify Terms:** https://www.geoapify.com/terms-and-conditions/

### Usage Limits
- Free plan: 3,000 requests/day (paid tiers scale higher)
- Requests are bounded by the app's existing server-side cache (10 min fresh / 24 h stale) and SWR revalidation

### Fallback Behavior
Geocoding falls back to the public Nominatim service when the key is absent or a Geoapify call fails. The nearby-locations feature (parks, water, path ways) has no fallback and requires the key; trails are fetched separately from Overpass and degrade independently.

---

## 2️⃣ Overpass (OpenStreetMap Trail Discovery)

### What We Use
- Trail discovery: **named walking-route relations** (`route=hiking|foot|walking`, network grades lwn/rwn/nwn) — the curated, waymarked trails people walk. No other API in the stack exposes these; Geoapify's highway categories return raw path way segments only.
- Trails are enrichment: an Overpass outage hides trails from the list but never fails it (parks and water keep coming from Geoapify).

### API Endpoint
```
https://overpass-api.de/api/interpreter        (primary)
https://overpass.kumi.systems/api/interpreter  (fallback)
```
`OVERPASS_ENDPOINTS` may override both (e.g. a private instance for production).

### Data Source & License

Overpass serves **raw OpenStreetMap data**:
- ✅ **Attribution required** ("© OpenStreetMap contributors") — displayed in the app footer and beneath the results list
- ✅ **Share-Alike** obligations unchanged — we only fetch and display data, no derivative database
- ✅ **No API key required**

**License URL:** https://opendatacommons.org/licenses/odbl/1.0/

### Our Compliance

**Usage policy compliance** (https://operations.osmfoundation.org/policies/nominatim/ applies to Nominatim; Overpass is governed by the overpass-api.de usage policy):
- Requests are proxied server-side with an identifying `User-Agent` (`BirdingDiscovery/...`)
- ONE capped query per search (centre points only, never member geometry in list responses; the map modal fetches full trail geometry via Geoapify Place Details)
- Results cached server-side (1 hour fresh / 24 h stale) so repeated searches don't re-query Overpass
- The query radius is capped at 5 miles and the result set at 300 relations
- Automatic fallback to a second public instance; circuit breaker skips endpoints that hang

## 3️⃣ Nominatim (OpenStreetMap Geocoding)

### What We Use
- Forward geocoding (place name/postcode → latitude/longitude)
- Autocomplete search suggestions as the user types
- Reverse geocoding (coordinates → place name)

### API Endpoint
```
https://nominatim.openstreetmap.org
```

### License: Open Database License (ODbL) 1.0

**Key Terms:**
- ✅ **Free to use** for commercial and non-commercial purposes
- ✅ **No API key required**
- ✅ **Attribution required** ("© OpenStreetMap contributors")
- ⚠️ **Usage policy applies** — max 1 request/second, valid User-Agent or Referer identifying the app

### Our Compliance

**Attribution (displayed in app footer):**
```
Location data © OpenStreetMap contributors · Geocoding by Nominatim
```

**Usage policy compliance:**
- Requests are proxied through `/api/geocode` with an identifying `User-Agent` header
- Autocomplete requests are debounced (300ms) and throttled server-side to ≤1 request/second

**License URL:** https://opendatacommons.org/licenses/odbl/1.0/

### Usage Limits
- Maximum 1 request/second (enforced via debounce + server-side throttle)
- **Current usage:** ~1-2 requests per user interaction (well within limits)

---
## 4️⃣ Unsplash

### What We Use
- Bird photography for display cards
- Currently using direct Unsplash URLs in mock bird data

### License: Unsplash License

**Key Terms:**
- ✅ **Free to use** for commercial and non-commercial
- ✅ **No API key required** for hotlinking
- ✅ **Attribution appreciated** (but not legally required)
- ✅ **Can modify** (crop, filter, etc.)
- ❌ Can't sell photos as-is (we don't)
- ❌ Can't create competing photo service (we don't)

### Our Compliance

**Current Implementation:**
Images are loaded via Next.js Image component from Unsplash CDN:
```typescript
imageUrl: 'https://images.unsplash.com/photo-1551525812-dbf728fe4e1f?w=400&h=300&fit=crop'
```

**Best Practice Attribution (should add to image alt text or credit line):**
```
Photo by [Photographer Name] on Unsplash
```

### Recommendations for Production

**Option 1: Continue Hotlinking (Current)**
- ✅ Simple, no storage costs
- ✅ Unsplash CDN is fast and reliable
- ⚠️ Should add photographer attribution
- ⚠️ Links may break if photos are removed

**Option 2: Use Unsplash API (Recommended for Production)**
- Register for free API key at https://unsplash.com/developers
- Get 50 requests/hour on free tier
- 5,000 requests/hour on paid tier ($9/month)
- Automatic attribution data included
- More reliable, better quality control

**Option 3: Self-Host Images**
- Download and host images ourselves
- Must maintain attribution to photographers
- More control, no external dependencies
- Storage and bandwidth costs

### Required Changes for Full Compliance

Add photographer credits to bird cards:
```typescript
interface Bird {
  // ... existing fields
  imageCredit?: {
    photographer: string;
    url: string;
    platform: 'unsplash' | 'wikimedia' | 'other';
  };
}
```

Display credit in UI:
```html
<span class="text-xs text-gray-500">
  Photo by {photographer} on Unsplash
</span>
```

---

## 5️⃣ Mock Bird Data

### What We Use
- Common UK bird species list (15 birds)
- Bird descriptions (original content)
- Scientific names (factual data, not copyrightable)
- Conservation status (factual data from public sources)

### License: Original Content

**Our bird descriptions are:**
- ✅ Original content written for this project
- ✅ Licensed under project license
- ✅ Based on public domain facts

**Scientific names and conservation status:**
- ✅ Factual data (not copyrightable)
- ✅ Publicly available information
- ✅ No attribution required

### eBird API (Integrated)

The app fetches live bird observation data from the eBird API when `EBIRD_API_KEY` is set.

**License:** eBird API Terms of Service
**API Key:** Required (free for non-commercial use)
**Attribution:** Required - "Powered by eBird"
**URL:** https://ebird.org/api/v2

**Terms:**
- ✅ Free for non-commercial use
- ✅ Must display eBird attribution
- ✅ Can't create competing bird tracking service
- ⚠️ Commercial use requires special agreement
- 📧 Contact: ebird@cornell.edu

**Our Compliance — attribution is displayed in the app:**
- The results header shows a linked **"Powered by eBird"** badge whenever live data is displayed
- The site footer adds "Bird observations provided by eBird — Cornell Lab of Ornithology" when live data is shown

```
Bird data provided by eBird (www.ebird.org)
A project of the Cornell Lab of Ornithology
```

---

## 6️⃣ Xeno-canto (Bird Song Playback)

### What We Use
- Short song/call recordings played from each bird card's play button
- Species → recording resolution happens server-side (`/api/bird-sound`, `/api/bird-sounds`); recordings themselves are streamed through `/api/bird-sound/stream?id=<cat.no.>` so the browser never hotlinks the upstream file host

### API Endpoints
```
https://xeno-canto.org/api/3/recordings   (primary; requires a free key)
https://xeno-canto.org/explore?query=...  (keyless fallback)
https://xeno-canto.org/<id>/download      (audio file, streamed via our proxy)
```

**Note on API versions:** API v2 (`/api/2/recordings`, keyless) was retired by Xeno-canto in 2026. API v3 requires a key — free for any registered XC member with a verified email (available at https://xeno-canto.org/account; stored server-side as `XENO_CANTO_API_KEY`, never `NEXT_PUBLIC_`). When no key is configured, lookups fall back to Xeno-canto's public explore pages (same metadata, keyless), and the feature still works.

### License
Each recording carries its own license — most commonly **CC BY-NC-SA 4.0**, but CC BY, CC BY-SA, CC0 and Public Domain dedications also occur. Xeno-canto requires that recordings are credited.

**Key Terms (per the applicable CC license):**
- ✅ Free to share and play with attribution
- ✅ No API cost (key is free)
- ⚠️ Attribution required — recordist + license per played clip
- ⚠️ Share-Alike / NonCommercial restrictions apply if audio were redistributed (we only stream + play clips)

### Our Compliance

**Attribution (displayed in the app):**
While a card's clip is the active one (playing or paused), the card shows a credit line linked to the recording page, which lists the full recordist and license details (satisfying CC attribution requirements):

```
© {Recordist} · {License, e.g. CC BY-NC-SA 4.0} · via Xeno-canto
```

- The site footer credits "Bird sounds from Xeno-canto" whenever the app renders
- Lookups are cached server-side (in-memory species → recording map) and batched/concurrency-capped (max 4 concurrent upstream requests), so at most one query per species per server lifetime
- Requests carry an identifying `User-Agent` (`BirdingDiscovery/...`)
- Audio files are proxied through `/api/bird-sound/stream` with Range support; no derivative audio is stored

**License URL:** https://creativecommons.org/licenses/ (per-recording license URL is returned by the API and linked from the credit)

---

## 🎯 Current Attribution Display

### In App Footer (Currently Displayed)
```
Bird observations provided by eBird — Cornell Lab of Ornithology   (when live eBird data is shown)
Location data © OpenStreetMap contributors · Powered by Geoapify (when Geoapify served the data) · Geocoding by Nominatim · Bird images from Wikimedia Commons · Bird sounds from Xeno-canto
```

### In the Results List (Currently Displayed)
```
Location data © OpenStreetMap contributors · Powered by Geoapify (when Geoapify served the data)
Powered by eBird   (linked badge on live bird results)
```

### On Each Bird Card (Currently Displayed)
```
© {Photographer/Author} · {License, e.g. CC BY-SA 4.0} · via Wikimedia Commons
```
Each credit links to the image's file page on Wikimedia Commons, where the full author and license details are listed (satisfying CC BY / CC BY-SA attribution requirements). Photos served from the mock data's Unsplash URLs are credited "Photo via Unsplash".

While a bird's audio clip is playing (or paused mid-playback), the card additionally shows:
```
© {Recordist} · {License, e.g. CC BY-NC-SA 4.0} · via Xeno-canto
```
linked to the recording's page on xeno-canto.org.

---

## ✅ Compliance Checklist

### Currently Compliant ✅
- [x] Nominatim - Attribution displayed, usage policy respected (User-Agent + throttle)
- [x] OpenStreetMap - "© OpenStreetMap contributors" displayed in footer and results list; map tiles carry the OSM attribution
- [x] Geoapify - "Powered by Geoapify" displayed whenever Geoapify served the results (via the `/api/locations` `source` field)
- [x] Overpass - OpenStreetMap data; attribution covered by the always-displayed OSM credit; single capped, cached query with identifying User-Agent
- [x] eBird - "Powered by eBird" badge + footer credit shown whenever live data is displayed
- [x] Wikimedia Commons - Per-image author + license credit displayed on each bird card, linked to the Commons file page
- [x] Unsplash - Mock-data photos credited "Photo via Unsplash"
- [x] Xeno-canto - Per-recording recordist + license credit shown on the card while its clip is active, linked to the recording page; footer credits Xeno-canto; lookups cached and concurrency-capped with identifying User-Agent; audio streamed via our own proxy
- [x] No rate limit violations
- [x] Not creating derivative databases

---

## 📋 Recommendations

### Completed
- [x] Footer attribution updated ("© OpenStreetMap contributors", eBird, Geoapify credits)
- [x] Per-image credits on bird cards (Commons author + license, linked; Unsplash credited)

### Remaining
1. **Add Data Sources Page**
   Create `/app/about/page.tsx` with detailed attribution and links

2. **Consider Unsplash API** (if mock data keeps Unsplash photos)
   - Free tier: 50 requests/hour
   - Provides automatic attribution
   - More reliable than hotlinking

3. **Review eBird commercial terms if monetizing**
   - Current usage (free, non-commercial) is compliant
   - 📧 Contact: ebird@cornell.edu before commercializing

---

## 🔗 License URLs

- **OGL 3.0:** https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/
- **ODbL 1.0:** https://opendatacommons.org/licenses/odbl/1.0/
- **Unsplash License:** https://unsplash.com/license
- **eBird Terms:** https://www.birds.cornell.edu/home/ebird-terms-of-use/
- **CC licenses (per Xeno-canto recording):** https://creativecommons.org/licenses/

---

## 📞 Contact Information

**Nominatim / OpenStreetMap:** https://operations.osmfoundation.org/policies/nominatim/
**OpenStreetMap:** https://wiki.openstreetmap.org/wiki/Contact
**Unsplash Support:** https://help.unsplash.com/
**eBird Support:** ebird@cornell.edu
**Xeno-canto Support:** https://xeno-canto.org/contact (API: contact@xeno-canto.org)

---

## 🔄 Last Updated

**Date:** October 9, 2026
**Reviewed by:** Project maintainers
**Next Review:** When adding new data sources or changing existing integrations

---

## ⚖️ Legal Disclaimer

This document represents our best understanding of the license terms for the data sources we use. We make every effort to comply with all licensing requirements. If you believe we are not in compliance with any license terms, please open an issue on GitHub and we will address it immediately.

The licenses and terms mentioned here are subject to change by their respective owners. Always refer to the official license documentation for the most current terms.