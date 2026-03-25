# Requirements: Modernised UI Design & Bird Images

## Context

The Birding Discovery app is functional and works well, but the UI looks dated. The user wants two things:
1. A modernised, contemporary look and feel — inspired by hobbyist/nature websites
2. Real bird images for species (especially when using eBird live data, which returns no images)

### Current State Observations
- **Layout**: Standard white-card-on-pastel-gradient — functional but generic
- **Typography**: Geist font, default sizing — lacks personality
- **Cards**: Basic `shadow-md` white cards with squared-off content — feels like a Bootstrap template
- **Images**: Mock data uses Unsplash URLs (often wrong bird or landscape photos); eBird live data returns NO images at all
- **Colour palette**: Blue/green gradient background, plain white cards — safe but uninspired
- **Header**: Simple icon + text — no visual impact
- **Welcome state**: Large empty space with a generic bird icon — missed opportunity for engagement

## User Stories

### US-1: Modern Visual Design
**As a** user visiting the app,
**I want** the interface to feel modern and polished,
**So that** it feels like a quality hobbyist tool rather than a prototype.

**Acceptance Criteria:**
- [ ] Updated colour palette with richer, nature-inspired tones (earthy greens, warm ambers, soft creams)
- [ ] Improved typography with a warmer display font for headings (e.g. Inter, DM Sans, or similar modern sans-serif)
- [ ] Cards use subtle borders, refined shadows, and rounded corners consistent with modern design (2024+ aesthetic)
- [ ] Smooth hover transitions and micro-interactions on interactive elements
- [ ] Hero/welcome section feels engaging — not just empty space with an icon
- [ ] Responsive design quality maintained across mobile, tablet, desktop
- [ ] Footer is cleaner and less cluttered

### US-2: Bird Images from API
**As a** user viewing bird search results,
**I want** to see an actual photo of each bird species,
**So that** I can visually identify and appreciate the birds in my area.

**Acceptance Criteria:**
- [ ] Each bird card displays a relevant photo of the actual species
- [ ] Images load for both eBird live data and fallback mock data
- [ ] Images are fetched via a free, no-API-key-required source (Wikipedia REST API or iNaturalist)
- [ ] Graceful fallback when no image is found (attractive placeholder, not broken image)
- [ ] Image attribution is maintained in the footer
- [ ] Images are lazy-loaded and appropriately sized (not oversized downloads)

### US-3: Improved Bird Cards
**As a** user browsing bird results,
**I want** bird cards that are visually appealing and informative,
**So that** I enjoy browsing and can quickly scan key information.

**Acceptance Criteria:**
- [ ] Bird cards have a modern layout (image with overlay or side-by-side on larger screens)
- [ ] Conservation status badge is visually distinct and uses clear iconography
- [ ] Observation frequency bar is styled to match the new design system
- [ ] Cards maintain accessibility (colour contrast, screen reader labels, keyboard navigation)

### US-4: Improved Location Cards
**As a** user viewing nearby birding locations,
**I want** location cards that match the modernised design,
**So that** the entire app feels cohesive.

**Acceptance Criteria:**
- [ ] Location cards updated to match new design language
- [ ] Location type icons and badges use the new colour palette
- [ ] Distance display is clear and well-formatted

## Out of Scope
- No new pages or routes — single-page app stays as-is
- No dark mode (can be a future enhancement)
- No map view or interactive features
- No changes to API logic or data fetching (except adding image fetching)
- No user accounts or authentication