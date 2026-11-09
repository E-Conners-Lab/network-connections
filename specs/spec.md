# Specification: Network Connections

## Player and goal
Anyone learning or revising networking and network automation, including people at the AutoCon workshop. Find the four hidden groups of four related terms among 16 tiles.

## The puzzle
- A puzzle has an id, a title and exactly four groups. Each group has a name, four items, a one-line `why` and an `icon` chosen from the icon set.
- Groups are listed from easiest to hardest and shown in the colours yellow, green, blue and purple.
- All 16 items in a puzzle are different. Every item belongs to exactly one group.
- Eight puzzles ship in `data/puzzles.json`: Network Basics, Which Layer?, Automation Toolbox, DevOps for Networks, Security, Addresses and Delivery, Cables and Wi-Fi, Routing and Switching Deep Dive.

## Rules
1. The 16 tiles are shuffled. The player taps up to four tiles to select them. Tapping a selected tile deselects it. A fifth tile cannot be selected.
2. **Submit** is enabled only with exactly four tiles selected.
3. If the four tiles are exactly one group: the group is solved, shown as a colour banner with its name and items above the remaining tiles, and the selection clears.
4. Otherwise it is a mistake. If three of the four tiles belong to one unsolved group, the message says "One away". The player has four mistakes.
5. Submitting a set the player already tried shows "Already guessed" and costs nothing.
6. Four groups solved wins the puzzle. A fourth mistake loses it, and the remaining groups are revealed in order.
7. **Shuffle** reorders the remaining tiles and keeps the selection. **Deselect all** clears the selection.
8. Mistakes are shown as four dots that empty as they are used.

## After the puzzle
- A result card shows a shareable emoji grid (one row per guess, each tile as its group colour), the mistakes used, and the `why` line for every group.
- **Copy result** puts the text on the clipboard where the browser allows it, and falls back to showing it for manual copying.
- **Next puzzle** moves on. Results (won or lost, mistakes) are kept in localStorage and shown as marks on the puzzle picker. Any puzzle can be replayed.

## Screen and look (NOC dashboard)
- Dark by default with a faint grid background, and a light theme behind a toggle button that remembers the choice. Monospace for headings, labels and buttons, and for tiles on screens 480 px and wider. Narrow screens use the sans font for tiles so long terms fit. System fonts only, so the game stays offline.
- Header: the title, the goal line, and a topology graphic of four nodes joined by links, one node per group. A node lights in its group colour when that group is found, a link lights when both its nodes are lit, and "LINKS UP n/4" counts them.
- Group colours are status LEDs: amber, green, blue and violet. A solved group is a banner with an icon, its name and its items.
- The four mistake dots are "link health" LEDs: green when unused, red when spent.
- Controls: puzzle picker, tiles, the three buttons, and a console-style message line that is a live region.
- After a puzzle a "session report" card shows the reasons and the share text.
- Motion: tiles lift when selected, a solved banner slides in, the node pulses, a wrong guess shakes the grid and flashes the selection red, the spent LED blinks, and a win drops a burst of coloured packets. All of it is off when the user prefers reduced motion.
- Every text colour meets a 4.5:1 contrast ratio in both themes.

## Reproducibility
`?puzzle=N&seed=N` opens puzzle N with a fixed tile order, for tests and demos.

## Out of scope
Timers, accounts, leaderboards, a daily puzzle schedule, user-submitted puzzles, sound.
