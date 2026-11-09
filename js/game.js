import { COLOURS, MAX_MISTAKES, newGame, rng, toggle, deselectAll, shuffle, submit, shareText, validatePuzzle } from './connections-core.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const STORE = 'nc-results-v1';
const loadResults = () => { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } };
const saveResults = (r) => { try { localStorage.setItem(STORE, JSON.stringify(r)); } catch { /* storage may be unavailable */ } };

let puzzles = [], g = null, idx = 0, results = loadResults(), lastNew = -1;

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
  render();
  if (g.mistakes > before && !g.lost) {
    const grid = $('grid'); grid.classList.remove('shake'); void grid.offsetWidth; grid.classList.add('shake');
  }
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
  const s = document.createElement('strong'); s.textContent = grp.name;
  const sp = document.createElement('span'); sp.textContent = grp.items.join(', ');
  d.append(s, sp);
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
  for (let i = 0; i < MAX_MISTAKES; i++) { const s = document.createElement('span'); s.className = 'dot' + (i < g.mistakes ? ' used' : ''); d.appendChild(s); }
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
