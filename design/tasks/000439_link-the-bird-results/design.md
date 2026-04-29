# Design: Link Bird Results to Reliable Sources

## Overview

Add a "Learn more" outbound link to each `BirdCard` so users can read about a species on a trusted external site. No new pages, APIs, or data model changes required.

## Key Decision: Which External Source?

| Source | Pro | Con | When to use |
|--------|-----|-----|-------------|
| **eBird species page** | Authoritative, matches our data source, rich content | Requires a valid `speciesCode` | Live eBird results |
| **Wikipedia (scientific name)** | Universal, free, always available | Occasionally missing for obscure species | Fallback/mock data |

**Decision:** Use both, conditionally. The `id` field on live eBird birds _is_ the `speciesCode` (e.g. `eurrob1`), so we can construct the eBird URL directly. For mock/fallback birds (whose `id` is a slug like `robin`), we fall back to Wikipedia using the scientific name.

## URL Construction

```
// Live eBird data (speciesCode is already the bird.id)
https://ebird.org/species/{bird.id}

// Mock/fallback data (scientific name, spaces → underscores)
https://en.wikipedia.org/wiki/{bird.scientificName.replace(/ /g, '_')}
```

## Detecting Live vs Mock

The `BirdList` component already receives an `isLiveData` boolean prop and passes birds down to `BirdCard`. We'll thread `isLiveData` down as a new prop on `BirdCard` to choose the correct URL pattern.

## Codebase Patterns & Observations

- **Project uses Next.js App Router** with client components (`'use client'` throughout).
- **Styling:** Tailwind CSS with CSS custom properties (e.g. `var(--brand-green)`). New elements should follow this pattern.
- **Icons:** The project uses `lucide-react`. The `ExternalLink` icon from lucide-react is the right fit for the outbound link indicator.
- **No existing outbound links in cards.** The footer already uses `<a>` tags with `target="_blank"` and `rel="noopener noreferrer"` — we follow the same pattern.
- **Accessibility:** The project documents WCAG 2.1 AA compliance. The link needs an `aria-label` for screen readers.

## Component Changes

### `BirdCard.tsx`

1. Add `isLiveData?: boolean` to `BirdCardProps`.
2. Compute `learnMoreUrl` based on `isLiveData`:
   - `true` → `https://ebird.org/species/${bird.id}`
   - `false`/`undefined` → `https://en.wikipedia.org/wiki/${bird.scientificName.replace(/ /g, '_')}`
3. Compute `sourceName` (`"eBird"` or `"Wikipedia"`) for display and aria-label.
4. Render a link at the bottom of the card content area (inside the `<div className="p-4">` block, after the frequency bar or description), styled as a small text link with an `ExternalLink` icon.

### `BirdList.tsx`

1. Pass `isLiveData` prop through to each `<BirdCard>` instance (the value is already available in the component).

### No changes needed to:

- `Bird.ts` type — no new fields.
- `/api/birds/route.ts` — `speciesCode` is already returned as `id`.
- `page.tsx` — `isLiveData` is already passed to `BirdList`.

## Link Styling

The link should feel like a natural part of the card without dominating it:

- Small text (`text-sm`), using `var(--brand-green)` colour to match existing accent links in the footer.
- `ExternalLink` icon at `w-3.5 h-3.5` inline next to text.
- Hover underline for discoverability.
- Placed after all existing card content, with a small top margin.

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| eBird species page doesn't exist for a code | eBird shows a graceful "not found" page; unlikely since codes come from their own API |
| Wikipedia article missing for a scientific name | Wikipedia redirects or shows search results; acceptable for fallback data |
| Link clutters small mobile cards | Keep link compact (single line, small text); it adds ~24px of height |