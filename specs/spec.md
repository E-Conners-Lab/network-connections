# Specification: Network Connections

## Player and goal
Anyone learning or revising networking and network automation, including people at the AutoCon workshop. Find the four hidden groups of four related terms among 16 tiles.

## The puzzle
- A puzzle has an id, a title and exactly four groups. Each group has a name, four items and a one-line `why`.
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

## Screen
- Title, a one-line goal ("Find four groups of four. Four mistakes allowed."), the puzzle picker, solved banners, the tile grid, mistake dots, the three buttons, and a message line that is a live region.
- Dark and light themes, reduced-motion friendly.

## Reproducibility
`?puzzle=N&seed=N` opens puzzle N with a fixed tile order, for tests and demos.

## Out of scope
Timers, accounts, leaderboards, a daily puzzle schedule, user-submitted puzzles, sound.
