# Plan

- `data/puzzles.json`: the puzzles (id, title, four groups with name, items, why).
- `js/connections-core.js`: pure logic with no DOM: `validatePuzzle`, `newGame`, `toggle`, `submit`, `shuffle`, `deselectAll`, `shareText`, a seeded random generator.
- `js/icons.js`: the line-icon set used on the group banners.
- `js/game.js`: loads the JSON, renders the page (topology, banners, themes, motion), wires taps, keeps results in localStorage, exposes `window.__nc.snapshot()` for tests.
- `index.html` and `style.css`: single page, mobile first, light and dark themes.
- `tests/index.html` and `tests/run.py`: unit tests of the core and a validity check of every shipped puzzle, run in headless Chrome because Node is not installed.
- `tests/playwright_test.py`: Playwright browser test. It reads `puzzles.json` with a separate Python implementation, plays every puzzle through the real UI, covers wrong, one-away, duplicate and lost paths, and repeats the key flows on a phone-sized touch screen.
- Static hosting: `static_root` is `.`.

## Build order
1. Specs (this folder).
2. Puzzle data and the validator.
3. Core logic and unit tests.
4. UI.
5. Playwright tests.
6. README, card image and ARCADE.md.
