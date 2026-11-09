---
arcade_version: 1

game:
  title: "Address Space Packer"
  slug: address-space-packer
  tagline: "Pack the address space. Waste nothing."
  summary: "Subnets fall into a /24 like Tetris pieces. You resize each block to fit its host request, then rotate and drop it, and bundles of equal subnets arrive as L, T, S and Z shapes. Every block is a real aligned subnet, and oversized blocks fill the well. A separate puzzle mode and a warm-up drill cover the same skills."
  topics: [Subnetting, VLSM, CIDR, Block alignment, RFC 4632, RFC 3021]
  category: network-fundamentals
  skill_level: beginner
  play_minutes: 15
  levels: 8
  card_image: assets/images/title.png
  card_image_alt: "A colour-coded address bar split into /25, /26, /27 and /28 blocks under the title Address Space Packer."
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
  human_prompts: 10
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
  accessibility: "Arcade mode is keyboard-driven (arrows, A, S, Z, X, Space, P) with on-screen touch buttons, and the board is a canvas with no screen reader description of the falling pieces, so Arcade mode is not screen reader accessible. Puzzle mode and the drill use native buttons with aria-labels and an aria-live message area. Keyboard play was tested by Playwright; no screen reader testing was done."
  save_state: "browser localStorage (best puzzle stars per level, arcade best score)"

verification:
  tests: "python3 tests/run.py && python3 tests/e2e.py && .venv-test/bin/python tests/playwright_test.py"
  tests_passing: 204
  facts_sourced_from: ["RFC 4632 (CIDR)", "RFC 3021 (31-bit prefixes on point-to-point links)", "RFC 1918 (private address ranges)"]
  known_limits: ["bundles are groups of equal-size subnets, so oddly shaped pieces are a game mechanic and real subnets are never L-shaped", "the well uses a Z-order layout, so address order is not simply row by row", "only bundles change shape when rotated, single subnets are one square or rectangle", "arcade rounds are generated with a seeded random generator and are not guaranteed to be perfectly packable", "IPv4 only", "no supernetting or route summarisation", "ignores gateway, DHCP and cloud-provider reserved addresses", "level grids are capped at a coarse unit, so prefixes finer than the grid cannot be placed", "ES modules need a local web server, so the page will not run from file://"]
---

## In one paragraph

Address Space Packer is a subnetting game for people learning VLSM, and its main mode plays like Tetris. Subnets fall into a /24, you resize each one for its host request, rotate it and drop it. Some requests arrive as bundles ("four branches, 12 hosts each") that fall as L, T, S and Z shapes. Every block is a real, aligned subnet, and oversized blocks and gaps fill the well. A placement puzzle mode with eight levels and a ten-question warm-up drill cover the same skills at a slower pace. It suits anyone who can read a /24 but still counts on their fingers when asked for a /27.

## How it was built

Built in one Claude Code session on 2026-11-09. The human asked for a subnetting game inspired by the arcade, and we reviewed the arcade page and the ARCADE.md template before choosing between four ideas. The human picked the address-packing idea, and we first built a click-to-place puzzle with pure subnet logic, tests and eight levels. The human then asked for Tetris-style looks and feel, so we added a falling-block Arcade mode. Rotating individual subnets would have broken the link between position and address, so we moved the well to a Z-order layout where every aligned block is a compact rectangle, and made the odd Tetris shapes bundles of equal subnets. The spec files (constitution, spec, plan) were written after the first implementation and then updated for the arcade mode, so this is lighter-touch spec-driven work than the template's framework assumes. Node was not installed, so unit and UI tests run in headless Chrome through small Python runners, and a Playwright suite drives the real game and checks it against an independent Python model of the subnet maths, layout, rotation and gravity. That suite caught a favicon 404, and a wrong test assumption about growing a bundle past the well width.

## What we'd tell the next builder

- Keep the networking logic in a DOM-free module and test every level for solvability. It caught a real level-design bug that playing would have missed.
- Check that a visual metaphor does not break the facts. Per-piece rotation sounded easy, but a subnet must be contiguous, so we changed the layout instead of drawing wrong subnets.
- Test against an independent model, such as Python's `ipaddress` module, rather than re-using the game's own functions.
