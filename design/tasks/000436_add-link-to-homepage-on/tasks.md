# Implementation Tasks

- [~] In `app/page.tsx`, wrap the header icon + title container (`<div className="flex items-center gap-3">`) in an `<a href="/">` tag
- [~] Style the link: remove default underline (`no-underline`), add `hover:opacity-90` for hover feedback, and add `focus:outline-none focus:ring-2 focus:ring-white/50 rounded-xl` for keyboard focus visibility
- [ ] Verify that clicking the header link from the results view resets the page to the welcome state (search input cleared, results hidden, welcome section visible)
- [ ] Verify that middle-click / cmd+click on the header link opens a new tab at `/`
- [ ] Verify the header link is keyboard-navigable (Tab to focus, Enter to activate)