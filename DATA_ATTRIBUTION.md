# Data Attribution & Licensing Compliance

This document details all external data sources used by UK Birding Discovery, their licenses, and our compliance obligations.

---

## 📊 Data Sources Overview

| Data Source | Purpose | License | API Key Required | Attribution Required |
|-------------|---------|---------|------------------|---------------------|
| Postcodes.io | UK postcode geocoding | Open Government License (OGL) | ❌ No | ✅ Yes |
| OpenStreetMap (Overpass API) | Location data (parks, trails, etc.) | ODbL 1.0 | ❌ No | ✅ Yes |
| Unsplash | Bird photography | Unsplash License | ❌ No | ✅ Yes (per image) |
| Mock Bird Data | Bird species information | Original content | N/A | ❌ No |

---

## 1️⃣ Postcodes.io

### What We Use
- Postcode to latitude/longitude geocoding
- Reverse geocoding (coordinates to postcode)
- Postcode validation

### API Endpoint
```
https://api.postcodes.io
```

### License: Open Government License (OGL) v3.0

**Source:** Contains Ordnance Survey data © Crown copyright and database right [year]

**Key Terms:**
- ✅ **Free to use** for commercial and non-commercial purposes
- ✅ **No API key required**
- ✅ **Attribution required**
- ✅ **Can modify and distribute**
- ❌ Must not claim official endorsement

### Our Compliance

**Attribution (displayed in app footer):**
```
Data sources: Postcodes.io
```

**Full Attribution:**
Contains OS data © Crown copyright and database right 2025
Contains Royal Mail data © Royal Mail copyright and database right 2025
Contains National Statistics data © Crown copyright and database right 2025

**License URL:** https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/

### Usage Limits
- No official rate limits
- Fair use policy applies
- Recommended: max 10 requests/second
- **Current usage:** ~1-3 requests per user search (well within limits)

---

## 2️⃣ OpenStreetMap (Overpass API)

### What We Use
- Natural features (water bodies, woodlands)
- Parks and nature reserves
- Walking trails and footpaths
- Point of interest (POI) data

### API Endpoint
```
https://overpass-api.de/api/interpreter
```

### License: Open Database License (ODbL) 1.0

**Key Terms:**
- ✅ **Free to use** for any purpose
- ✅ **No API key required**
- ✅ **Attribution required** ("© OpenStreetMap contributors")
- ✅ **Share-Alike** - Derivative databases must use ODbL
- ✅ **Can modify and distribute**
- ⚠️ **Must provide access to derived databases** (if we create one)

### Our Compliance

**Attribution (displayed in app footer):**
```
Data sources: Postcodes.io, OpenStreetMap
```

**Full Attribution:**
© OpenStreetMap contributors
Licensed under the Open Database License (ODbL)

**License URL:** https://opendatacommons.org/licenses/odbl/1.0/

**Data URL:** https://www.openstreetmap.org/copyright

### Usage Guidelines
- ✅ Cache data locally (reduces API calls)
- ✅ Provide link to OSM when displaying maps (N/A - we don't show maps currently)
- ✅ Credit OSM contributors
- ❌ Don't claim we created the data

### Usage Limits
- Overpass API has no strict rate limits
- Fair use: ~10,000 queries/day recommended
- **Current usage:** ~1 query per user search (well within limits)
- Queries timeout at 180 seconds (our queries complete in <5 seconds)

### Share-Alike Obligation
**Important:** Since we query OSM data but don't create a derivative database:
- ✅ We are **compliant** - we only fetch and display data
- ✅ No obligation to open-source our database (we don't have one)
- ✅ Our application code license is separate from data license

**IF we were to:**
- Create a local database of OSM data
- Enrich or modify OSM data
- Redistribute OSM data

**THEN we would need to:**
- License that database under ODbL
- Provide access to the database
- Document our modifications

---

## 3️⃣ Unsplash

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

## 4️⃣ Mock Bird Data

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

### Future: eBird API Integration

**When we integrate eBird API:**

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

**Required Attribution:**
```
Bird data provided by eBird (www.ebird.org)
A project of the Cornell Lab of Ornithology
```

---

## 🎯 Current Attribution Display

### In App Footer (Currently Displayed)
```
Data sources: Postcodes.io, OpenStreetMap
```

### Should Be (Recommended)
```
Data sources: 
• Postcode data: Postcodes.io (Contains OS data © Crown copyright)
• Location data: © OpenStreetMap contributors
• Bird photos: Unsplash photographers
```

---

## ✅ Compliance Checklist

### Currently Compliant ✅
- [x] Postcodes.io - Basic attribution displayed
- [x] OpenStreetMap - Basic attribution displayed
- [x] Unsplash - Using within license terms
- [x] No API keys required for current data sources
- [x] No rate limit violations
- [x] Not creating derivative databases

### Should Improve 🟡
- [ ] Add full OGL attribution for Postcodes.io
- [ ] Add "© OpenStreetMap contributors" explicitly
- [ ] Add photographer credits to Unsplash images
- [ ] Consider Unsplash API for production
- [ ] Add data attribution page (/about/data-sources)

### For Future (eBird Integration) 📅
- [ ] Register for eBird API key
- [ ] Add eBird attribution prominently
- [ ] Review eBird terms for commercial use
- [ ] Contact Cornell Lab if commercializing

---

## 📋 Recommendations

### Immediate Actions (Priority: High)

1. **Update Footer Attribution**
   ```tsx
   <footer className="bg-white border-t border-gray-200 mt-16">
     <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
       <p className="text-center text-sm text-gray-600">
         Postcode data: <a href="https://postcodes.io">Postcodes.io</a> (Contains OS data © Crown copyright)
         {' • '}
         Location data: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>
         {' • '}
         Photos: <a href="https://unsplash.com">Unsplash</a>
       </p>
     </div>
   </footer>
   ```

2. **Add Data Sources Page**
   Create `/app/about/page.tsx` with detailed attribution and links

3. **Add Image Credits**
   Update bird data structure to include photographer attribution

### Medium Priority

4. **Consider Unsplash API**
   - Free tier: 50 requests/hour
   - Provides automatic attribution
   - More reliable than hotlinking

5. **Add LICENSE_DATA.md**
   - Separate file listing all data licenses
   - Link from main LICENSE.md

### Long-term

6. **eBird API Integration**
   - Register for API key
   - Implement proper attribution
   - Review commercial terms if monetizing

7. **Consider WikiMedia Commons**
   - Alternative to Unsplash for bird images
   - More stable, comprehensive collection
   - Clear attribution requirements
   - Free API available

---

## 🔗 License URLs

- **OGL 3.0:** https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/
- **ODbL 1.0:** https://opendatacommons.org/licenses/odbl/1.0/
- **Unsplash License:** https://unsplash.com/license
- **eBird Terms:** https://www.birds.cornell.edu/home/ebird-terms-of-use/

---

## 📞 Contact Information

**Postcodes.io Support:** hello@ideal-postcodes.co.uk
**OpenStreetMap:** https://wiki.openstreetmap.org/wiki/Contact
**Unsplash Support:** https://help.unsplash.com/
**eBird Support:** ebird@cornell.edu

---

## 🔄 Last Updated

**Date:** March 24, 2025
**Reviewed by:** Project maintainers
**Next Review:** When adding new data sources or changing existing integrations

---

## ⚖️ Legal Disclaimer

This document represents our best understanding of the license terms for the data sources we use. We make every effort to comply with all licensing requirements. If you believe we are not in compliance with any license terms, please open an issue on GitHub and we will address it immediately.

The licenses and terms mentioned here are subject to change by their respective owners. Always refer to the official license documentation for the most current terms.