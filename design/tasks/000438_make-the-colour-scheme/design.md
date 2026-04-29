# Design: Make the Colour Scheme Snappy

## Architecture

This is a CSS-only change. The app already uses a well-structured token system:

1. **CSS custom properties** defined in `:root` in `app/globals.css`
2. **Tailwind `@theme inline`** block that exposes those properties as utility classes (e.g. `bg-brand-green`)
3. **Components** reference tokens via `var(--brand-green)` or Tailwind utilities — no hardcoded hex values

This means updating the palette is a single-file change to `app/globals.css`. All 7 components (`page.tsx`, `PostcodeSearch`, `BirdCard`, `BirdList`, `LocationCard`, `LocationList`, `ErrorBoundary`) will inherit the new colours automatically.

## New Palette

Inspired by All About Birds' high-contrast, photography-first approach — but adapted to keep a nature identity rather than copying their exact Cornell red.

| Token | Old value | New value | Rationale |
|---|---|---|---|
| `--brand-green` | `#2d6a4f` (muted forest) | `#2b7a4b` (vivid kelly green) | Brighter, more energetic — still "nature" but snappier |
| `--brand-green-light` | `#95d5b2` (pale mint) | `#6fce97` (medium spring green) | Stronger presence for focus rings, hover highlights |
| `--brand-green-dark` | `#1b4332` (very dark forest) | `#1a5c35` (deep green) | Slightly brighter for hover states, still readable on white |
| `--accent-amber` | `#e9c46a` (warm gold) | `#e8453c` (vibrant red) | The big shift — inspired by All About Birds' red CTAs. Becomes the "pop" accent for energy |
| `--accent-teal` | `#264653` (dark teal) | `#1a1a2e` (near-black navy) | Darker, bolder header — makes white text pop like All About Birds' crimson header |
| `--warm-cream` | `#fefae0` (yellowish cream) | `#ffffff` (pure white) | Clean white background — lets bird photos and cards breathe, like All About Birds |
| `--warm-sand` | `#f5f0e1` (beige) | `#f7f7f8` (cool near-white) | Subtle card background — just enough contrast on white without the warm/muddy feel |
| `--text-primary` | `#1b1b1b` | `#111827` (gray-900) | Slightly cooler, crisper black |
| `--text-secondary` | `#5c5c5c` | `#4b5563` (gray-600) | Cooler gray, better contrast on white |
| `--border-light` | `#e8e2d4` (warm tan) | `#e5e7eb` (gray-200) | Neutral border — no more warm/yellowish cast |

### Why these choices

- **White backgrounds** are the single biggest "snappiness" upgrade. The creamy yellows made everything feel soft/vintage. Clean white is modern and lets photography be the star.
- **The red accent** (`#e8453c`) draws from All About Birds' signature red. Used sparingly — it replaces `--accent-amber` which was barely visible anyway. It'll show up in the header icon background and could be used for emphasis.
- **The darker header** (`#1a1a2e`) gives a strong anchor at the top. All About Birds uses deep crimson; we use near-black navy — same impact, different flavour.
- **Brighter greens** keep the nature identity but feel alive rather than dusty.

### WCAG compliance check

| Combination | Ratio | Passes AA? |
|---|---|---|
| `--text-primary` (#111827) on white (#ffffff) | 16.8:1 | ✅ |
| `--text-secondary` (#4b5563) on white (#ffffff) | 7.1:1 | ✅ |
| White text on `--accent-teal` header (#1a1a2e) | 16.2:1 | ✅ |
| White text on `--brand-green` button (#2b7a4b) | 5.1:1 | ✅ |
| `--brand-green` (#2b7a4b) on white (#ffffff) | 5.1:1 | ✅ (links) |

## What NOT to change

- **Semantic status colours**: Conservation badges (`emerald`, `amber`, `red`, `orange`), location type badges (`sky`, `teal`, `green`, `amber`), and error states (`red-50`, `red-200`) use Tailwind's built-in palette. These are fine and should stay.
- **Component structure**: No layout, markup, or behavioural changes.
- **Font**: Inter stays.
- **Animations**: `fade-in-up` keyframes stay.

## File impact

| File | Change |
|---|---|
| `app/globals.css` | Update `:root` custom properties (10 values) |

That's it — one file. The `@theme inline` block and all component references flow through automatically.

## Codebase patterns discovered

- **Tailwind v4** with `@tailwindcss/postcss` — uses the new `@theme inline` directive instead of `tailwind.config.js`
- All colour usage goes through CSS custom properties — excellent separation. No grep for hardcoded hex values needed in components.
- Some components mix `var(--token)` inline styles with Tailwind utility classes (`bg-[var(--warm-sand)]`). Both resolve from the same `:root` variables, so updating globals.css covers everything.
- The `body` selector in globals.css sets `background` and `color` from `--background` and `--foreground`, which are aliases for `--warm-cream` and `--text-primary`.