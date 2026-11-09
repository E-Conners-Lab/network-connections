import { N, LEVELS, newGame, move, undo, hint, cidrOf, siblingStart, describe } from './merge-core.js';
import { blockSize, intToIp } from './subnet.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const SEED = params.has('seed') ? Number(params.get('seed')) : null;
const newSeed = () => (SEED !== null ? SEED : Date.now() % 100000);

const BEST_KEY = 'asp-2048-best-v1';
const loadBest = () => { try { return JSON.parse(localStorage.getItem(BEST_KEY)) || {}; } catch { return {}; } };
const saveBest = (b) => { try { localStorage.setItem(BEST_KEY, JSON.stringify(b)); } catch { /* storage may be unavailable */ } };

let g = null, levelIdx = 0, active = false, best = loadBest();
const tileEls = new Map();   // tile id -> element

const colour = (prefix) => `hsl(${200 + (30 - prefix) * 12}deg 62% 38%)`;

export function initMerge() {
  const li = params.has('level') ? Number(params.get('level')) - 1 : 0;
  start(Math.min(Math.max(li, 0), LEVELS.length - 1));
  document.addEventListener('keydown', onKey);
  const dirs = { 'm-left': 'left', 'm-right': 'right', 'm-up': 'up', 'm-down': 'down' };
  Object.entries(dirs).forEach(([id, d]) => $(id).addEventListener('click', () => act(d)));
  $('m-undo').addEventListener('click', () => { if (undo(g)) render(); });
  $('m-restart').addEventListener('click', () => start(levelIdx));
  $('m-hint').addEventListener('click', showHint);
  $('m-next').addEventListener('click', () => start(levelIdx + 1));
  // swipe
  const board = $('m-board'); let sx = 0, sy = 0;
  board.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
  board.addEventListener('pointerup', (e) => {
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return;
    act(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  });
  window.__m2048 = { snapshot };
}

export function setMergeActive(on) { active = on; }

function snapshot() {
  return {
    level: g.level.id, parent: g.level.parent, score: g.score, moves: g.moves, won: g.won, lost: g.lost,
    tiles: g.board.map((t, cell) => t && { cell, cidr: cidrOf(t), id: t.id }).filter(Boolean),
    pool: g.pool.map(cidrOf),
  };
}

function start(i) {
  levelIdx = i;
  g = newGame(i, newSeed());
  tileEls.forEach((el) => el.remove()); tileEls.clear();
  render();
}

function act(dir) {
  if (!g) return;
  const r = move(g, dir);
  if (r.moved && g.won) {
    const prev = best[g.level.id];
    if (!prev || g.moves < prev) { best[g.level.id] = g.moves; saveBest(best); }
  }
  render(r.merges || []);
}

function onKey(e) {
  if (!active || e.ctrlKey || e.metaKey || e.altKey) return;
  const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down', A: 'left', D: 'right', W: 'up', S: 'down' };
  if (map[e.key]) { e.preventDefault(); act(map[e.key]); }
  else if (e.key === 'u' || e.key === 'z') { if (undo(g)) render(); }
  else if (e.key === 'h') showHint();
  else if (e.key === 'r') start(levelIdx);
}

function showHint() {
  const pair = hint(g);
  if (pair) {
    pair.forEach((t) => { const el = tileEls.get(t.id); if (el) { el.classList.add('hint'); setTimeout(() => el.classList.remove('hint'), 2500); } });
    setMsg(`Hint: ${cidrOf(pair[0])} and ${cidrOf(pair[1])} are siblings. Slide them so they touch.`);
    return;
  }
  const t = g.board.find(Boolean);
  if (!t) return;
  const sib = { start: siblingStart(t), prefix: t.prefix };
  const waiting = g.pool.some((p) => p.start === sib.start && p.prefix === sib.prefix);
  setMsg(`No sibling pair is on the board yet. ${cidrOf(t)} needs ${cidrOf(sib)}${waiting ? ', which has not arrived yet. Keep sliding.' : ', which is still in smaller pieces that must merge up first.'}`);
}

function setMsg(text) { const m = $('m-msg'); m.textContent = text; }

// ---------- rendering ----------
function render(merges = []) {
  const lv = g.level;
  $('m-goal').textContent = `Goal: merge every block back into ${lv.parent}`;
  $('m-title').textContent = `Level ${lv.id}: ${lv.title}`;
  $('m-brief').textContent = lv.brief;
  $('m-score').textContent = g.score;
  $('m-moves').textContent = g.moves;
  $('m-pool').textContent = g.pool.length;
  $('m-best').textContent = best[lv.id] ? `${best[lv.id]} moves` : '-';
  setMsg(g.msg);
  renderLevels();
  renderTiles(merges);
  renderMap();
  const over = g.won || g.lost;
  $('m-done').hidden = !over;
  if (over) {
    $('m-done-title').textContent = g.won ? 'Level complete' : 'Stuck';
    $('m-done-text').textContent = g.won ? `${lv.parent} is one block again. ${g.moves} moves, score ${g.score}.` : 'No more merges are possible from here. Undo a few moves or restart.';
    $('m-next').hidden = !g.won || levelIdx >= LEVELS.length - 1;
  }
}

function renderLevels() {
  const nav = $('m-levels'); nav.textContent = '';
  LEVELS.forEach((l, i) => {
    const b = document.createElement('button');
    b.className = 'lvl' + (i === levelIdx ? ' on' : '');
    b.textContent = best[l.id] ? `${l.id} ✓` : String(l.id);
    b.setAttribute('aria-label', `Level ${l.id}, ${l.title}${best[l.id] ? ', completed' : ''}`);
    if (i === levelIdx) b.setAttribute('aria-current', 'true');
    b.addEventListener('click', () => start(i));
    nav.appendChild(b);
  });
}

function renderTiles(merges) {
  const live = new Set(g.board.filter(Boolean).map((t) => t.id));
  // tiles that merged slide into the merged cell, then disappear
  const mergedAway = new Map();
  merges.forEach((m) => { mergedAway.set(m.a.id, m.cell); mergedAway.set(m.b.id, m.cell); });
  tileEls.forEach((el, id) => {
    if (live.has(id)) return;
    if (mergedAway.has(id)) { const c = mergedAway.get(id); el.style.setProperty('--r', Math.floor(c / N)); el.style.setProperty('--c', c % N); el.classList.add('leaving'); setTimeout(() => el.remove(), 140); }
    else el.remove();
    tileEls.delete(id);
  });
  g.board.forEach((t, cell) => {
    if (!t) return;
    let el = tileEls.get(t.id);
    if (!el) {
      el = document.createElement('div');
      el.className = 'tile'; el.setAttribute('role', 'gridcell');
      el.innerHTML = '<div class="inner"><strong></strong><span class="addr"></span><span class="hosts"></span></div>';
      $('m-board').appendChild(el);
      tileEls.set(t.id, el);
      el.classList.add('pop');
    }
    const d = describe(t);
    el.querySelector('strong').textContent = `/${t.prefix}`;
    el.querySelector('.addr').textContent = intToIp(t.start);
    el.querySelector('.hosts').textContent = `${d.hosts} hosts`;
    el.querySelector('.inner').style.background = colour(t.prefix);
    el.style.setProperty('--r', Math.floor(cell / N));
    el.style.setProperty('--c', cell % N);
    el.setAttribute('aria-label', `${d.cidr}, ${d.hosts} usable hosts, ${d.range}`);
  });
}

// One bar showing the whole parent block: tiles on the board, plus blocks still waiting in the pool.
function renderMap() {
  const bar = $('m-map'); bar.textContent = '';
  const total = g.parent.size;
  const segs = [
    ...g.board.filter(Boolean).map((t) => ({ t, waiting: false })),
    ...g.pool.map((t) => ({ t, waiting: true })),
  ].sort((a, b) => a.t.start - b.t.start);
  segs.forEach(({ t, waiting }) => {
    const s = document.createElement('div');
    const size = blockSize(t.prefix);
    s.className = 'seg' + (waiting ? ' waiting' : '');
    s.style.flexBasis = `${(size / total) * 100}%`;
    if (!waiting) s.style.background = colour(t.prefix);
    s.title = `${cidrOf(t)}${waiting ? ' (not on the board yet)' : ''}`;
    if (size / total > 0.07) s.textContent = `/${t.prefix}`;
    bar.appendChild(s);
  });
}
