# Implementation Tasks

## Phase 1: Bird Image API

- [x] Add `upload.wikimedia.org` to `images.remotePatterns` in `next.config.ts`
- [x] Create `app/api/bird-image/route.ts` — server-side proxy that takes `?name=European+Robin`, queries Wikipedia REST API (`/api/rest_v1/page/summary/{title}`), returns `{ imageUrl, attribution }` with in-memory cache (simple `Map`)
- [x] Handle fallback: try `commonName` first (spaces replaced with underscores), then `scientificName` if first lookup fails
- [x] Update `BirdCard.tsx` to fetch image from `/api/bird-image?name={commonName}` when `imageUrl` is missing (eBird live data case) — use `useEffect` + local state, non-blocking
- [x] Keep existing Unsplash URLs in mock data as secondary fallback; Wikipedia image takes priority when available
- [x] Show gradient placeholder with bird icon while image is loading or if all sources fail

## Phase 2: Design Tokens & Typography

- [x] Replace Geist font with Inter in `layout.tsx` (same `next/font/google` approach)
- [x] Update `globals.css` — add nature-inspired colour tokens as CSS custom properties (`--brand-green: #2d6a4f`, `--warm-cream: #fefae0`, `--warm-sand: #f5f0e1`, `--accent-amber: #e9c46a`, `--accent-teal: #264653`, etc.)
- [x] Wire colour tokens into Tailwind via `@theme inline` block in `globals.css`
- [x] Remove dark mode colour overrides (out of scope, keeps things simple)

## Phase 3: Page Layout & Header

- [x] Redesign header in `page.tsx` — use `--brand-green` / `--accent-teal` background, white text, bolder logo treatment
- [x] Update page background from `bg-gradient-to-br from-blue-50 via-green-50 to-emerald-50` to warm cream (`--warm-cream`)
- [x] Redesign hero/welcome section — add a tagline, use illustration-style layout with feature cards that have icons and richer styling, remove the oversized bird icon
- [x] Clean up footer — single line of attribution links, less visual clutter, softer text colour

## Phase 4: Component Styling Updates

- [x] `PostcodeSearch.tsx` — pill-shaped input with softer border, larger padding, subtle drop shadow, green-toned action buttons matching new palette
- [x] `BirdCard.tsx` — refined card style: `--warm-sand` background, softer rounded corners (`rounded-xl`), subtle border instead of heavy shadow, image with slight rounded top corners, updated conservation badge colours to match palette
- [x] `BirdList.tsx` — update section heading style (use `--text-primary` colour, slightly larger), update skeleton cards to match new card design
- [x] `LocationCard.tsx` — update type badge colours to use new palette tokens, refine icon container styling, consistent card background with bird cards
- [x] `LocationList.tsx` — update section heading, match skeleton style to new design
- [x] Add smooth hover transitions to all cards (`transition-all duration-200`, subtle scale or shadow lift)

## Phase 5: Polish & Attribution

- [x] Update footer attribution to include Wikipedia/Wikimedia Commons as image source
- [x] Verify all images render correctly for mock data (15 UK birds) and eBird live data path
- [~] Test responsive layout at 375px (mobile), 768px (tablet), 1024px+ (desktop)
- [~] Verify accessibility: colour contrast ratios meet WCAG AA, keyboard navigation works, screen reader labels intact
- [~] Run `npm run build` to confirm no build errors

## Learnings / Gotchas

- **Wikimedia 429 rate limiting**: `next/image` acts as a server-side proxy that fetches images from Wikimedia, which rate-limits aggressively. Fixed by adding `unoptimized` prop for Wikimedia URLs so the browser fetches directly.
- **Wikipedia name matching**: All 12 UK common bird names resolved correctly via the Wikipedia REST API — "European Starling" → "Common starling" worked via the scientific name fallback.
- **Next.js 16 font API**: Uses `className` directly on `<html>`, not the `variable` approach from older Next.js versions.
- **Unsplash URLs returning 404**: Several of the hardcoded Unsplash URLs in mock data return 404 (expired/removed photos). Wikipedia images fix this organically since they take priority.