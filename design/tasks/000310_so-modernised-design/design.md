# Design: Modernised UI & Bird Images

## Codebase Patterns & Constraints

- **Framework**: Next.js 16.2.1 (App Router) with React 19, TypeScript, Tailwind CSS v4
- **Styling**: All styling via Tailwind utility classes — no CSS modules or styled-components
- **Components**: Flat structure in `components/` — no component library (no shadcn, no Radix)
- **Fonts**: Currently Geist Sans + Geist Mono via `next/font/google`
- **Images**: Using `next/image` with Unsplash hotlinks (400×300 crops)
- **Icons**: `lucide-react` throughout
- **State**: Plain `useState` in `page.tsx` — no global state management
- **IMPORTANT**: This project uses Next.js 16 which has breaking changes from earlier versions. Always read `node_modules/next/dist/docs/` before writing code (per AGENTS.md)

## Architecture Decisions

### Decision 1: Bird Image Source — Wikipedia REST API

**Chosen**: Wikipedia Page Summary API (`https://en.wikipedia.org/api/rest_v1/page/summary/{title}`)

**Why Wikipedia over alternatives:**
- **Free, no API key required** — zero config for users
- **Returns `thumbnail` and `originalimage`** with sized URLs (can request specific widths via Wikimedia thumb URLs)
- **CC-licensed images** — proper attribution is straightforward
- **Reliable** — Wikipedia has excellent uptime and CDN
- **Lookup by common name works well** — e.g. `European_robin` returns the correct species page with photo

**Rejected alternatives:**
- *iNaturalist API*: Also free/no-key, returns photos via `default_photo.medium_url`. However, photos are often user-submitted with variable quality, and the license is "all rights reserved" on many photos. Would need to filter by license.
- *Unsplash*: Current approach — URLs are hardcoded and often show the wrong bird (e.g. "Carrion Crow" shows a tree photo). No programmatic search without API key.
- *eBird/Macaulay Library*: Requires API key and separate media API. More complex.
- *Flickr*: Requires API key.

**How it works:**
1. Bird comes back from eBird or mock data with `scientificName` and `commonName`
2. New server-side API route `/api/bird-image` takes a bird name, queries Wikipedia, returns the image URL
3. Client fetches images after bird data loads (non-blocking, progressive enhancement)
4. Cache results in a simple in-memory Map on the server to avoid repeated Wikipedia calls within the same session

**Fallback chain**: Wikipedia image → existing Unsplash URL (if in mock data) → gradient placeholder with bird icon

### Decision 2: Image Fetching Architecture — Server-Side Proxy

Bird image lookups go through a new Next.js API route (`/api/bird-image`) rather than calling Wikipedia directly from the client.

**Why:**
- Avoids CORS issues
- Allows server-side caching
- Keeps external API calls consolidated on the server (consistent with existing `/api/birds` pattern)
- Can add rate limiting later if needed

**Implementation:**
- New file: `app/api/bird-image/route.ts`
- Accepts `?name=European+Robin` query param
- Returns `{ imageUrl: string | null, attribution: string | null }`
- Simple in-memory cache (Map) — fine for a hobby app, no Redis needed

### Decision 3: UI Modernisation Approach — Tailwind-Only Refresh

**No new dependencies.** The modernisation is achieved purely through Tailwind class changes and minor structural tweaks.

**Why no component library:**
- The app is small (6 components) — adding shadcn/Radix is overkill
- Tailwind v4 provides everything needed for a modern look
- Avoids dependency bloat and learning curve for future contributors
- Keeps the "just Tailwind" pattern already established in the codebase

### Decision 4: Typography — Switch to Inter

Replace Geist with **Inter** — a clean, modern sans-serif that's widely used in contemporary web apps and feels warmer than Geist.

- Available via `next/font/google` (same mechanism already in use)
- Single font family for both body and headings (use weight variations for hierarchy)
- Fallback: system sans-serif stack

### Decision 5: Colour Palette — Nature-Inspired

Replace the generic blue/green gradient with a richer palette:

| Token | Value | Usage |
|-------|-------|-------|
| `--brand-green` | `#2d6a4f` | Primary actions, header accent |
| `--brand-green-light` | `#95d5b2` | Hover states, highlights |
| `--warm-cream` | `#fefae0` | Page background |
| `--warm-sand` | `#f5f0e1` | Card backgrounds |
| `--text-primary` | `#1b1b1b` | Headings |
| `--text-secondary` | `#5c5c5c` | Body text |
| `--accent-amber` | `#e9c46a` | Badges, frequency bars |
| `--accent-teal` | `#264653` | Secondary accent |

These are defined as CSS custom properties in `globals.css` and referenced via Tailwind's `@theme` directive (already set up in the project).

## Component Changes Summary

| Component | Changes |
|-----------|---------|
| `layout.tsx` | Swap Geist → Inter font |
| `globals.css` | New colour tokens, updated `@theme` block |
| `page.tsx` | Richer hero section with background image/pattern, updated header styling, cleaner footer |
| `PostcodeSearch.tsx` | Larger search bar, pill-shaped with softer colours, subtle shadow |
| `BirdCard.tsx` | Image overlay style, refined typography, updated colour usage, fetch image from `/api/bird-image` if no `imageUrl` |
| `BirdList.tsx` | Updated section header styling, skeleton cards match new design |
| `LocationCard.tsx` | Updated colour palette for type badges, refined spacing |
| `LocationList.tsx` | Updated section header, skeleton cards match |
| `app/api/bird-image/route.ts` | **New file** — Wikipedia image proxy |

## File Structure (New/Modified)

```
app/
├── api/
│   ├── birds/route.ts          (no changes)
│   └── bird-image/route.ts     (NEW — Wikipedia image proxy)
├── globals.css                 (MODIFIED — new colour tokens)
├── layout.tsx                  (MODIFIED — Inter font)
└── page.tsx                    (MODIFIED — hero, header, footer redesign)
components/
├── BirdCard.tsx                (MODIFIED — new design + image fetching)
├── BirdList.tsx                (MODIFIED — styling updates)
├── LocationCard.tsx            (MODIFIED — styling updates)
├── LocationList.tsx            (MODIFIED — styling updates)
├── PostcodeSearch.tsx          (MODIFIED — styling updates)
└── ErrorBoundary.tsx           (no changes)
```

## Risk & Mitigations

| Risk | Mitigation |
|------|-----------|
| Wikipedia API rate limiting | Server-side in-memory cache; only fetch once per species per server restart |
| Wikipedia doesn't have a photo for a species | Fallback chain: existing Unsplash URL → placeholder gradient |
| Wikipedia common name doesn't match eBird name | Try `commonName` first, then `scientificName` as fallback search |
| Design changes break mobile layout | Test at 375px, 768px, 1024px widths; keep existing responsive breakpoints |
| Next.js 16 `next/image` config for Wikipedia domains | Add `upload.wikimedia.org` to `images.remotePatterns` in `next.config.ts` |

## Implementation Notes

### Approach & Order of Changes

1. Started with `next.config.ts` (add Wikimedia domain) and the new `/api/bird-image/route.ts` — get the data pipeline working first
2. Updated `globals.css` with colour tokens and `layout.tsx` with Inter font — establishes the design system
3. Updated `page.tsx` (header, hero, footer) — sets the overall page chrome
4. Updated all components in one pass — `PostcodeSearch`, `BirdCard`, `BirdList`, `LocationCard`, `LocationList`
5. Polish pass — accessibility fix (underlined links), build verification, responsive testing

### Key Learnings

- **Wikimedia 429 rate limiting via `next/image`**: The biggest gotcha. `next/image` acts as a server-side proxy that fetches and optimizes remote images. When 12 bird cards all trigger fetches simultaneously, Wikimedia rate-limits the server. **Fix**: Add `unoptimized={resolvedImageUrl.includes('wikimedia.org')}` prop so the browser fetches Wikimedia images directly, bypassing the Next.js image optimization proxy. This is fine since Wikimedia already serves optimized images at the requested size.

- **Wikipedia name matching works well**: All 15 UK common bird names resolved correctly. The API route tries three strategies: (1) common name as-is, (2) scientific name fallback, (3) append "(bird)" for disambiguation. Strategy 1 worked for all tested species. The `(bird)` disambiguator would help for generic names like "Wren" or "Robin" that might hit disambiguation pages.

- **Next.js 16 font API change**: Uses `className` directly on `<html>` element, not the `variable` CSS custom property approach from older versions. The old code used `Geist({ variable: "--font-geist-sans" })` — the new pattern is `Inter({ subsets: ["latin"] })` with `inter.className`.

- **Unsplash URLs in mock data are stale**: Several hardcoded Unsplash URLs return 404 (photos removed/expired). Wikipedia images fix this organically since the `BirdCard` always fetches from Wikipedia and replaces whatever `imageUrl` was provided in the mock data.

- **CSS custom properties with Tailwind v4**: Colour tokens defined as `--brand-green: #2d6a4f` in `:root` and wired into Tailwind via `@theme inline { --color-brand-green: var(--brand-green); }`. Then used as `bg-[var(--brand-green)]` in components. The `@theme inline` block is already established in this codebase's `globals.css`.

- **Tailwind v4 arbitrary values with CSS vars**: Use `bg-[var(--warm-sand)]` syntax. Opacity modifiers like `bg-[var(--brand-green)]/10` work but can be unreliable — safer to use pre-defined opacity tokens or hardcoded rgba values for critical UI.

### Lighthouse Results

- Accessibility: 96 (1 issue was footer links relying on colour alone — fixed with underlines)
- Best Practices: 100
- SEO: 100

### What Future Agents Should Know

- This codebase is **Tailwind-only** — no component library, no CSS modules. All styling via utility classes.
- The `BirdCard` component does its own image fetching via `useEffect` — it's self-contained, not controlled by the parent.
- The Wikipedia image cache lives in the Node.js process memory (`Map` in `route.ts`). It resets on server restart. Fine for a hobby app.
- The `next/image` `unoptimized` prop is critical for Wikimedia URLs — removing it will cause 429 errors.