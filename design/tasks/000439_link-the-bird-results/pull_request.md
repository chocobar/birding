# Add "Learn more" links to bird search results

## Summary
Each bird card in search results now includes a "Learn more" outbound link so users can read about a species on a trusted external site, resolving the dead-end feeling after searching.

## Changes
- Added `isLiveData` prop to `BirdCard` to select the correct external source
- Live eBird data links to `https://ebird.org/species/{speciesCode}`
- Fallback/mock data links to `https://en.wikipedia.org/wiki/{Scientific_Name}`
- Added `ExternalLink` icon from lucide-react next to each link
- Passed `isLiveData` from `BirdList` down to each `BirdCard` instance
- Links open in new tab with `rel="noopener noreferrer"` and accessible `aria-label`

## Files Changed
- `components/BirdCard.tsx` — new prop, URL logic, and link rendering
- `components/BirdList.tsx` — passes `isLiveData` through to `BirdCard`

## Testing
- Production build passes cleanly (`next build`)
- Link renders with correct URL for both live eBird and fallback Wikipedia sources
- Keyboard accessible (Tab to focus, Enter to activate) with visible focus ring