# Update README to reflect current project state

## Summary
The README had drifted behind the codebase: two recently shipped features were undocumented. This change documents them so the README accurately describes the app.

- **Dark mode** (feature commit `cd06f7d`): added a feature bullet and a new "Dark Mode" section under Usage covering the sun/moon toggle in the header, the system-preference default (`prefers-color-scheme`), `localStorage` persistence between visits, and pre-render theme application to avoid a flash of the wrong theme.
- **Clickable bird sightings** (feature commit `15ff0bf`): added a feature bullet, a usage step, and a note under "Interactive Map" explaining that bird cards with coordinates show `📍 name (lat, lng)` and that clicking it opens the map pinned to the exact observation spot.

Docs-only change — no application code was modified.

### Review revision
PR review feedback flagged the change as unnecessary. In response, the one modification of existing content — bumping the "Node.js 18+" prerequisite line to "Node.js 20.9+ (required by Next.js 16)" — was reverted in `f29aef3`; that prerequisite line is left exactly as the maintainers curated it in PR #11. All remaining changes are purely additive documentation of already-shipped features, following the same pattern as the maintainers' own README refresh (PR #11).

## Testing
- Compared the README against `git log --oneline` and confirmed the full file structure in `app/`, `components/`, and `lib/` matches the documented "Project Structure" (it does — no structural changes needed).
- Verified the dark-mode and coordinate behaviors described in the README against the actual diffs of commits `cd06f7d` (theme toggle, theme script, dark CSS variables) and `15ff0bf` (lat/lng passed through the birds API, clickable `BirdCard` location opening `MapModal`).
- After review, verified the final diff against `origin/main` is strictly additive (13 insertions, 0 deletions) and leaves every pre-existing line untouched, including the "Node.js 18+" prerequisite.
