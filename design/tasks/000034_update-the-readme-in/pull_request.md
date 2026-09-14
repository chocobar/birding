# Update README to reflect current project state

## Summary
The README had drifted behind the codebase: two recently shipped features were missing and a prerequisite was out of date. This change documents them so the README accurately describes the app.

- **Dark mode** (feature commit `cd06f7d`): added a feature bullet and a new "Dark Mode" section under Usage covering the sun/moon toggle in the header, the system-preference default (`prefers-color-scheme`), `localStorage` persistence between visits, and pre-render theme application to avoid a flash of the wrong theme.
- **Clickable bird sightings** (feature commit `15ff0bf`): added a feature bullet, a usage step, and a note under "Interactive Map" explaining that bird cards with coordinates show `📍 name (lat, lng)` and that clicking it opens the map pinned to the exact observation spot.
- **Prerequisites fix**: bumped Node.js 18+ to Node.js 20.9+, verified against Next.js 16.2.1's npm `engines` requirement (`>=20.9.0`).

Docs-only change — no application code was modified.

## Testing
- Compared the README against `git log --oneline` and confirmed the full file structure in `app/`, `components/`, and `lib/` matches the documented "Project Structure" (it does — no structural changes needed).
- Verified the dark-mode and coordinate behaviors described in the README against the actual diffs of commits `cd06f7d` (theme toggle, theme script, dark CSS variables) and `15ff0bf` (lat/lng passed through the birds API, clickable `BirdCard` location opening `MapModal`).
- Verified the Node.js requirement via the npm registry metadata for `next@16.2.1`.
- Confirmed the working tree was clean before changes and that only `README.md` was modified (14 insertions, 1 deletion).
