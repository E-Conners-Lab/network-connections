# Address Space Packer

Merge the address space back together. A subnetting game for the NAF AC6 workshop.

**Subnet 2048 (default).** Tiles are real subnets, like `10.0.0.16/28`. Slide them around a 4x4 board with the arrow keys (or WASD, the buttons, or a swipe). Two tiles merge only if they are *siblings*: the two halves of the same bigger block, side by side, with the lower one starting on a multiple of the bigger block's size.

- 10.0.0.0/28 + 10.0.0.16/28 = 10.0.0.0/27 (siblings)
- 10.0.0.16/28 + 10.0.0.32/28 cannot merge, because a /27 cannot start at .16

The goal is to merge everything back into the parent block, such as 10.0.0.0/24. There is no timer. A map bar shows what is on the board and what is still to arrive, and Hint and Undo are always available. Six levels run from a /26 up to a /20 campus summary, with mixed block sizes in levels 4 and 6.

| Key | Action |
| --- | --- |
| Arrows or WASD | Slide |
| U / H / R | Undo / hint / restart |

**Puzzle.** Eight levels of click-to-place VLSM, from a simple /24 split to a /20 campus build, with /30 and RFC 3021 /31 links and a brownfield level.

**Warm-up drill.** Ten quick questions on usable hosts and prefix sizing.

## Run it

```
python3 -m http.server 8000
```

Then open http://localhost:8000. No install, no network, no API key.

## Tests

```
python3 tests/run.py   # subnet maths, merge rules, level solvability (headless Chrome)
python3 tests/e2e.py   # drives the UI (headless Chrome)

# Playwright browser test with an independent Python model; opens a real window and records video
python3 -m venv .venv-test && .venv-test/bin/pip install playwright && .venv-test/bin/playwright install chromium
.venv-test/bin/python tests/playwright_test.py            # add --headless to hide the window
```

The first two need Google Chrome at the default macOS path; edit the `chrome` variable for other platforms.
Playwright output goes to `test-artifacts/` (video and screenshots, not committed).

## Spec

See `specs/` (constitution, spec, plan) and `ARCADE.md` for build details.
