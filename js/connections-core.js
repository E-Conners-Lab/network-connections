// Network Connections rules. Pure logic, no DOM.
export const MAX_MISTAKES = 4;
export const COLOURS = ['yellow', 'green', 'blue', 'purple'];
export const EMOJI = ['\u{1F7E8}', '\u{1F7E9}', '\u{1F7E6}', '\u{1F7EA}'];

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Returns a list of problems. An empty list means the puzzle is valid.
export function validatePuzzle(p) {
  const errs = [];
  if (!p || typeof p !== 'object') return ['puzzle is not an object'];
  if (!Number.isInteger(p.id)) errs.push('id must be an integer');
  if (typeof p.title !== 'string' || !p.title.trim()) errs.push('title is required');
  if (!Array.isArray(p.groups) || p.groups.length !== 4) { errs.push('exactly 4 groups are required'); return errs; }
  const seen = new Map();
  p.groups.forEach((g, gi) => {
    if (typeof g.name !== 'string' || !g.name.trim()) errs.push(`group ${gi + 1}: name is required`);
    if (typeof g.why !== 'string' || !g.why.trim()) errs.push(`group ${gi + 1}: why is required`);
    if (g.icon !== undefined && typeof g.icon !== 'string') errs.push(`group ${gi + 1}: icon must be a string`);
    if (!Array.isArray(g.items) || g.items.length !== 4) { errs.push(`group ${gi + 1}: exactly 4 items are required`); return; }
    g.items.forEach((it) => {
      if (typeof it !== 'string' || !it.trim()) { errs.push(`group ${gi + 1}: empty item`); return; }
      const key = it.trim().toLowerCase();
      if (seen.has(key)) errs.push(`"${it}" appears in group ${seen.get(key) + 1} and group ${gi + 1}`);
      else seen.set(key, gi);
    });
  });
  return errs;
}

function shuffled(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function newGame(puzzle, rand = Math.random) {
  const errs = validatePuzzle(puzzle);
  if (errs.length) throw new Error('invalid puzzle: ' + errs.join('; '));
  const groupOf = new Map();
  puzzle.groups.forEach((g, gi) => g.items.forEach((it) => groupOf.set(it, gi)));
  return {
    puzzle, groupOf, rand,
    tiles: shuffled([...groupOf.keys()], rand),   // tiles still in play
    selected: [], solved: [],                      // solved = group indexes in the order found
    mistakes: 0, guesses: [],                      // guesses = arrays of group indexes, one per tile
    tried: new Set(), won: false, lost: false, revealed: [], msg: '',
  };
}

export function toggle(g, item) {
  if (g.won || g.lost || !g.tiles.includes(item)) return false;
  const i = g.selected.indexOf(item);
  if (i >= 0) { g.selected.splice(i, 1); return true; }
  if (g.selected.length >= 4) return false;
  g.selected.push(item);
  return true;
}

export function deselectAll(g) { g.selected = []; }

// Reorder the tiles still in play. The current selection is kept.
export function shuffle(g) { g.tiles = shuffled(g.tiles, g.rand); }

// Result types: 'incomplete' | 'duplicate' | 'correct' | 'one-away' | 'wrong'
export function submit(g) {
  if (g.won || g.lost) return { type: 'over' };
  if (g.selected.length !== 4) { g.msg = 'Pick four tiles first.'; return { type: 'incomplete' }; }
  const key = g.selected.slice().sort().join('\u0000');
  if (g.tried.has(key)) { g.msg = 'Already guessed that one.'; return { type: 'duplicate' }; }
  g.tried.add(key);
  const groups = g.selected.map((it) => g.groupOf.get(it));
  g.guesses.push(groups);
  const counts = new Map();
  groups.forEach((gi) => counts.set(gi, (counts.get(gi) || 0) + 1));
  const [top, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (n === 4) {
    g.solved.push(top);
    g.tiles = g.tiles.filter((it) => g.groupOf.get(it) !== top);
    g.selected = [];
    g.msg = `Correct: ${g.puzzle.groups[top].name}.`;
    if (g.solved.length === 4) { g.won = true; g.msg = 'You found all four groups!'; }
    return { type: 'correct', group: top };
  }
  g.mistakes++;
  const oneAway = n === 3;
  g.msg = oneAway ? 'One away!' : 'Not quite.';
  if (g.mistakes >= MAX_MISTAKES) {
    g.lost = true;
    g.revealed = [0, 1, 2, 3].filter((gi) => !g.solved.includes(gi));
    g.msg = 'Out of mistakes. Here are the groups.';
  }
  return { type: oneAway ? 'one-away' : 'wrong' };
}

export function mistakesLeft(g) { return MAX_MISTAKES - g.mistakes; }

// Shareable result, one row of colour squares per guess.
export function shareText(g) {
  const head = `Network Connections #${g.puzzle.id} ${g.puzzle.title}`;
  const rows = g.guesses.map((row) => row.map((gi) => EMOJI[gi]).join(''));
  const outcome = g.won ? `Solved with ${g.mistakes} mistake${g.mistakes === 1 ? '' : 's'}` : 'Not solved';
  return [head, outcome, ...rows].join('\n');
}
