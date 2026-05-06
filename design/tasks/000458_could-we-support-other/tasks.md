# Implementation Tasks

## Geocoding Layer

- [ ] Create `lib/api/geocodeClient.ts` with `searchLocations(query)` (Nominatim `/search`) and `reverseGeocode(lat, lng)` (Nominatim `/reverse`), including a custom `User-Agent` header and 1 req/s throttle
- [ ] Create `lib/types/GeocodedLocation.ts` with `{ displayName, latitude, longitude }` interface
- [ ] Export `GeocodedLocation` from `lib/types/index.ts`

## Search Component

- [ ] Create `components/LocationSearch.tsx` replacing `PostcodeSearch.tsx` — free-text input, no UK postcode validation, updated placeholder to "Search any location…"
- [ ] Add autocomplete dropdown to `LocationSearch` — debounced (300ms) Nominatim lookup after 3+ characters, showing up to 5 suggestions
- [ ] Implement keyboard navigation for autocomplete (↑/↓ arrows, Enter to select, Escape to dismiss)
- [ ] Implement ARIA combobox pattern (role="combobox", aria-expanded, aria-activedescendant, listbox/option roles on dropdown)
- [ ] Handle autocomplete edge states: loading spinner, "No locations found" message, click-outside-to-dismiss
- [ ] Update "Use my location" button to pass lat/lng directly + call `reverseGeocode()` for display name (remove Postcodes.io reverse lookup)

## Page Integration

- [ ] Update `app/page.tsx` — import `LocationSearch` instead of `PostcodeSearch`, receive `GeocodedLocation` from search (lat/lng already resolved), remove `geocodePostcode()` call
- [ ] Update welcome section copy — change "Enter your postcode" to "Search any location"
- [ ] Update footer — remove "UK postcodes currently supported" text

## Cleanup

- [ ] Remove `lib/utils/postcodeValidator.ts`
- [ ] Remove `lib/api/postcodeClient.ts`
- [ ] Remove `lib/types/PostcodeResult.ts` and its export from `lib/types/index.ts`
- [ ] Remove `components/PostcodeSearch.tsx`
- [ ] Update `README.md` — reflect global location support, remove UK-only references

## Verification

- [ ] Test UK postcode search ("SW1A 1AA") still returns correct results via Nominatim
- [ ] Test international locations ("Vellore, India", "Houston, TX") return results
- [ ] Test autocomplete appears, is navigable by keyboard, and works on mobile
- [ ] Test "Use my location" button works without Postcodes.io dependency
- [ ] Run `npm run build` — confirm no TypeScript errors or broken imports