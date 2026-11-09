// Subnet 2048 rules. Pure logic, no DOM.
// Tiles are real subnets: { id, start, prefix }. Slide them like 2048, but two tiles only merge when they are
// siblings: the two halves of the same parent block (same prefix, side by side, and the lower one starts on a
// multiple of the parent's size). Merging siblings is route summarisation, for example
// 10.0.0.0/28 + 10.0.0.16/28 = 10.0.0.0/27, while 10.0.0.16/28 + 10.0.0.32/28 cannot merge.
import { blockSize, parseCidr, intToIp, describeBlock, usableHosts } from './subnet.js';

export const N = 4;

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const cidrOf = (t) => `${intToIp(t.start)}/${t.prefix}`;

export function siblingStart(t) {
  const size = blockSize(t.prefix);
  return t.start % (size * 2) === 0 ? t.start + size : t.start - size;
}

export function areSiblings(a, b) {
  return a.prefix === b.prefix && b.start === siblingStart(a);
}

export function mergedOf(a, b) { return { start: Math.min(a.start, b.start), prefix: a.prefix - 1 }; }

// Levels: split `parent` into equal tiles of `tile` prefix, or into `count` random blocks no smaller than /minPrefix.
export const LEVELS = [
  { id: 1, title: 'Warm-up', parent: '10.0.0.0/26', tile: 28, brief: 'Four /28s make a /26. Merge siblings to rebuild it.' },
  { id: 2, title: 'Half a Class C', parent: '192.168.1.0/25', tile: 28, brief: 'Eight /28 blocks. Watch for equal-size neighbours that are not siblings.' },
  { id: 3, title: 'Full /24', parent: '172.16.0.0/24', tile: 28, brief: 'Sixteen /28 blocks, all the way up to a /24.' },
  { id: 4, title: 'Mixed Sizes', parent: '10.10.0.0/24', count: 12, minPrefix: 29, brief: 'Blocks of different sizes. Small ones must merge up before they can pair with bigger ones.' },
  { id: 5, title: 'Bigger Blocks', parent: '10.20.0.0/22', tile: 26, brief: 'Sixteen /26 blocks make a /22.' },
  { id: 6, title: 'Campus Summary', parent: '10.30.0.0/20', count: 14, minPrefix: 26, brief: 'A /20 split into uneven pieces. Summarise it back to one route.' },
];

export function makePool(level, rand) {
  const parent = parseCidr(level.parent);
  let blocks;
  if (level.tile) {
    const size = blockSize(level.tile);
    blocks = [];
    for (let s = parent.start; s < parent.start + parent.size; s += size) blocks.push({ start: s, prefix: level.tile });
  } else {
    blocks = [{ start: parent.start, prefix: parent.prefix }];
    while (blocks.length < level.count) {
      const splittable = blocks.map((b, i) => i).filter((i) => blocks[i].prefix < level.minPrefix);
      const i = splittable[Math.floor(rand() * splittable.length)];
      const b = blocks[i], half = blockSize(b.prefix + 1);
      blocks.splice(i, 1, { start: b.start, prefix: b.prefix + 1 }, { start: b.start + half, prefix: b.prefix + 1 });
    }
  }
  for (let i = blocks.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [blocks[i], blocks[j]] = [blocks[j], blocks[i]]; }
  return blocks;
}

export function newGame(levelIdx = 0, seed = 1) {
  const level = LEVELS[levelIdx];
  const g = { levelIdx, level, rand: rng(seed * 1000 + level.id), parent: parseCidr(level.parent), board: new Array(N * N).fill(null),
    pool: [], score: 0, moves: 0, won: false, lost: false, nextId: 1, msg: '', history: [] };
  g.pool = makePool(level, g.rand);
  spawn(g); spawn(g);
  g.msg = `Goal: merge everything back into ${level.parent}.`;
  return g;
}

// Pick the next tile from the pool. Most of the time prefer blocks that help finish something already on the board:
// first an exact sibling of a tile on the board, then a block lying inside such a sibling's address range.
// This keeps every level winnable without making it trivial: you still have to line the pieces up.
export const HELP = 0.85;
function pickFromPool(g) {
  const onBoard = g.board.filter(Boolean);
  const score = (p) => {
    let best = 0;
    for (const b of onBoard) {
      if (areSiblings(b, p)) return 2;
      const sib = siblingStart(b), size = blockSize(b.prefix);
      if (p.prefix > b.prefix && p.start >= sib && p.start < sib + size) best = 1;
    }
    return best;
  };
  if (g.rand() >= HELP) return 0;
  const scores = g.pool.map(score), top = Math.max(...scores);
  if (top === 0) return 0;
  const picks = scores.map((v, i) => (v === top ? i : -1)).filter((i) => i >= 0);
  return picks[Math.floor(g.rand() * picks.length)];
}

export function spawn(g) {
  if (!g.pool.length) return false;
  const empty = g.board.map((t, i) => (t ? -1 : i)).filter((i) => i >= 0);
  if (!empty.length) return false;
  const [t] = g.pool.splice(pickFromPool(g), 1);
  // If its sibling is on the board, usually drop it on the same row or column so the pair can meet.
  let cells = empty;
  const sibCell = g.board.findIndex((b) => b && areSiblings(b, t));
  if (sibCell >= 0 && g.rand() < HELP) {
    const same = empty.filter((i) => Math.floor(i / N) === Math.floor(sibCell / N) || i % N === sibCell % N);
    if (same.length) cells = same;
  }
  g.board[cells[Math.floor(g.rand() * cells.length)]] = { id: g.nextId++, start: t.start, prefix: t.prefix };
  return true;
}

// Cell indices of each line, ordered from the edge the tiles slide toward.
function lines(dir) {
  const out = [];
  for (let k = 0; k < N; k++) {
    const idx = [];
    for (let m = 0; m < N; m++) {
      const j = dir === 'left' || dir === 'up' ? m : N - 1 - m;
      idx.push(dir === 'left' || dir === 'right' ? k * N + j : j * N + k);
    }
    out.push(idx);
  }
  return out;
}

// Pure slide: returns the new board plus what happened. Does not spawn.
export function slide(board, dir) {
  const next = new Array(N * N).fill(null);
  const merges = [], blocked = [];
  for (const idx of lines(dir)) {
    const tiles = idx.map((i) => ({ i, t: board[i] })).filter((x) => x.t);
    const out = [];
    for (let k = 0; k < tiles.length; k++) {
      const a = tiles[k], b = tiles[k + 1];
      if (b && areSiblings(a.t, b.t)) {
        out.push({ tile: { ...mergedOf(a.t, b.t) }, from: [a.t, b.t] });
        k++;
      } else {
        if (b && a.t.prefix === b.t.prefix) blocked.push([a.t, b.t]);
        out.push({ tile: a.t, from: null });
      }
    }
    out.forEach((o, m) => {
      if (o.from) merges.push({ a: o.from[0], b: o.from[1], result: o.tile, cell: idx[m] });
      next[idx[m]] = o.tile;
    });
  }
  const moved = next.some((t, i) => (t ? !board[i] || board[i].id !== t.id : !!board[i])) || merges.length > 0;
  return { board: next, merges, blocked, moved };
}

export function hasSiblingPair(g) {
  const ts = g.board.filter(Boolean);
  return ts.some((a) => ts.some((b) => areSiblings(a, b)));
}

export function canMove(g) {
  return ['left', 'right', 'up', 'down'].some((d) => slide(g.board, d).moved);
}

export function move(g, dir) {
  if (g.won || g.lost) return { moved: false };
  const r = slide(g.board, dir);
  if (!r.moved) { g.msg = 'Nothing slides that way.'; return { moved: false, merges: [], blocked: [] }; }
  g.history.push({ board: g.board.map((t) => t && { ...t }), pool: g.pool.map((t) => ({ ...t })), score: g.score, moves: g.moves, nextId: g.nextId, won: g.won, lost: g.lost });
  g.board = r.board.map((t) => t && { id: t.id || 0, start: t.start, prefix: t.prefix });
  r.merges.forEach((m) => {
    const t = g.board[m.cell]; t.id = g.nextId++;
    g.score += blockSize(t.prefix);
  });
  g.moves++;
  const lines2 = r.merges.map((m) => `${cidrOf(m.a)} + ${cidrOf(m.b)} = ${cidrOf(m.result)}`);
  const why = r.blocked.length
    ? `${cidrOf(r.blocked[0][0])} and ${cidrOf(r.blocked[0][1])} are the same size but not siblings: a /${r.blocked[0][0].prefix - 1} must start on a multiple of ${blockSize(r.blocked[0][0].prefix - 1)}.`
    : '';
  g.msg = [lines2.join('. '), why].filter(Boolean).join(' ') || 'Slid.';
  spawn(g);
  checkEnd(g);
  return { moved: true, merges: r.merges, blocked: r.blocked };
}

// Win when the whole parent is one tile. Lost when nothing can ever merge again.
export function checkEnd(g) {
  const parentTile = g.board.find((t) => t && t.prefix === g.parent.prefix && t.start === g.parent.start);
  if (parentTile) { g.won = true; g.msg = `You rebuilt ${g.level.parent} in ${g.moves} moves.`; return; }
  const full = g.board.every(Boolean);
  if (full ? !canMove(g) : (!g.pool.length && !hasSiblingPair(g))) { g.lost = true; g.msg = 'No more merges are possible. Undo or restart.'; }
}

export function undo(g) {
  const h = g.history.pop(); if (!h) return false;
  Object.assign(g, { board: h.board, pool: h.pool, score: h.score, moves: h.moves, nextId: h.nextId, won: h.won, lost: h.lost, msg: 'Undone.' });
  return true;
}

// A sibling pair currently on the board, for the Hint button.
export function hint(g) {
  const ts = g.board.map((t, i) => t && { ...t, cell: i }).filter(Boolean);
  for (const a of ts) for (const b of ts) if (a.id < b.id && areSiblings(a, b)) return [a, b];
  return null;
}

export function describe(t) {
  const d = describeBlock(t.start, t.prefix);
  return { cidr: d.cidr, hosts: usableHosts(t.prefix), range: `${d.network} - ${d.broadcast}` };
}
