---
arcade_version: 1

game:
  title: "Network Connections"
  slug: network-connections
  tagline: "Find four groups of four in networking and automation terms."
  summary: "Sixteen tiles hide four groups of four related terms, such as routing protocols or TCP flags. You tap four at a time, with four mistakes allowed and a one-away hint, and every group is explained at the end. Eight puzzles cover networking basics, layers, automation tools, DevOps, security, addressing, cabling and routing internals."
  topics: [Networking basics, OSI layers, Network automation, Routing, Security]
  category: network-fundamentals
  skill_level: beginner
  play_minutes: 10
  levels: 8
  card_image: assets/images/title.png
  card_image_alt: "A dark network-console style screen with glowing amber and green group banners listing routing protocols and TCP flags, above a topology of four linked nodes, under the title Network Connections."
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
  other_tools: ["Playwright 1.64.1 for Python with Playwright Chromium (desktop and phone-size touch tests, video)", "pip-audit (no known vulnerabilities reported in the test venv)", "Google Chrome 157 headless (unit test page, screenshots, card image render)", "Python 3 http.server", "gh CLI"]
  human_prompts: 22
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
  browsers: ["Chrome 157 (headless)", "Playwright Chromium, desktop and emulated 390x844 and 320x568 touch screens"]
  accessibility: "Tiles and buttons are native buttons with aria-pressed, a live region announces results, and keyboard focus stays on a tile after it is selected. Tap targets are at least 44px, text colours reach 4.5:1 contrast in both the dark and light themes, and all animation and the win burst are turned off for prefers-reduced-motion. Keyboard play, phone-size layouts, contrast and reduced motion were tested with Playwright; no screen reader and no real phone or Safari testing was done."
  save_state: "browser localStorage (solved or not per puzzle, and the chosen theme)"

verification:
  tests: "python3 tests/run.py && .venv-test/bin/python tests/playwright_test.py"
  tests_passing: 181
  facts_sourced_from: ["model knowledge only, not checked against RFCs or vendor documents during the session"]
  known_limits: ["the puzzle content has not been reviewed by a networking expert and should be before the workshop", "some groupings are conventional and could be argued, for example Ansible as configuration management and Terraform as provisioning", "eight fixed puzzles, with no daily schedule or generator", "phone testing used Chromium touch emulation, not real devices or Safari", "ES modules and the puzzle file need a local web server, so the page will not run from file://"]
---

## In one paragraph

Network Connections is a quick word puzzle for networking and network-automation people, built to play on a phone. Sixteen tiles hide four groups of four related terms, such as routing protocols (OSPF, BGP, EIGRP, RIP) or TCP flags (SYN, ACK, FIN, RST). You tap four tiles and submit, with four mistakes allowed and a "One away!" nudge. When you finish, each group shows a one-line reason, and you can copy an emoji result to share. It suits anyone from a first-week network engineer to a veteran who wants a three-minute break. There is no timer, login or install.

## How it was built

Built in one Claude Code session on 2026-11-09. The human asked for a network engineering game inspired by the arcade, leaning towards subnetting. We built a subnet puzzle, then a Tetris-style mode, then a 2048-style mode. Testing and feedback found each one too fast, too complicated or unclear, so the human asked to leave subnetting and pick a light topic that works on a phone. We chose the Connections word-puzzle format and rebuilt from scratch, this time writing the constitution, spec and plan before any code. The puzzles live in a JSON file, and a validator checks them in the game and in the tests. After a first plain version the human asked for a less basic look, and we restyled it as a network-operations dashboard with a topology header, link-health LEDs, icons and motion. Fonts are system fonts only so it works offline. Node was not installed, so unit tests run in headless Chrome through a small Python runner. Playwright then plays every puzzle through the real UI on desktop and phone-sized touch screens, with the puzzle data checked by a separate Python implementation. It found a real keyboard bug, where focus was lost after each tap, and a layout flaw, where words such as "Acknowledge" split mid-word on small phones. The puzzle facts came from the model's own knowledge and have not been reviewed by a networking expert.

## What we'd tell the next builder

- Try a familiar game format before inventing rules. Three earlier designs were rebuilt because players had to learn the rules first.
- Keep content in a data file with a validator, and have the tests read it independently, so anyone can add a puzzle safely.
- Test on phone-sized touch screens early, and check for sideways scrolling, tap size and split words, not just that it runs.
- Have a networking expert review the puzzle content before it goes in front of an audience.
