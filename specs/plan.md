# Plan

- `js/subnet.js`: pure functions (ip conversion, usable hosts, prefix sizing, alignment, overlap, free-slot search).
- `js/levels.js`: level data. Each level picks a grid unit no larger than its smallest correct block.
- `js/game.js`: state, validation, rendering, scoring, drill mode.
- `index.html` and `style.css`: single page, light and dark themes, reduced-motion friendly.
- `tests/run.py` (unit logic and level solvability) and `tests/e2e.py` (UI playthrough), both in headless Chrome because Node is not installed.
- Static hosting: `static_root` is `.`.
