# Plan

- `js/subnet.js`: pure functions (ip conversion, usable hosts, prefix sizing, alignment, overlap, free-slot search).
- `js/levels.js`: level data. Each level picks a grid unit no larger than its smallest correct block.
- `js/game.js`: puzzle mode state, validation, rendering, scoring, drill mode, tab switching.
- `js/falling-core.js`: pure arcade rules (Z-order layout, shapes, rotation with kicks, gravity, locking, rounds).
- `js/falling.js`: canvas drawing, keyboard and touch input, game loop, side panel.
- `index.html` and `style.css`: single page, light and dark themes, reduced-motion friendly.
- `tests/run.py` (unit logic, layout, rotation, solvability) and `tests/e2e.py` (UI playthrough), both in headless Chrome because Node is not installed.
- `tests/playwright_test.py`: Playwright browser test that checks the game against an independent Python model.
- Static hosting: `static_root` is `.`.
