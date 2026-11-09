// Falling-block ("Tetris-style") rules. Pure logic, no DOM.
//
// Layout: the well is a 16 x 16 grid holding one /24. Cells are laid out along a Z-order (Morton) curve,
// so address = base + morton(x, y), where x bits fill the even address bits and y bits the odd ones.
// That makes every aligned power-of-two block a compact rectangle: /30 is 2x2, /29 is 4x2, /28 is 4x4,
// /27 is 8x4, /26 is 8x8, /25 is 16x8, /24 is 16x16. Each of those is a real, contiguous, aligned subnet.
//
// A piece is one or more equal-size subnets arranged in a Tetris shape. A single request is one cell.
// A bundle request ("four branches, 12 hosts each") is several cells; every cell is its own subnet, so the
// bundle can be rotated freely. Pieces move in steps of one cell width and fall in steps of one cell height,
// which keeps every landed block on a legal subnet boundary.
import { usableHosts, prefixForHosts, ipToInt, intToIp, describeBlock } from './subnet.js';

export const W = 16;
export const H = 16;
export const MIN_PREFIX = 24;
export const MAX_PREFIX = 30;

export function morton(x, y) {
  let a = 0;
  for (let i = 0; i < 4; i++) { a |= ((x >> i) & 1) << (2 * i); a |= ((y >> i) & 1) << (2 * i + 1); }
  return a;
}

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Cell offsets in cell units (i = right, j = up).
export const SHAPES = {
  single: [[0, 0]],
  domino: [[0, 0], [1, 0]],
  I: [[0, 0], [1, 0], [2, 0], [3, 0]],
  O: [[0, 0], [1, 0], [0, 1], [1, 1]],
  T: [[0, 0], [1, 0], [2, 0], [1, 1]],
  L: [[0, 0], [1, 0], [2, 0], [2, 1]],
  J: [[0, 0], [1, 0], [2, 0], [0, 1]],
  S: [[0, 0], [1, 0], [1, 1], [2, 1]],
  Z: [[0, 1], [1, 1], [1, 0], [2, 0]],
};
const BUNDLE_SHAPES = ['domino', 'I', 'O', 'T', 'L', 'J', 'S', 'Z'];

function normalise(cells) {
  const mi = Math.min(...cells.map((c) => c[0])), mj = Math.min(...cells.map((c) => c[1]));
  return cells.map(([i, j]) => [i - mi, j - mj]);
}
export const rotateCW = (cells) => normalise(cells.map(([i, j]) => [j, -i]));
export const rotateCCW = (cells) => normalise(cells.map(([i, j]) => [-j, i]));

const NAMES = ['Sales', 'Voice', 'Guest Wi-Fi', 'Servers', 'Labs', 'Cameras', 'Printers', 'Engineering', 'Finance', 'HR',
  'Wireless', 'Badge Readers', 'IoT', 'Management', 'DMZ', 'Backup', 'Support', 'Marketing', 'Facilities', 'Library'];
const BUNDLE_NAMES = ['Branch', 'Floor', 'Site', 'Pod', 'Wing', 'Depot'];

// Generate the requests for a round. Every cell of a request needs the same number of hosts.
export function makeRound(round, rand) {
  const budget = Math.floor(Math.min(0.5 + round * 0.05, 0.8) * W * H);
  const bundleP = Math.min(0.2 + round * 0.05, 0.4);
  const reqs = [];
  let total = 0, misses = 0;
  while (misses < 8) {
    const bundle = rand() < bundleP;
    const sizes = bundle ? [4, 8, 16] : [4, 8, 16, 32, 64].slice(0, Math.min(5, 2 + round));
    const s = sizes[Math.floor(rand() * sizes.length)];
    const shapeId = bundle ? BUNDLE_SHAPES[Math.floor(rand() * BUNDLE_SHAPES.length)] : 'single';
    const cells = SHAPES[shapeId];
    if (total + s * cells.length > budget) { misses++; continue; }
    const hosts = s / 2 - 1 + Math.floor(rand() * (s / 2)); // s/2-1 .. s-2, so each block must be exactly s
    let name, names;
    if (bundle) {
      const base = BUNDLE_NAMES[(reqs.length + round) % BUNDLE_NAMES.length];
      names = cells.map((_, i) => `${base} ${String.fromCharCode(65 + i)}`);
      name = `${base} x${cells.length}`;
    } else {
      name = NAMES[(reqs.length * 7 + round * 3) % NAMES.length]; names = [name];
    }
    reqs.push({ name, names, hosts, size: s, shape: shapeId, cells: cells.map((c) => c.slice()) });
    total += s * cells.length;
  }
  return reqs;
}

// Dimensions of one cell for a prefix.
export function shape(prefix) {
  const k = 32 - prefix;
  const w = 2 ** Math.ceil(k / 2), h = 2 ** Math.floor(k / 2);
  return { prefix, size: 2 ** k, w, h };
}

export function extent(cells) {
  return { cols: Math.max(...cells.map((c) => c[0])) + 1, rows: Math.max(...cells.map((c) => c[1])) + 1 };
}

function makePiece(req, prefix, x, y) { return { ...shape(prefix), cells: req.cells.map((c) => c.slice()), shape: req.shape, x, y, warned: false }; }

export function cellOrigins(p, x = p.x, y = p.y) { return p.cells.map(([i, j]) => ({ x: x + i * p.w, y: y + j * p.h })); }

export function collides(g, p, x = p.x, y = p.y) {
  for (const o of cellOrigins(p, x, y)) {
    if (o.x < 0 || o.y < 0 || o.x + p.w > W || o.y + p.h > H) return true;
    for (let r = o.y; r < o.y + p.h; r++) for (let c = o.x; c < o.x + p.w; c++) if (g.grid[r][c]) return true;
  }
  return false;
}

export function newGame(seed = 1) {
  const g = { rand: rng(seed), round: 1, score: 0, mistakes: 0, over: false, roundDone: false, msg: '', allocations: [], blocks: [], nextId: 0 };
  startRound(g);
  return g;
}

export function baseAddress(g) { return ipToInt(`10.${g.round}.0.0`); }

export function startRound(g) {
  g.grid = Array.from({ length: H }, () => Array(W).fill(0));
  g.reqs = makeRound(g.round, g.rand);
  g.idx = 0; g.roundDone = false; g.allocations = []; g.blocks = []; g.nextId = 0;
  g.msg = `Round ${g.round}: ${g.reqs.length} requests for 10.${g.round}.0.0/24.`;
  spawn(g);
}

export function nextRound(g) { g.round++; startRound(g); }

function spawn(g) {
  const req = g.reqs[g.idx];
  const p = makePiece(req, 28, 0, 0);
  p.y = H - extent(p.cells).rows * p.h;
  if (collides(g, p)) { g.over = true; g.piece = null; g.msg = 'The well is full. Game over.'; return; }
  g.piece = p;
}

export function respawn(g) { spawn(g); }

export function currentRequest(g) { return g.reqs[g.idx]; }

export function move(g, dir) {
  const p = g.piece; if (!p || g.over) return false;
  const nx = p.x + dir * p.w;
  if (collides(g, p, nx)) return false;
  p.x = nx; return true;
}

// dir +1 = clockwise, -1 = counter-clockwise. Tries small shifts ("kicks") when the turn would hit a wall or the stack.
export function rotate(g, dir) {
  const p = g.piece; if (!p || g.over) return false;
  const cells = dir > 0 ? rotateCW(p.cells) : rotateCCW(p.cells);
  const q = { ...p, cells };
  for (const dy of [0, -1, 1, -2, 2]) {
    for (const dx of [0, -1, 1, -2, 2, -3, 3]) {
      const x = p.x + dx * p.w, y = p.y + dy * p.h;
      if (y < 0) continue;
      if (!collides(g, q, x, y)) { p.cells = cells; p.x = x; p.y = y; return true; }
    }
  }
  return false;
}

// delta +1 = bigger blocks (shorter prefix), -1 = smaller blocks.
export function resize(g, delta) {
  const p = g.piece; if (!p || g.over) return false;
  const prefix = p.prefix - delta;
  if (prefix < MIN_PREFIX || prefix > MAX_PREFIX) return false;
  const q = { ...p, ...shape(prefix) };
  const x0 = Math.floor(p.x / q.w) * q.w, y0 = Math.floor(p.y / q.h) * q.h;
  const ys = [];
  for (let k = 0; k <= H / q.h; k++) { ys.push(y0 + k * q.h); if (k) ys.push(y0 - k * q.h); }
  for (let k = 0; k <= W / q.w; k++) {
    const x = x0 - k * q.w;
    for (const y of ys) {
      if (y < 0) continue;
      if (!collides(g, q, x, y)) { Object.assign(p, shape(prefix), { x, y }); return true; }
    }
  }
  return false;
}

export function landingY(g) {
  const p = g.piece; let y = p.y;
  while (y - p.h >= 0 && !collides(g, p, p.x, y - p.h)) y -= p.h;
  return y;
}

// One gravity tick. Returns 'moved', 'locked', 'blocked' (landed but the size is wrong), or 'idle'.
export function step(g) {
  const p = g.piece; if (!p || g.over) return 'idle';
  if (p.y - p.h >= 0 && !collides(g, p, p.x, p.y - p.h)) { p.y -= p.h; return 'moved'; }
  return tryLock(g);
}

export function hardDrop(g) {
  const p = g.piece; if (!p || g.over) return 'idle';
  const rows = p.y - landingY(g);
  p.y -= rows;
  g.score += rows;
  return tryLock(g);
}

function tryLock(g) {
  const p = g.piece, req = currentRequest(g);
  const u = usableHosts(p.prefix);
  const multi = p.cells.length > 1;
  if (u < req.hosts) {
    if (!p.warned) { p.warned = true; g.mistakes++; g.score = Math.max(0, g.score - 10); }
    g.msg = `A /${p.prefix} has ${u} usable addresses, but ${req.name} needs ${req.hosts}${multi ? ' each' : ''}. Press A to grow it.`;
    return 'blocked';
  }
  const best = prefixForHosts(req.hosts);
  const diff = best - p.prefix;
  const origins = cellOrigins(p);
  const placed = origins.map((o, k) => {
    const start = baseAddress(g) + morton(o.x, o.y);
    if (start % p.size !== 0) throw new Error('internal: misaligned lock'); // physics should make this impossible
    return { o, k, start };
  });
  placed.forEach(({ o, k, start }) => {
    const id = ++g.nextId;
    for (let r = o.y; r < o.y + p.h; r++) for (let c = o.x; c < o.x + p.w; c++) g.grid[r][c] = id;
    g.blocks.push({ id, group: g.idx, x: o.x, y: o.y, w: p.w, h: p.h, prefix: p.prefix, name: req.names[k] });
    g.score += diff === 0 ? 100 : diff === 1 ? 50 : 20;
  });
  placed.slice().sort((a, b) => a.start - b.start).forEach(({ k, start }) => {
    g.allocations.push({ name: req.names[k], cidr: describeBlock(start, p.prefix).cidr, hosts: req.hosts, usable: u, perfect: diff === 0 });
  });
  const cidrs = placed.map((x) => describeBlock(x.start, p.prefix).cidr);
  const label = multi ? `${req.name} (${cidrs.length} blocks)` : `${cidrs[0]} for ${req.name}`;
  g.msg = diff === 0 ? `${label}. Right-sized.` : `${label}. A /${best} was enough, so ${(u - req.hosts) * placed.length} addresses are wasted.`;
  g.idx++;
  if (g.idx >= g.reqs.length) { g.piece = null; g.roundDone = true; g.score += 200; g.msg = `Round ${g.round} clear! +200`; return 'locked'; }
  spawn(g);
  return 'locked';
}

export function intervalMs(round) { return Math.max(110, 650 - (round - 1) * 80); }
export { intToIp };
