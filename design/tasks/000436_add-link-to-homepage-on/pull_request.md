# Add homepage link to header title

## Summary
Makes the "Birding Discovery" header title and icon clickable, linking back to the homepage. This lets users easily return to the welcome state after viewing bird search results.

## Changes
- Wrapped the header icon + title in a Next.js `<Link href="/">` component in `app/page.tsx`
- Added hover (`opacity-90`) and keyboard focus (`ring-2`) styling to the link
- Added `import Link from 'next/link'`

## Testing
- Build passes with zero errors (`next build`)
- ESLint passes with zero errors
- Verified the header renders identically to before
- Clicking the link navigates to `/`, resetting all component state (search cleared, welcome section restored)
- Standard `<a>` behavior preserved: middle-click/cmd+click opens new tab, Tab/Enter keyboard navigation works

## Screenshots
![Homepage with clickable header link](https://github.com/chocobar/birding/raw/helix-specs/design/tasks/000436_add-link-to-homepage-on/screenshots/03-header-link-final.png)