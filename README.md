# Network Connections

Find four groups of four. A quick networking and network-automation word puzzle for the NAF AC6 workshop, built to play on a phone.

Sixteen tiles hide four groups of four related terms, for example *routing protocols* (OSPF, BGP, EIGRP, RIP) or *TCP flags* (SYN, ACK, FIN, RST). Tap four tiles and submit. You get four mistakes, and a "One away!" nudge when three of your four belong together. At the end every group shows a one-line reason, and you can copy a shareable emoji result.

Eight puzzles ship: Network Basics, Which Layer?, Automation Toolbox, DevOps for Networks, Security, Addresses and Delivery, Cables and Wi-Fi, and a Routing and Switching Deep Dive.

## Run it

```
python3 -m http.server 8000
```

Then open http://localhost:8000. No install, no network, no API key. Everything is a tap, so it works on a phone browser too.

## Add or edit a puzzle

Puzzles live in `data/puzzles.json`. Each has an `id`, a `title` and four `groups`, listed from easiest (yellow) to hardest (purple). A group has a `name`, exactly four `items`, and a one-line `why`. Every item in a puzzle must be different. The game checks this when it loads and shows an error if a puzzle is invalid, and the tests check every shipped puzzle.

## Tests

```
python3 tests/run.py   # unit tests of the rules and puzzle validator (headless Chrome)

# Playwright browser test: plays every puzzle through the real UI on desktop and phone-sized touch screens
python3 -m venv .venv-test && .venv-test/bin/pip install playwright && .venv-test/bin/playwright install chromium
.venv-test/bin/python tests/playwright_test.py            # add --headless to hide the window
```

`tests/run.py` needs Google Chrome at the default macOS path; edit the `chrome` variable for other platforms.
Playwright output goes to `test-artifacts/` (video and screenshots, not committed).

## Spec

See `specs/` (constitution, spec, plan) and `ARCADE.md` for build details.
