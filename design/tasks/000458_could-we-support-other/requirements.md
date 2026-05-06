# Requirements: Global Location Support with Autocomplete

## Summary

Replace the UK-postcode-only search with a global location search that supports free-text places (e.g. "Vellore, India", "Houston, TX") alongside UK postcodes, and provide autocomplete suggestions as the user types.

## User Stories

### 1. Search by any location worldwide
**As a** birding enthusiast outside the UK,
**I want to** type a city, region, or place name into the search box,
**So that** I can discover birds and birding spots near that location.

**Acceptance Criteria:**
- Typing "Vellore, India" and submitting returns birds/locations near Vellore
- Typing "Houston, TX" and submitting returns birds/locations near Houston
- UK postcodes (e.g. "SW1A 1AA") still work exactly as before
- Any place that OpenStreetMap Nominatim can geocode is supported

### 2. Autocomplete suggestions while typing
**As a** user searching for a location,
**I want to** see a dropdown of suggested places as I type,
**So that** I can quickly select the right location without typing the full name or knowing the exact format.

**Acceptance Criteria:**
- Suggestions appear after typing at least 3 characters
- Suggestions are debounced (300ms delay) to avoid excessive API calls
- Each suggestion shows a human-readable place name (e.g. "Houston, Texas, United States")
- Clicking/tapping a suggestion fills the search box and triggers the search
- Keyboard navigation works (arrow keys to select, Enter to confirm, Escape to dismiss)
- The dropdown closes when the user clicks outside it

### 3. Geolocation still works globally
**As a** user anywhere in the world,
**I want to** click the 📍 location button,
**So that** my current position is used directly for the search (not reverse-geocoded to a UK postcode).

**Acceptance Criteria:**
- The "Use my location" button passes lat/lng directly to the search flow
- It no longer reverse-geocodes to a UK postcode via Postcodes.io
- A human-readable place name is shown in the search box after auto-locating (via reverse geocode)

## Non-Functional Requirements

- **No new API keys required** — use OpenStreetMap Nominatim (free, no auth)
- **Respect Nominatim usage policy** — max 1 request/second, include a descriptive User-Agent header
- **Accessible** — autocomplete dropdown must be screen-reader friendly (ARIA combobox pattern)
- **Mobile-friendly** — dropdown must work well on touch devices
- **Performance** — autocomplete suggestions should appear within 500ms of the debounce firing