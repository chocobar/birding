# Requirements: Add Link to Homepage on Bird Results Page

## Overview

The Birding Discovery app is a single-page Next.js application (`app/page.tsx`). After a user searches for a postcode, bird and location results replace the welcome content. Currently, the header shows "Birding Discovery" as static text with no way to navigate back to the welcome/home state without refreshing the browser.

## User Stories

1. **As a user viewing bird results**, I want to click the site title in the header to return to the homepage welcome state, so I can start a new search from a clean page.

## Acceptance Criteria

- [ ] The "Birding Discovery" header text (and/or the Feather icon) is wrapped in a clickable link that returns the user to the homepage welcome state.
- [ ] Clicking the link clears the current search results and restores the welcome section (the "Discover the birds around you" hero + feature cards).
- [ ] The search input is cleared when navigating home.
- [ ] The link has appropriate hover/focus styling consistent with the existing design (e.g., cursor pointer, subtle visual feedback).
- [ ] The link is accessible: uses a semantic `<a>` tag or equivalent, has appropriate `aria` attributes if needed, and is keyboard-navigable.

## Codebase Notes

- **Framework:** Next.js 16.2.1 with Turbopack, single-page app (only `app/page.tsx`).
- **Header location:** Defined inline in `app/page.tsx` (lines ~60–76), inside a `<header>` element. The title "Birding Discovery" is a plain `<h1>` inside a `<div>` — not clickable.
- **State management:** The homepage state is controlled by `postcode` (string) and `coords` (object) via `useState`. Setting `postcode` back to `''` and `coords` to `null` resets the page to the welcome view (`hasSearched = postcode !== ''`).
- **Styling:** Tailwind CSS with custom CSS variables (`--brand-green`, `--accent-teal`, etc.). No separate component for the header — it's inline JSX.
- **Icons:** Uses `lucide-react` (Feather icon in header).