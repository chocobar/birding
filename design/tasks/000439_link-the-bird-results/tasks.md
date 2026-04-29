# Implementation Tasks

- [x] Add `isLiveData?: boolean` prop to `BirdCardProps` interface in `components/BirdCard.tsx`
- [x] Add `ExternalLink` to the `lucide-react` import in `BirdCard.tsx`
- [x] Compute `learnMoreUrl` in `BirdCard`: use `https://ebird.org/species/${bird.id}` when `isLiveData` is true, otherwise `https://en.wikipedia.org/wiki/${bird.scientificName.replace(/ /g, '_')}`
- [x] Compute `sourceName` (`"eBird"` or `"Wikipedia"`) for link text and aria-label
- [x] Render a "Learn more on {sourceName}" link at the bottom of the card content `<div className="p-4">`, with `ExternalLink` icon, `target="_blank"`, `rel="noopener noreferrer"`, and `aria-label="Learn more about {bird.commonName} on {sourceName}"`
- [x] Style the link: `text-sm`, `text-[var(--brand-green)]`, hover underline, `ExternalLink` icon at `w-3.5 h-3.5`
- [x] Pass `isLiveData` prop from `BirdList.tsx` down to each `<BirdCard>` instance (value already available as a prop on `BirdList`)
- [~] Manually test with both live eBird data and fallback mock data to verify correct URLs
- [~] Verify keyboard navigation (Tab to link, Enter to activate) and screen reader announcement