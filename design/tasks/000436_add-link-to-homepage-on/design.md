# Design: Add Link to Homepage on Bird Results Page

## Current State

The header in `app/page.tsx` (lines ~60–76) renders "Birding Discovery" as a plain `<h1>` inside a `<div>`. It is not interactive. After a postcode search, results replace the welcome content and there is no obvious way to return to the initial state without a browser refresh.

```
<header className="bg-[var(--accent-teal)] text-white">
  <div>
    <div> <!-- icon --> </div>
    <div>
      <h1>Birding Discovery</h1>
      <p>Find birds and birding spots near you</p>
    </div>
  </div>
</header>
```

## Approach

Wrap the Feather icon + title group in a clickable element that resets the page state to the welcome view. Since this is a single-page app with no routing (only one `page.tsx`), we don't need a Next.js `<Link>` — a `<button>` or `<a href="/">` that resets client state is sufficient.

### Option A: `<a href="/">` (chosen)

Use a standard anchor tag linking to `/`. This performs a client-side navigation in Next.js and also resets all `useState` values to their defaults — effectively restoring the welcome state. This is the simplest solution: no new props, no callback plumbing, and it behaves correctly for middle-click / cmd+click (opens in new tab).

### Option B: `<button>` with state reset callback (not chosen)

Would require lifting a reset function or passing an `onReset` callback. More code, and doesn't support native link behaviors (right-click → open in new tab, etc.).

## Changes

**File:** `app/page.tsx`

1. Wrap the existing header icon + title `<div>` (the `flex items-center gap-3` container) in an `<a href="/">` tag.
2. Add styling: `cursor-pointer`, remove default underline, keep white text, add subtle `hover:opacity-90` for feedback.
3. No new components, no new files, no new dependencies.

## Visual Outcome

- **Before search:** Header looks the same, but the title area is now a link (cursor changes on hover).
- **After search:** Clicking "Birding Discovery" in the header navigates to `/`, resetting the page to the welcome state with the search input cleared.

## Accessibility

- The `<a>` tag is natively keyboard-focusable and screen-reader-friendly.
- The link text "Birding Discovery" is descriptive enough — no additional `aria-label` needed.
- Focus ring styling should use the existing Tailwind `focus:outline-none focus:ring-2` pattern used elsewhere in the app.

## Risks & Edge Cases

- **None significant.** This is a minimal, low-risk change. Navigating to `/` in a single-page Next.js app resets component state cleanly.
- If a user middle-clicks the header, it opens a fresh tab at `/` — expected and correct behavior.

## Implementation Notes

- **ESLint enforces `next/link`:** The codebase has the `@next/next/no-html-link-for-pages` ESLint rule enabled. Using a plain `<a href="/">` causes a lint error. Used `import Link from 'next/link'` and `<Link href="/">` instead — this was not in the original plan but is the correct approach for Next.js.
- **Next.js `<Link>` renders as `<a>` internally:** In Next.js 13+, `<Link>` renders a standard `<a>` tag directly (no child `<a>` needed). This means all native link behaviors (middle-click, right-click → open in new tab, keyboard Tab/Enter) work out of the box.
- **Only one file changed:** `app/page.tsx` — replaced the `<div className="flex items-center gap-3">` wrapper around the header icon + title with `<Link href="/" className="flex items-center gap-3 ...">`. Added `import Link from 'next/link'` at the top.
- **Styling classes added to the Link:** `no-underline text-white hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-white/50 rounded-xl` — keeps white text, adds subtle opacity hover effect, and provides a visible focus ring for keyboard users.
- **No new components or files created.** The change is 3 lines of diff.
- **Build and lint pass cleanly** with zero errors.