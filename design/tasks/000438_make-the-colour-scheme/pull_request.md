# Update colour scheme to snappy palette inspired by All About Birds

## Summary
Replaces the muted, earthy colour palette with a higher-contrast, more vibrant scheme inspired by [All About Birds](https://www.allaboutbirds.org/news/). The app now feels modern and crisp rather than soft and vintage.

## Changes
- Updated all 10 CSS custom properties in `app/globals.css` `:root` block
- Clean white background (`#ffffff`) replaces warm cream (`#fefae0`)
- Bold near-black navy header (`#1a1a2e`) replaces muted teal (`#264653`)
- Brighter greens (`#2b7a4b`, `#6fce97`, `#1a5c35`) replace muted forest tones
- Vibrant red accent (`#e8453c`) replaces warm gold (`#e9c46a`)
- Cooler, crisper grays for text and borders

## Testing
- Visually verified homepage (header, search bar, welcome cards, footer)
- All WCAG AA contrast ratios confirmed programmatically (lowest: 5.27:1, threshold: 4.5:1)
- Semantic status badges (conservation, location type) unaffected — they use Tailwind built-in colours

## Screenshots

### Before
![Homepage before](https://github.com/chocobar/birding/raw/helix-specs/design/tasks/000438_make-the-colour-scheme/screenshots/01-current-app-homepage.png)

### After
![Homepage after](https://github.com/chocobar/birding/raw/helix-specs/design/tasks/000438_make-the-colour-scheme/screenshots/03-homepage-after.png)