# Implementation Tasks

## Phase 1: Bird Image API

- [ ] Add `upload.wikimedia.org` to `images.remotePatterns` in `next.config.ts`
- [ ] Create `app/api/bird-image/route.ts` — server-side proxy that takes `?name=European+Robin`, queries Wikipedia REST API (`/api/rest_v1/page/summary/{title}`), returns `{ imageUrl, attribution }` with in-memory cache (simple `Map`)
- [ ] Handle fallback: try `commonName` first (spaces replaced with underscores), then `scientificName` if first lookup fails
- [ ] Update `BirdCard.tsx` to fetch image from `/api/bird-image?name={commonName}` when `imageUrl` is missing (eBird live data case) — use `useEffect` + local state, non-blocking
- [ ] Keep existing Unsplash URLs in mock data as secondary fallback; Wikipedia image takes priority when available
- [ ] Show gradient placeholder with bird icon while image is loading or if all sources fail

## Phase 2: Design Tokens & Typography

- [ ] Replace Geist font with Inter in `layout.tsx` (same `next/font/google` approach)
- [ ] Update `globals.css` — add nature-inspired colour tokens as CSS custom properties (`--brand-green: #2d6a4f`, `--warm-cream: #fefae0`, `--warm-sand: #f5f0e1`, `--accent-amber: #e9c46a`, `--accent-teal: #264653`, etc.)
- [ ] Wire colour tokens into Tailwind via `@theme inline` block in `globals.css`
- [ ] Remove dark mode colour overrides (out of scope, keeps things simple)

## Phase 3: Page Layout & Header

- [ ] Redesign header in `page.tsx` — use `--brand-green` / `--accent-teal` background, white text, bolder logo treatment
- [ ] Update page background from `bg-gradient-to-br from-blue-50 via-green-50 to-emerald-50` to warm cream (`--warm-cream`)
- [ ] Redesign hero/welcome section — add a tagline, use illustration-style layout with feature cards that have icons and richer styling, remove the oversized bird icon
- [ ] Clean up footer — single line of attribution links, less visual clutter, softer text colour

## Phase 4: Component Styling Updates

- [ ] `PostcodeSearch.tsx` — pill-shaped input with softer border, larger padding, subtle drop shadow, green-toned action buttons matching new palette
- [ ] `BirdCard.tsx` — refined card style: `--warm-sand` background, softer rounded corners (`rounded-xl`), subtle border instead of heavy shadow, image with slight rounded top corners, updated conservation badge colours to match palette
- [ ] `BirdList.tsx` — update section heading style (use `--text-primary` colour, slightly larger), update skeleton cards to match new card design
- [ ] `LocationCard.tsx` — update type badge colours to use new palette tokens, refine icon container styling, consistent card background with bird cards
- [ ] `LocationList.tsx` — update section heading, match skeleton style to new design
- [ ] Add smooth hover transitions to all cards (`transition-all duration-200`, subtle scale or shadow lift)

## Phase 5: Polish & Attribution

- [ ] Update footer attribution to include Wikipedia/Wikimedia Commons as image source
- [ ] Verify all images render correctly for mock data (15 UK birds) and eBird live data path
- [ ] Test responsive layout at 375px (mobile), 768px (tablet), 1024px+ (desktop)
- [ ] Verify accessibility: colour contrast ratios meet WCAG AA, keyboard navigation works, screen reader labels intact
- [ ] Run `npm run build` to confirm no build errors