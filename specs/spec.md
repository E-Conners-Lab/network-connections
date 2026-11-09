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

## Subnet 2048 (default)
- Goal: slide subnet tiles on a 4x4 board and merge them back into the whole parent block. There is no timer.
- A tile is a real subnet `{start, prefix}`. Two tiles merge only if they are siblings: same prefix, adjacent, and the lower one starts on a multiple of the parent's size. The merged tile has prefix - 1 (route summarisation).
- Sliding works as in 2048: tiles move to the edge, siblings that meet merge once per move. Equal-size non-siblings block each other, and the game says why.
- The parent block is split into a pool of tiles (equal /28 or /26 tiles, or a random mixed split). Two tiles start on the board and one more arrives after each move that changes it. At all times the board plus the pool tile the parent exactly.
- Arrivals favour useful pieces: usually a sibling of a tile on the board, placed on the same row or column, or a block inside a sibling's range. A planning bot must be able to win every level.
- Win: a single tile equals the parent. Stuck: the board is full with no possible move, or the pool is empty with no sibling pair. Undo, hint and restart are always available.
- Score is the sum of the sizes of merged blocks, and best moves per level are kept in localStorage.
- URL params `?level=N&seed=N` give reproducible runs.

## Levels (puzzle mode)
1 First Floor (/24 split), 2 Mind the Gap (alignment), 3 Point to Point (/30), 4 Tight Squeeze (exact fit), 5 Thrifty Links (/31),
6 Branch Roll-out (/22), 7 Brownfield (reserved blocks), 8 Campus Capstone (/20).
Every level must be solvable by sorting requests largest-first and placing first-fit. A test enforces this.

## Warm-up drill
Ten multiple-choice questions: usable hosts in a /N, or smallest prefix for N hosts.

## Out of scope
IPv6, supernetting and route summarisation, reserved gateway or DHCP ranges, vendor-specific rules (for example cloud providers reserving extra addresses).
