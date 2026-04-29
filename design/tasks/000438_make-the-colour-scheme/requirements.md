# Requirements: Make the Colour Scheme Snappy

## Context

The Birding Discovery app currently uses a muted, earthy palette (warm cream backgrounds, soft greens, teal header, amber accents). While pleasant, it feels flat and low-energy. The user wants a "snappy" colour scheme inspired by [All About Birds](https://www.allaboutbirds.org/news/).

### Inspiration site analysis (All About Birds)

- **Header**: Deep crimson/maroon (`~#a01a24`) — bold, authoritative
- **Primary accent**: Confident red for CTAs, donate buttons, active states
- **Backgrounds**: Clean white — high contrast, makes photography pop
- **Text**: Near-black headings, medium-gray body text — sharp hierarchy
- **Overall**: High-contrast, photography-first, punchy without being garish

### Current app palette (what we're replacing)

| Token | Current value | Feel |
|---|---|---|
| `--brand-green` | `#2d6a4f` | Muted forest green |
| `--brand-green-light` | `#95d5b2` | Pale mint |
| `--brand-green-dark` | `#1b4332` | Dark forest |
| `--accent-amber` | `#e9c46a` | Warm gold |
| `--accent-teal` | `#264653` | Dark teal (header) |
| `--warm-cream` | `#fefae0` | Yellowish cream |
| `--warm-sand` | `#f5f0e1` | Beige |
| `--border-light` | `#e8e2d4` | Warm border |

## User Stories

1. **As a visitor**, I want the app to feel modern, vibrant, and trustworthy at first glance so I'm more inclined to try it.
2. **As a user browsing bird cards**, I want high contrast between the card background and bird photos so the images stand out.
3. **As a user**, I want clear visual hierarchy (headers, buttons, links) so I can navigate quickly without confusion.

## Acceptance Criteria

- [ ] The colour scheme uses higher-contrast, more vibrant tones inspired by All About Birds (punchy reds/warm accents, cleaner whites, sharper text contrast)
- [ ] All CSS custom properties in `globals.css` are updated to the new palette — no hardcoded colour values added elsewhere
- [ ] The header feels bold and distinctive (not the current muted teal)
- [ ] Card backgrounds provide strong contrast against bird photography
- [ ] Primary action buttons (search, show more) use a vivid accent colour with clear hover/focus states
- [ ] Text maintains WCAG AA contrast ratios (4.5:1 for body text, 3:1 for large text) against all backgrounds
- [ ] The Tailwind `@theme inline` block is updated to expose the new tokens
- [ ] No component files need new colour values — they already reference CSS variables, so updates flow through automatically
- [ ] The app still looks cohesive — conservation status badges, location type badges, and other semantic colours (emerald, amber, sky, red for errors) remain untouched
- [ ] Loading skeletons and placeholder states still look correct with the new background colours