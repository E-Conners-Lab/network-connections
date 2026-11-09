# Address Space Packer

Pack the address space. Waste nothing. A subnetting / VLSM puzzle game for the NAF AC6 workshop.

**Arcade (default).** Subnets fall into a /24 well like Tetris pieces. Size each block for its host request, rotate it, and drop it onto the stack. Some requests are bundles of equal subnets that fall as L, T, S and Z shapes. Oversized blocks and gaps fill the well, and clearing a round starts a faster one.

| Key | Action |
| --- | --- |
| Left / Right | Move one block width |
| Up or X / Z | Rotate / rotate back |
| A / S | Bigger / smaller block (prefix) |
| Down / Space | Soft drop / hard drop |
| P / Enter | Pause / start |

The well uses a Z-order layout, so a /30 is 2x2, a /29 is 4x2, a /28 is 4x4, a /26 is 8x8, and every block is a real aligned subnet.

**Puzzle.** Eight levels of click-to-place VLSM, from a simple /24 split to a /20 campus build, with /30 and RFC 3021 /31 links and a brownfield level with blocks already in use.

**Warm-up drill.** Ten quick questions on usable hosts and prefix sizing.

## Run it

```
python3 -m http.server 8000
```

Then open http://localhost:8000. No install, no network, no API key.

## Tests

```
python3 tests/run.py   # subnet maths, layout, rotation, level solvability (headless Chrome)
python3 tests/e2e.py   # drives the UI (headless Chrome)

# Playwright browser test with an independent Python model; opens a real window and records video
python3 -m venv .venv-test && .venv-test/bin/pip install playwright && .venv-test/bin/playwright install chromium
.venv-test/bin/python tests/playwright_test.py            # add --headless to hide the window
```

The first two need Google Chrome at the default macOS path; edit the `chrome` variable for other platforms.
Playwright output goes to `test-artifacts/` (video and screenshots, not committed).

## Spec

See `specs/` (constitution, spec, plan) and `ARCADE.md` for build details.
