# Plan

- `js/subnet.js`: pure functions (ip conversion, usable hosts, prefix sizing, alignment, overlap, free-slot search).
- `js/levels.js`: level data. Each level picks a grid unit no larger than its smallest correct block.
- `js/game.js`: puzzle mode state, validation, rendering, scoring, drill mode, tab switching.
- `js/merge-core.js`: pure Subnet 2048 rules (siblings, slide and merge, pool, spawn helper, win and stuck, undo, hint).
- `js/merge.js`: board rendering with sliding tiles, address-map bar, keyboard, buttons and swipe input.
- `index.html` and `style.css`: single page, light and dark themes, reduced-motion friendly.
- `tests/run.py` (unit logic, merge rules, level winnability) and `tests/e2e.py` (UI playthrough), both in headless Chrome because Node is not installed.
- `tests/playwright_test.py`: Playwright browser test that checks every move against an independent Python model.
- Static hosting: `static_root` is `.`.
