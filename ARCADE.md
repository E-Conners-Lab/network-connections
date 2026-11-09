---
arcade_version: 1

game:
  title: "Address Space Packer"
  slug: address-space-packer
  tagline: "Pack the address space. Waste nothing."
  summary: "You are given a parent IPv4 block and a list of team requests, and you pick the smallest prefix for each and place it on an address map. Blocks must sit on their own size boundary and cannot overlap, so the order you plan in matters. You learn CIDR, VLSM, block alignment and RFC 3021 point-to-point links."
  topics: [Subnetting, VLSM, CIDR, RFC 4632, RFC 3021]
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
  other_tools: ["Google Chrome 157 headless (tests, screenshots, card image render)", "Python 3 http.server", "gh CLI"]
  human_prompts: 3
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
  browsers: ["Chrome 157 (headless)"]
  accessibility: "Controls are native buttons with aria-labels on map squares and an aria-live message area, and animation respects prefers-reduced-motion. No manual keyboard-only or screen reader testing was done."
  save_state: "browser localStorage (best stars per level)"

verification:
  tests: "python3 tests/run.py && python3 tests/e2e.py"
  tests_passing: 30
  facts_sourced_from: ["RFC 4632 (CIDR)", "RFC 3021 (31-bit prefixes on point-to-point links)", "RFC 1918 (private address ranges)"]
  known_limits: ["IPv4 only", "no supernetting or route summarisation", "ignores gateway, DHCP and cloud-provider reserved addresses", "level grids are capped at a coarse unit, so prefixes finer than the grid cannot be placed", "ES modules need a local web server, so the page will not run from file://"]
---

## In one paragraph

Address Space Packer is a subnetting puzzle for people learning VLSM. Each level gives you a parent block and a list of requests such as "Sales needs 100 hosts". You choose the smallest prefix that fits, then place it on a map of the address space. The game enforces the rules a router would: usable-host counts, power-of-two alignment and no overlaps. It suits anyone who can read a /24 but still counts on their fingers when asked for a /27. A ten-question warm-up drill covers usable-host maths.

## How it was built

Built in one Claude Code session on 2026-11-09. The human asked for a subnetting game inspired by the arcade, and we reviewed the arcade page and the ARCADE.md template before choosing between four ideas. The human picked the address-packing idea, and we built the pure subnet logic and level data first, then the UI. The spec files (constitution, spec, plan) were written after the first working implementation, as a record of its rules, rather than ahead of it, so this is lighter-touch spec-driven work than the template's framework assumes. Node was not installed, so tests run in headless Chrome through small Python runners. One test failure was real: Level 3's links were tagged as RFC 3021 links, so their best answer was /31, finer than the level's grid. We changed them to ordinary two-host requests. Two further failures were wrong test expectations, not game bugs.

## What we'd tell the next builder

- Keep the networking logic in a DOM-free module and test every level for solvability. It caught a real level-design bug that playing would have missed.
- Choose each level's grid unit no coarser than its smallest correct block, or the player cannot place the right answer.
- If Node is missing, headless Chrome with `--dump-dom` is enough to run a browser-based test page.
