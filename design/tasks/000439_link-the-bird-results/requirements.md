# Requirements: Link Bird Results to Reliable Sources

## Problem

When a user searches for birds by postcode, the results (BirdCard components) display bird name, scientific name, image, conservation status, and observation data — but there's nowhere to click for more information. The experience feels like a dead end.

## User Stories

1. **As a birdwatcher**, I want to tap/click on a bird result to learn more about that species, so I can identify it in the field and read about its behaviour.
2. **As a casual user**, I want a clear visual cue that more information is available, so I know the card is actionable.

## Acceptance Criteria

- [ ] Each bird card includes a visible "Learn more" link that opens in a new tab.
- [ ] For **live eBird data**: the link points to the eBird species page (`https://ebird.org/species/{speciesCode}`), since the `speciesCode` (e.g. `eurrob1`) is already returned by the API and used as the bird `id`.
- [ ] For **fallback/mock data**: the link points to the Wikipedia article using the scientific name (`https://en.wikipedia.org/wiki/{Scientific_Name}`), since mock birds don't have eBird species codes.
- [ ] The link has `target="_blank"` and `rel="noopener noreferrer"` for security.
- [ ] An external-link icon is shown next to the link text to signal it opens externally.
- [ ] The link is keyboard-accessible and has an accessible label (e.g. "Learn more about European Robin on eBird").
- [ ] Existing card layout and styling is not broken.

## Out of Scope

- Creating a dedicated bird detail page within the app.
- Adding links to the location cards.
- Changing the data model or API responses.