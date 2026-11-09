import { W, H, newGame, nextRound, currentRequest, move, resize, rotate, step, hardDrop, landingY, intervalMs, cellOrigins } from './falling-core.js';
import { usableHosts } from './subnet.js';

const CELL = 26, GUTTER = 0;
const COLOURS = ['#22d3ee', '#facc15', '#a855f7', '#4ade80', '#fb923c', '#60a5fa', '#f472b6', '#2dd4bf', '#a3e635'];
const $ = (id) => document.getElementById(id);

let g = null;
let state = 'idle';          // idle | running | paused | over | roundclear
let active = false;          // arcade tab visible
let last = 0, acc = 0, raf = 0;
let canvas, ctx;

const BEST_KEY = 'asp-arcade-best-v1';
const loadBest = () => { try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; } };
const saveBest = (n) => { try { localStorage.setItem(BEST_KEY, String(n)); } catch { /* storage may be unavailable */ } };
let best = loadBest();

// Optional URL params for reproducible runs: ?seed=7&tick=3000
const params = new URLSearchParams(location.search);
const SEED = params.has('seed') ? Number(params.get('seed')) : null;
const TICK = params.has('tick') ? Number(params.get('tick')) : null;
const newSeed = () => (SEED !== null ? SEED : Date.now() % 100000);

export function initFalling() {
  canvas = $('board');
  ctx = canvas.getContext('2d');
  canvas.width = GUTTER + W * CELL;
  canvas.height = H * CELL;
  $('arcade-start').addEventListener('click', primary);
  document.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'running') pause(); });
  const bind = (id, fn) => $(id).addEventListener('click', () => { if (state === 'running') { fn(); draw(); updatePanel(); } });
  bind('t-left', () => move(g, -1));
  bind('t-right', () => move(g, 1));
  bind('t-down', () => stepAndHandle());
  bind('t-drop', () => afterLock(hardDrop(g)));
  bind('t-rotate', () => rotate(g, 1));
  bind('t-grow', () => resize(g, 1));
  bind('t-shrink', () => resize(g, -1));
  g = newGame(newSeed());
  draw(); updatePanel();
}

// Read-only snapshot used by the Playwright tests.
window.__asp = { snapshot: () => g && ({ grid: g.grid.map((r) => r.slice()), piece: g.piece && { ...g.piece }, round: g.round, score: g.score, over: g.over, roundDone: g.roundDone, state, reqs: g.reqs.map((r) => ({ ...r })), idx: g.idx }) };

export function setActive(on) {
  active = on;
  if (!on && state === 'running') pause();
}

function primary() {
  if (state === 'idle' || state === 'over') { g = newGame(newSeed()); state = 'running'; }
  else if (state === 'roundclear') { nextRound(g); state = 'running'; }
  else if (state === 'paused') state = 'running';
  else if (state === 'running') { pause(); return; }
  $('arcade-start').blur();
  last = performance.now(); acc = 0;
  cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
  draw(); updatePanel();
}

function pause() { state = 'paused'; draw(); updatePanel(); }

function loop(now) {
  if (state !== 'running') return;
  acc += now - last; last = now;
  const iv = TICK || intervalMs(g.round);
  while (acc >= iv && state === 'running') { acc -= iv; stepAndHandle(); }
  draw();
  raf = requestAnimationFrame(loop);
}

function stepAndHandle() { afterLock(step(g)); }

function afterLock(result) {
  if (g.over) {
    state = 'over';
    if (g.score > best) { best = g.score; saveBest(best); }
  } else if (g.roundDone) {
    state = 'roundclear';
    if (g.score > best) { best = g.score; saveBest(best); }
  }
  updatePanel();
}

function onKey(e) {
  if (!active) return;
  const k = e.key;
  if (state !== 'running') {
    if (k === 'Enter' || (k === 'p' && state === 'paused')) { e.preventDefault(); primary(); }
    return;
  }
  const map = {
    ArrowLeft: () => move(g, -1), ArrowRight: () => move(g, 1),
    ArrowUp: () => rotate(g, 1), x: () => rotate(g, 1), X: () => rotate(g, 1),
    z: () => rotate(g, -1), Z: () => rotate(g, -1),
    a: () => resize(g, 1), A: () => resize(g, 1), '+': () => resize(g, 1), '=': () => resize(g, 1),
    s: () => resize(g, -1), S: () => resize(g, -1), '-': () => resize(g, -1),
    ArrowDown: () => stepAndHandle(),
    ' ': () => afterLock(hardDrop(g)),
  };
  if (k === 'p' || k === 'P' || k === 'Escape') { e.preventDefault(); pause(); return; }
  if (map[k]) { e.preventDefault(); map[k](); draw(); updatePanel(); }
}

// ---------- drawing ----------
function drawCell(x, y, colour, alpha = 1) {
  const px = GUTTER + x * CELL, py = (H - 1 - y) * CELL;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = colour; ctx.fillRect(px, py, CELL, CELL);
  ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(px, py, CELL, 3); ctx.fillRect(px, py, 3, CELL);
  ctx.fillStyle = 'rgba(0,0,0,.30)'; ctx.fillRect(px, py + CELL - 3, CELL, 3); ctx.fillRect(px + CELL - 3, py, 3, CELL);
  ctx.globalAlpha = 1;
}

function label(text, b, colour = '#0b1020') {
  ctx.fillStyle = colour; ctx.font = 'bold 12px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, GUTTER + (b.x + b.w / 2) * CELL, (H - b.y - b.h / 2) * CELL);
}

function outline(b, colour, width = 2, dash = []) {
  ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.setLineDash(dash);
  ctx.strokeRect(GUTTER + b.x * CELL + width / 2, (H - b.y - b.h) * CELL + width / 2, b.w * CELL - width, b.h * CELL - width);
  ctx.setLineDash([]);
}

function fillBlock(b, colour, alpha = 1) {
  for (let r = b.y; r < b.y + b.h; r++) for (let c = b.x; c < b.x + b.w; c++) drawCell(c, r, colour, alpha);
}

function banner(lines) {
  ctx.fillStyle = 'rgba(8,12,24,.78)'; ctx.fillRect(GUTTER, 0, W * CELL, H * CELL);
  ctx.fillStyle = '#e2e8f0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach((t, i) => { ctx.font = i === 0 ? 'bold 26px ui-monospace, monospace' : '14px ui-monospace, monospace'; ctx.fillText(t, GUTTER + W * CELL / 2, H * CELL / 2 - 20 + i * 30); });
}

function draw() {
  if (!ctx) return;
  ctx.fillStyle = '#080c18'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  // well
  ctx.fillStyle = '#0d1328'; ctx.fillRect(GUTTER, 0, W * CELL, H * CELL);
  ctx.strokeStyle = 'rgba(148,163,184,.12)'; ctx.lineWidth = 1;
  for (let i = 0; i <= W; i++) { ctx.beginPath(); ctx.moveTo(GUTTER + i * CELL + .5, 0); ctx.lineTo(GUTTER + i * CELL + .5, H * CELL); ctx.stroke(); }
  for (let j = 0; j <= H; j++) { ctx.beginPath(); ctx.moveTo(GUTTER, j * CELL + .5); ctx.lineTo(GUTTER + W * CELL, j * CELL + .5); ctx.stroke(); }
  // locked blocks: each is one real subnet
  g.blocks.forEach((b) => {
    fillBlock(b, COLOURS[b.group % COLOURS.length]);
    outline(b, 'rgba(8,12,24,.85)', 2);
    label('/' + b.prefix, b);
  });
  // ghost + active piece
  const p = g.piece;
  if (p) {
    const gy = landingY(g);
    cellOrigins(p, p.x, gy).forEach((o) => outline({ x: o.x, y: o.y, w: p.w, h: p.h }, 'rgba(226,232,240,.6)', 2, [4, 3]));
    const tooSmall = usableHosts(p.prefix) < currentRequest(g).hosts;
    const col = tooSmall ? '#ef4444' : COLOURS[g.idx % COLOURS.length];
    cellOrigins(p).forEach((o) => {
      const b = { x: o.x, y: o.y, w: p.w, h: p.h };
      fillBlock(b, col, tooSmall ? 0.75 : 1); outline(b, 'rgba(8,12,24,.85)', 2);
      label('/' + p.prefix, b, tooSmall ? '#fff' : '#0b1020');
    });
  }
  if (state === 'idle') banner(['ADDRESS SPACE PACKER', 'Press Enter to start']);
  else if (state === 'paused') banner(['PAUSED', 'Press Enter to resume']);
  else if (state === 'over') banner(['GAME OVER', `Score ${g.score}`, 'Press Enter to play again']);
  else if (state === 'roundclear') banner([`ROUND ${g.round} CLEAR`, `Score ${g.score}`, 'Press Enter for the next round']);
}

function updatePanel() {
  if (!g) return;
  const req = currentRequest(g), p = g.piece;
  $('a-score').textContent = g.score;
  $('a-best').textContent = best;
  $('a-round').textContent = g.round;
  $('a-left').textContent = Math.max(0, g.reqs.length - g.idx);
  if (req && p) {
    $('a-req').textContent = `${req.name}: ${req.hosts} hosts${req.cells.length > 1 ? ' each' : ''}`;
    const u = usableHosts(p.prefix);
    $('a-piece').textContent = `/${p.prefix} gives ${u} usable`;
    $('a-piece').className = u >= req.hosts ? 'good' : 'err';
    const nxt = g.reqs[g.idx + 1];
    $('a-next').textContent = nxt ? `${nxt.name}: ${nxt.hosts} hosts${nxt.cells.length > 1 ? ' each' : ''}` : 'last one';
  } else {
    $('a-req').textContent = '-'; $('a-piece').textContent = ''; $('a-next').textContent = '-';
  }
  const m = $('a-msg'); m.textContent = g.msg;
  const ul = $('a-log'); ul.textContent = '';
  g.allocations.forEach((a) => {
    const li = document.createElement('li');
    li.textContent = `${a.name}: ${a.cidr}${a.perfect ? '' : ' (oversized)'}`;
    ul.appendChild(li);
  });
  $('arcade-start').textContent = state === 'running' ? 'Pause' : state === 'paused' ? 'Resume' : state === 'idle' ? 'Start' : state === 'roundclear' ? 'Next round' : 'Play again';
}
