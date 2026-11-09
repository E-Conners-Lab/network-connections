# Constitution

1. **Light and quick.** One puzzle takes about three minutes. A new player understands the goal in five seconds: find four groups of four.
2. **Phone first.** Every control is a tap. No keyboard, hover or drag is required. Tap targets are at least 44 px, and the page never scrolls sideways.
3. **Correct content beats clever content.** Every term belongs to exactly one group by the group's stated definition. A group that experts would argue about is rewritten or dropped.
4. **Teach, don't just score.** At the end of every puzzle each group shows a one-line reason, win or lose.
5. **Static and offline.** HTML, CSS and ES modules, plus one JSON file of puzzles. No build step, no dependencies, no network, no API key, no tracking.
6. **Data is separate from code.** Puzzles live in `data/puzzles.json` so anyone can add or fix one without touching JavaScript. A validator rejects a malformed puzzle.
7. **Test against an independent model.** Browser tests read the same JSON with a separate implementation and check what the screen actually shows.
