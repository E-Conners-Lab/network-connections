import { COLOURS, MAX_MISTAKES, newGame, rng, toggle, deselectAll, shuffle, submit, shareText, validatePuzzle } from './connections-core.js';
import { ICONS } from './icons.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const STORE = 'nc-results-v1';
const loadResults = () => { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } };
const saveResults = (r) => { try { localStorage.setItem(STORE, JSON.stringify(r)); } catch { /* storage may be unavailable */ } };

const THEME_KEY = 'nc-theme-v1';
const loadTheme = () => { try { return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'; } catch { return 'dark'; } };
const SUN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/></svg>';
const MOON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
const NODES = [[36, 42], [98, 18], [162, 44], [224, 22]];
const SVGNS = 'http://www.w3.org/2000/svg';

let puzzles = [], g = null, idx = 0, results = loadResults(), lastNew = -1, freshMiss = false;

function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  const b = $('theme');
  b.innerHTML = t === 'dark' ? SUN : MOON;
  b.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  b.setAttribute('aria-pressed', String(t === 'light'));
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = t === 'dark' ? '#070b14' : '#eef3f9';
}

function buildTopology() {
  const svg = $('topo'); svg.textContent = '';
  const el = (name, attrs) => { const e = document.createElementNS(SVGNS, name); Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v)); return e; };
  for (let i = 0; i < 3; i++) svg.appendChild(el('line', { class: `link l${i}`, x1: NODES[i][0], y1: NODES[i][1], x2: NODES[i + 1][0], y2: NODES[i + 1][1] }));
  NODES.forEach(([x, y], i) => {
    svg.appendChild(el('circle', { class: `ring r${i} n${i}`, cx: x, cy: y, r: 9 }));
    svg.appendChild(el('circle', { class: `node n${i}`, cx: x, cy: y, r: 9 }));
  });
}

function renderTopology() {
  const up = (i) => g.solved.includes(i);
  document.querySelectorAll('#topo .node').forEach((n, i) => n.classList.toggle('up', up(i)));
  document.querySelectorAll('#topo .link').forEach((l, i) => l.classList.toggle('up', up(i) && up(i + 1)));
  $('links').innerHTML = `LINKS UP <b>${g.solved.length}/4</b>`;
  if (lastNew >= 0) {
    const ring = document.querySelector(`#topo .ring.r${g.solved[lastNew]}`);
    if (ring) { ring.classList.remove('go'); void ring.getBoundingClientRect(); ring.classList.add('go'); }
  }
}

// A short burst of coloured "packets" when a puzzle is solved.
function burst() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = document.createElement('div'); box.className = 'burst'; box.setAttribute('aria-hidden', 'true');
  const cols = ['var(--c0)', 'var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--accent)'];
  for (let i = 0; i < 40; i++) {
    const p = document.createElement('span'); p.className = 'packet';
    p.style.left = `${Math.random() * 100}%`; p.style.background = cols[i % cols.length];
    p.style.animationDelay = `${Math.random() * 0.5}s`; p.style.width = p.style.height = `${6 + Math.random() * 7}px`;
    box.appendChild(p);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 2600);
}

async function init() {
  try {
    const res = await fetch('data/puzzles.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    puzzles = (await res.json()).puzzles;
  } catch (e) {
    $('msg').textContent = 'Could not load the puzzles. Serve this folder with a web server (python3 -m http.server).';
    return;
  }
  const bad = puzzles.map((p) => ({ p, errs: validatePuzzle(p) })).find((x) => x.errs.length);
  if (bad) { $('msg').textContent = `Puzzle "${bad.p && bad.p.title}" is invalid: ${bad.errs[0]}`; return; }
  const want = Number(params.get('puzzle'));
  start(Math.max(0, puzzles.findIndex((p) => p.id === want)));
  applyTheme(loadTheme());
  buildTopology();
  $('theme').addEventListener('click', () => {
    const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(t); try { localStorage.setItem(THEME_KEY, t); } catch { /* storage may be unavailable */ }
  });
  $('shuffle').addEventListener('click', () => { shuffle(g); render(); });
  $('deselect').addEventListener('click', () => { deselectAll(g); render(); });
  $('submit').addEventListener('click', onSubmit);
  $('next').addEventListener('click', () => start((idx + 1) % puzzles.length));
  $('copy').addEventListener('click', copyResult);
  window.__nc = { snapshot };
}

function seedFor(p) { return params.has('seed') ? Number(params.get('seed')) + p.id : (Date.now() + p.id) % 1000003; }

function start(i) {
  idx = i;
  g = newGame(puzzles[i], rng(seedFor(puzzles[i])));
  lastNew = -1;
  $('copy-note').textContent = '';
  render();
}

function snapshot() {
  return {
    id: g.puzzle.id, title: g.puzzle.title, tiles: g.tiles.slice(), selected: g.selected.slice(),
    solved: g.solved.map((gi) => g.puzzle.groups[gi].name), mistakes: g.mistakes, won: g.won, lost: g.lost, msg: g.msg,
    share: g.won || g.lost ? shareText(g) : null,
  };
}

function onSubmit() {
  const before = g.mistakes;
  const r = submit(g);
  if (r.type === 'correct') lastNew = g.solved.length - 1;
  if (g.won || g.lost) {
    results[g.puzzle.id] = { result: g.won ? 'won' : 'lost', mistakes: g.mistakes };
    saveResults(results);
  }
  freshMiss = g.mistakes > before;
  render();
  freshMiss = false;
  if (g.mistakes > before) {
    const grid = $('grid');
    if (!g.lost) {
      grid.classList.remove('shake'); void grid.offsetWidth; grid.classList.add('shake');
      grid.classList.add('bad'); setTimeout(() => grid.classList.remove('bad'), 700);
    }
    if (g.msg === 'One away!') { const m = $('msg'); m.classList.remove('pulse'); void m.offsetWidth; m.classList.add('pulse'); }
  }
  if (g.won) burst();
}

function render() {
  const a = document.activeElement;
  const hadTile = !!(a && a.classList && a.classList.contains('tile'));
  const focusItem = hadTile ? a.dataset.item : null;
  renderPicker();
  $('p-title').textContent = `Puzzle ${g.puzzle.id}: ${g.puzzle.title}`;
  renderSolved();
  renderGrid();
  fitTiles();
  renderTopology();
  renderLives();
  const over = g.won || g.lost;
  $('submit').disabled = over || g.selected.length !== 4;
  $('shuffle').disabled = over; $('deselect').disabled = over || !g.selected.length;
  $('msg').textContent = g.msg;
  $('result').hidden = !over;
  if (over) renderResult();
  // The tiles are rebuilt on every change, so give keyboard focus back to the same tile (or the first one left).
  if (hadTile && !over) {
    const tiles = [...document.querySelectorAll('#grid .tile')];
    (tiles.find((t) => t.dataset.item === focusItem) || tiles[0] || $('submit')).focus();
  }
}

function renderPicker() {
  const nav = $('picker'); nav.textContent = '';
  puzzles.forEach((p, i) => {
    const b = document.createElement('button');
    b.className = 'pill'; b.type = 'button';
    const r = results[p.id];
    b.textContent = String(p.id);
    if (r) { const m = document.createElement('span'); m.className = 'mark'; m.textContent = r.result === 'won' ? '✓' : '✗'; b.appendChild(m); }
    b.setAttribute('aria-label', `Puzzle ${p.id}, ${p.title}${r ? (r.result === 'won' ? ', solved' : ', not solved') : ''}`);
    if (i === idx) b.setAttribute('aria-current', 'true');
    b.addEventListener('click', () => start(i));
    nav.appendChild(b);
  });
}

function banner(gi, missed, isNew) {
  const grp = g.puzzle.groups[gi];
  const d = document.createElement('div');
  d.className = `banner ${COLOURS[gi]}${missed ? ' missed' : ''}${isNew ? ' new' : ''}`;
  d.dataset.group = grp.name;
  const ico = document.createElementNS(SVGNS, 'svg');
  ico.setAttribute('viewBox', '0 0 24 24'); ico.setAttribute('class', 'ico'); ico.setAttribute('aria-hidden', 'true');
  ico.innerHTML = ICONS[grp.icon] || ICONS.tag;
  const txt = document.createElement('div');
  const s = document.createElement('strong'); s.textContent = grp.name;
  const sp = document.createElement('span'); sp.textContent = grp.items.join(', ');
  txt.append(s, sp);
  d.append(ico, txt);
  return d;
}

function renderSolved() {
  const box = $('solved'); box.textContent = '';
  g.solved.forEach((gi, k) => box.appendChild(banner(gi, false, k === lastNew)));
  g.revealed.forEach((gi) => box.appendChild(banner(gi, true, false)));
}

function renderGrid() {
  const grid = $('grid'); grid.textContent = '';
  g.tiles.forEach((item) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tile'; b.textContent = item; b.dataset.item = item;
    if (!/\s/.test(item)) b.classList.add('single');
    const on = g.selected.includes(item);
    b.setAttribute('aria-pressed', String(on));
    b.disabled = g.won || g.lost;
    b.addEventListener('click', () => { toggle(g, item); g.msg = ''; render(); });
    grid.appendChild(b);
  });
  if (g.lost) grid.textContent = '';
}

// Shrink a tile's text until its longest word fits, so words are never split mid-way.
function fitTiles() {
  document.querySelectorAll('#grid .tile').forEach((b) => {
    b.style.fontSize = '';
    let size = parseFloat(getComputedStyle(b).fontSize);
    while (b.scrollWidth > b.clientWidth + 0.5 && size > 8) { size -= 0.5; b.style.fontSize = `${size}px`; }
    if (b.scrollWidth > b.clientWidth + 0.5) b.style.overflowWrap = 'anywhere';
  });
}
window.addEventListener('resize', fitTiles);

function renderLives() {
  const d = $('dots'); d.textContent = '';
  for (let i = 0; i < MAX_MISTAKES; i++) { const s = document.createElement('span'); s.className = 'dot' + (i < g.mistakes ? ' used' : '') + (freshMiss && i === g.mistakes - 1 ? ' fresh' : ''); d.appendChild(s); }
  $('lives-text').textContent = `${MAX_MISTAKES - g.mistakes} of ${MAX_MISTAKES}`;
}

function renderResult() {
  $('r-title').textContent = g.won ? (g.mistakes ? `Solved with ${g.mistakes} mistake${g.mistakes === 1 ? '' : 's'}` : 'Perfect! No mistakes') : 'Not this time';
  const ul = $('r-why'); ul.textContent = '';
  g.puzzle.groups.forEach((grp, gi) => {
    const li = document.createElement('li');
    const sw = document.createElement('span'); sw.className = `swatch ${COLOURS[gi]}`;
    const t = document.createElement('span'); t.textContent = `${grp.name}: ${grp.why}`;
    li.append(sw, t); ul.appendChild(li);
  });
  $('r-share').textContent = shareText(g);
  $('next').textContent = idx === puzzles.length - 1 ? 'Back to puzzle 1' : 'Next puzzle';
}

async function copyResult() {
  const text = shareText(g);
  try { await navigator.clipboard.writeText(text); $('copy-note').textContent = 'Copied to the clipboard.'; }
  catch { $('copy-note').textContent = 'Could not copy automatically. Select the text above to copy it.'; }
}

init();
