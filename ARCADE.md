---
arcade_version: 1

game:
  title: "Address Space Packer"
  slug: address-space-packer
  tagline: "Merge sibling subnets back into one route."
  summary: "Slide subnet blocks around a 4x4 board like 2048, but two blocks only merge when they are true siblings, the two halves of the same bigger block. You rebuild a whole parent block such as 10.0.0.0/24 and learn CIDR, summarisation and why alignment matters. A placement puzzle and a warm-up drill cover the same skills."
  topics: [Subnetting, CIDR, Route summarisation, Block alignment, RFC 4632]
  category: network-fundamentals
  skill_level: beginner
  play_minutes: 15
  levels: 14
  card_image: assets/images/title.png
  card_image_alt: "Two purple /28 blocks plus each other equal one /27 block under the title Address Space Packer."
  repo: https://github.com/E-Conners-Lab/address-space-packer
  repo_path: ""
  license: MIT

creator:
  name: "Elliot Conner"
  github: E-Conners-Lab
  location: ""
  organization: "Itential"
  links: []
  first_spec_project: false
  workshop: "NAF AC6"
  consent_to_publish: true

build:
  started: "2026-11-09"
  finished: "2026-11-09"
  wall_time: unknown
  spec_driven:
    framework: "custom"
    framework_version: unknown
    artifacts: [constitution, spec, plan]
    task_count: 0
    loops_or_phases: 0
  model: "claude-sonnet-5-5"
  helper_models: ["two web-fetch subagents used to read the arcade page and the ARCADE.md template; model ID unknown"]
  harness: "Claude Code"
  harness_version: "2.1.319"
  mcp_servers: ["none called during the build; an itential MCP server was configured but failed to connect (CONNECT_TIMEOUT)"]
  rag_and_sources: ["https://automateyournetwork.com/arcade/ (fetched)", "https://automateyournetwork.com/arcade/ARCADE.md (fetched)", "RFC 4632, RFC 3021 and RFC 1918 from model knowledge, not fetched during the session"]
  skills_and_plugins: ["none"]
  other_tools: ["Playwright 1.64.1 for Python with Playwright Chromium (browser tests, video)", "pip-audit (no known vulnerabilities reported in the test venv)", "Google Chrome 157 headless (unit and UI test pages, screenshots, card image render)", "Python 3 http.server", "gh CLI"]
  human_prompts: 14
  usage:
    input_tokens: unknown
    output_tokens: unknown
    cost_note: "unknown"
  ai_generated_assets: ["card image: HTML and CSS written by the model and rendered by headless Chrome, no image generator", "code: all written by the model", "audio: none"]

runtime:
  kind: static-web
  stack: [HTML, CSS, "JavaScript ES modules"]
  start: "python3 -m http.server 8000"
  url_after_start: "http://localhost:8000"
  hosted_url: ""
  static_root: "."
  requires_install: false
  requires_network: false
  requires_api_key: false
  uses_ai_at_runtime: false
  browsers: ["Chrome 157 (headless)", "Playwright Chromium, headed and headless"]
  accessibility: "Subnet 2048 plays with arrow keys or WASD, on-screen buttons or swipes. Tiles have aria-labels with address and host count, and the move message is an aria-live region. Puzzle mode and the drill use native buttons. Keyboard play was tested with Playwright; no screen reader testing was done."
  save_state: "browser localStorage (best moves per Subnet 2048 level, best puzzle stars)"

verification:
  tests: "python3 tests/run.py && python3 tests/e2e.py && .venv-test/bin/python tests/playwright_test.py"
  tests_passing: 430
  facts_sourced_from: ["RFC 4632 (CIDR)", "RFC 3021 (31-bit prefixes on point-to-point links)", "RFC 1918 (private address ranges)"]
  known_limits: ["IPv4 only", "Subnet 2048 only models summarisation of aligned sibling blocks, not overlapping or non-contiguous routes", "new blocks are chosen by a helper that favours useful pieces, so the sequence is not uniformly random", "a deadlocked board is rare because of that helper, and the stuck state is covered by unit tests rather than reproduced in the browser", "ignores gateway, DHCP and cloud-provider reserved addresses", "puzzle-mode grids use a coarse unit, so prefixes finer than the grid cannot be placed", "ES modules need a local web server, so the page will not run from file://"]
---

## In one paragraph

Address Space Packer is a subnetting game for people learning CIDR and route summarisation. Its main mode is Subnet 2048: tiles are real subnets, and you slide them around a 4x4 board to merge them back into one parent block, for example 10.0.0.0/24. Two tiles merge only if they are siblings, the two halves of the same bigger block, so 10.0.0.0/28 and 10.0.0.16/28 become 10.0.0.0/27, but 10.0.0.16/28 and 10.0.0.32/28 do not. The game says why when equal-size neighbours refuse to merge. A placement puzzle with eight levels and a ten-question warm-up drill cover the same skills. There is no timer.

## How it was built

Built in one Claude Code session on 2026-11-09. The human asked for a subnetting game inspired by the arcade, and we reviewed the arcade page and the ARCADE.md template before choosing between four ideas. The human picked an address-packing puzzle first, then asked for a Tetris feel, so we built a falling-block mode with rotating bundles of subnets. Testing showed the blocks were too big, the pace too fast and the goal unclear, so the human asked for an existing popular game instead, and we replaced it with Subnet 2048. Subnet 2048 runs on pure rules in `js/merge-core.js`. A helper that favours useful new blocks was added after bots rarely won the larger levels. The spec files (constitution, spec, plan) were written after the first implementation and updated for each change, so this is lighter-touch spec-driven work than the template's framework assumes. Node was not installed, so unit and UI tests run in headless Chrome through small Python runners. A Playwright suite then drives the real game and compares every key press with an independent Python model built on the `ipaddress` module. It caught a flipped up/down axis early on, and it also caught slide animations being measured mid-motion.

## What we'd tell the next builder

- Test early with a real player. Our first two game designs were built and tested before the human found them too fast and unclear. Pick a familiar game before you start.
- Check that a visual metaphor does not break the facts. Rotating single subnets would have drawn blocks that are not real subnets.
- Test against an independent model, such as Python's `ipaddress` module, rather than the game's own functions, and measure win rates with a planning bot to tune difficulty.
