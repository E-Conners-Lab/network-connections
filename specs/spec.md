# Specification: Address Space Packer

## Player and goal
Network learners (beginner to intermediate). Fit a list of host requests into a parent IPv4 block with the least waste.

## Rules
- A request is a name and a host count. Kind `lan` needs network and broadcast addresses (usable = 2^(32-p) - 2; /31 and /32 are unusable).
  Kind `link` is point-to-point; a /31 gives 2 usable addresses (RFC 3021) and a /30 gives 2.
- The player chooses a prefix, then clicks a start square on the map.
- Rejected, with an explanation and a mistake (-10 points): too few usable addresses; start not on a multiple of the block size; runs past the parent; overlaps another block.
- Accepted but scored lower if oversized: exact size 100 points, one size too big 50, two or more 20. Wasted addresses are reported.
- After each placement the game warns if any remaining request can no longer fit. Undo and Reset are always available.
- Level complete when all requests are placed. Stars: 3 at 90% or more, 2 at 60% or more, otherwise 1. Best stars are kept in localStorage.

## Arcade mode (default)
- The well is 16 x 16 cells holding one /24, one cell per address, laid out along a Z-order curve: address = base + morton(x, y).
  Every aligned power-of-two block is therefore a rectangle: /30 2x2, /29 4x2, /28 4x4, /27 8x4, /26 8x8, /25 16x8, /24 16x16.
- A request is either one subnet or a bundle of equal-size subnets (domino, I, O, T, L, J, S, Z). Every cell needs the same host count and is its own subnet, so a bundle can be rotated freely.
- Pieces move in steps of one cell width, fall in steps of one cell height, and so always land on a legal boundary. Arrow up or X rotates, Z rotates back, A and S change the prefix, Space hard-drops.
- A block that is too small cannot lock (one mistake, -10). An oversized block locks and wastes space. Perfect 100 per subnet, one size too big 50, more 20, plus one point per row dropped. Clearing a round gives 200 and starts a faster round with a new /24.
- The game ends when the next piece cannot spawn.
- Reproducible runs: `?seed=N` fixes the random requests and `?tick=ms` overrides gravity speed.

## Levels (puzzle mode)
1 First Floor (/24 split), 2 Mind the Gap (alignment), 3 Point to Point (/30), 4 Tight Squeeze (exact fit), 5 Thrifty Links (/31),
6 Branch Roll-out (/22), 7 Brownfield (reserved blocks), 8 Campus Capstone (/20).
Every level must be solvable by sorting requests largest-first and placing first-fit. A test enforces this.

## Warm-up drill
Ten multiple-choice questions: usable hosts in a /N, or smallest prefix for N hosts.

## Out of scope
IPv6, supernetting and route summarisation, reserved gateway or DHCP ranges, vendor-specific rules (for example cloud providers reserving extra addresses).
