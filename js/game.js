import { intToIp, parseCidr, blockSize, usableHosts, prefixForHosts, isAligned, overlaps, describeBlock, findFreeSlot } from './subnet.js';
import { LEVELS } from './levels.js';
import { initFalling, setActive } from './falling.js';

const $ = (id) => document.getElementById(id);
const COLOURS = 9;

// ---------- persistence (best-effort) ----------
const STORE = 'asp-stars-v1';
function loadStars() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } }
function saveStars(s) { try { localStorage.setItem(STORE, JSON.stringify(s)); } catch { /* storage may be unavailable */ } }

// ---------- state ----------
let stars = loadStars();
let lvlIdx = 0;
let level, parent, unitSize, cellCount, reserved;
let placements = [];   // { req, start, prefix }
let selReq = null;
let selPrefix = null;
let mistakes = 0;
let cells = [];

export function validate(cellIdx, req, prefix) {
  const size = blockSize(prefix);
  const start = parent.start + cellIdx * unitSize;
  const kind = req.kind || 'lan';
  if (usableHosts(prefix, kind) < req.hosts) {
    return { ok: false, reason: `A /${prefix} has ${usableHosts(prefix, kind)} usable addresses, but ${req.name} needs ${req.hosts}.` };
  }
  if (!isAligned(start, prefix)) {
    const lower = start - (start % size);
    return { ok: false, reason: `${intToIp(start)} is not a valid /${prefix} start. /${prefix} blocks begin on multiples of ${size}, for example ${intToIp(lower)} or ${intToIp(lower + size)}.` };
  }
  if (start + size > parent.start + parent.size) {
    return { ok: false, reason: `A /${prefix} starting at ${intToIp(start)} runs past the end of ${intToIp(parent.start)}/${parent.prefix}.` };
  }
  const cand = { start, size };
  const hit = usedBlocks().find((u) => overlaps(cand, u));
  if (hit) return { ok: false, reason: `That overlaps ${hit.label}.` };
  return { ok: true, start };
}

function usedBlocks() {
  return [
    ...reserved.map((r) => ({ start: r.start, size: r.size, label: r.name })),
    ...placements.map((p) => ({ start: p.start, size: blockSize(p.prefix), label: p.req.name })),
  ];
}

function optimalPrefix(req) { return prefixForHosts(req.hosts, req.kind || 'lan'); }

// ---------- level setup ----------
function startLevel(i) {
  lvlIdx = i;
  level = LEVELS[i];
  parent = parseCidr(level.parent);
  unitSize = blockSize(level.unit);
  cellCount = parent.size / unitSize;
  reserved = level.reserved.map((r) => ({ name: r.name, ...parseCidr(r.cidr) }));
  placements = [];
  selReq = null; selPrefix = null; mistakes = 0;
  $('done').hidden = true;
  setMessage('');
  renderAll();
  selectFirstOpen();
}

function selectFirstOpen() {
  const next = level.requests.find((r) => !placements.some((p) => p.req === r));
  selReq = next || null;
  renderRequests(); renderPrefixes();
}

// ---------- rendering ----------
function renderAll() {
  renderLevels();
  $('level-title').textContent = `Level ${level.id}: ${level.title}`;
  $('level-brief').textContent = level.brief;
  $('parent-cidr').textContent = level.parent;
  $('parent-meta').textContent = `(${parent.size} addresses, ${intToIp(parent.start)} to ${intToIp(parent.start + parent.size - 1)})`;
  $('unit-label').textContent = `/${level.unit} (${unitSize} address${unitSize > 1 ? 'es' : ''})`;
  renderMap(); renderRequests(); renderPrefixes(); renderScore();
}

function renderLevels() {
  const nav = $('levels');
  nav.textContent = '';
  LEVELS.forEach((l, i) => {
    const b = document.createElement('button');
    b.className = 'lvl' + (i === lvlIdx ? ' on' : '');
    b.textContent = `${l.id}${stars[l.id] ? ' ' + '★'.repeat(stars[l.id]) : ''}`;
    b.setAttribute('aria-label', `Level ${l.id}, ${l.title}${stars[l.id] ? ', ' + stars[l.id] + ' stars' : ''}`);
    if (i === lvlIdx) b.setAttribute('aria-current', 'true');
    b.addEventListener('click', () => startLevel(i));
    nav.appendChild(b);
  });
}

function renderRequests() {
  const ul = $('requests');
  ul.textContent = '';
  level.requests.forEach((r) => {
    const placed = placements.find((p) => p.req === r);
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.className = 'req' + (r === selReq ? ' on' : '') + (placed ? ' done' : '');
    const name = document.createElement('span');
    name.textContent = r.name;
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = placed ? describeBlock(placed.start, placed.prefix).cidr : `${r.hosts} ${r.kind === 'link' ? 'addr (link)' : 'hosts'}`;
    b.append(name, badge);
    b.disabled = !!placed;
    b.addEventListener('click', () => { selReq = r; renderRequests(); renderPrefixes(); });
    li.appendChild(b);
    ul.appendChild(li);
  });
}

function renderPrefixes() {
  const box = $('prefixes');
  box.textContent = '';
  const kind = selReq ? (selReq.kind || 'lan') : 'lan';
  for (let p = parent.prefix; p <= level.unit; p++) {
    const b = document.createElement('button');
    b.className = 'prefix' + (p === selPrefix ? ' on' : '');
    b.setAttribute('aria-pressed', String(p === selPrefix));
    const u = usableHosts(p, kind);
    b.innerHTML = '';
    b.append(`/${p}`);
    const s = document.createElement('small');
    s.textContent = `${u} usable`;
    b.appendChild(s);
    b.addEventListener('click', () => { selPrefix = p; renderPrefixes(); });
    box.appendChild(b);
  }
}

function renderMap() {
  const map = $('map');
  map.textContent = '';
  const cols = Math.min(cellCount, 16);
  map.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
  cells = [];
  for (let i = 0; i < cellCount; i++) {
    const b = document.createElement('button');
    b.className = 'cell';
    b.dataset.i = i;
    b.setAttribute('role', 'gridcell');
    b.addEventListener('click', () => onCell(i));
    b.addEventListener('mouseenter', () => preview(i));
    b.addEventListener('focus', () => preview(i));
    b.addEventListener('mouseleave', clearPreview);
    b.addEventListener('blur', clearPreview);
    map.appendChild(b);
    cells.push(b);
  }
  paintMap();
}

function paintMap() {
  const owner = new Array(cellCount).fill(null);
  const mark = (start, size, info) => {
    const first = (start - parent.start) / unitSize;
    const n = Math.max(1, size / unitSize);
    for (let k = 0; k < n; k++) owner[first + k] = { ...info, first: k === 0 };
  };
  reserved.forEach((r) => mark(r.start, r.size, { label: r.name, reserved: true }));
  placements.forEach((p) => mark(p.start, blockSize(p.prefix), { label: p.req.name, colour: level.requests.indexOf(p.req) % COLOURS, cidr: describeBlock(p.start, p.prefix).cidr }));
  cells.forEach((c, i) => {
    const o = owner[i];
    const addr = intToIp(parent.start + i * unitSize);
    c.className = 'cell' + (o ? (o.reserved ? ' reserved' : ' placed') : '');
    c.style.background = o && !o.reserved ? `var(--c${o.colour})` : '';
    c.textContent = o && o.first ? o.label : '';
    c.setAttribute('aria-label', `${addr}, ${o ? (o.reserved ? 'reserved by ' : 'assigned to ') + o.label : 'free'}`);
  });
}

function previewSpan(i) { return selPrefix ? Math.max(1, blockSize(selPrefix) / unitSize) : 1; }

function preview(i) {
  clearPreview();
  const addr = intToIp(parent.start + i * unitSize);
  let text = addr;
  let ok = null;
  if (selReq && selPrefix) {
    const v = validate(i, selReq, selPrefix);
    ok = v.ok;
    text = v.ok ? `${describeBlock(v.start, selPrefix).cidr}  ${intToIp(v.start + 1)} - ${intToIp(v.start + blockSize(selPrefix) - 2)} usable` : `${addr}/${selPrefix}  not valid here`;
    const n = previewSpan(i);
    for (let k = 0; k < n && i + k < cellCount; k++) cells[i + k].classList.add(ok ? 'ok' : 'bad');
  }
  $('hover-info').textContent = text;
}

function clearPreview() {
  cells.forEach((c) => c.classList.remove('ok', 'bad'));
  $('hover-info').textContent = ' ';
}

function setMessage(text, kind = '') {
  const m = $('message');
  m.textContent = text;
  m.className = 'message ' + kind;
}

function score() {
  let pts = 0;
  placements.forEach((p) => {
    const diff = p.prefix === optimalPrefix(p.req) ? 0 : optimalPrefix(p.req) - p.prefix;
    pts += diff === 0 ? 100 : diff === 1 ? 50 : 20;
  });
  return Math.max(0, pts - mistakes * 10);
}

function renderScore() {
  $('score').textContent = `Score ${score()} / ${level.requests.length * 100}   Mistakes ${mistakes}`;
}

// ---------- actions ----------
function onCell(i) {
  if (!selReq) { setMessage('Every request is already placed.', 'warn'); return; }
  if (!selPrefix) { setMessage('Choose a prefix length first.', 'warn'); return; }
  const v = validate(i, selReq, selPrefix);
  if (!v.ok) { mistakes++; setMessage(v.reason, 'err'); renderScore(); return; }

  placements.push({ req: selReq, start: v.start, prefix: selPrefix });
  const best = optimalPrefix(selReq);
  const usable = usableHosts(selPrefix, selReq.kind || 'lan');
  if (selPrefix === best) {
    setMessage(`${describeBlock(v.start, selPrefix).cidr} for ${selReq.name}. Right-sized: ${usable} usable for ${selReq.hosts} needed.`, 'good');
  } else {
    setMessage(`${describeBlock(v.start, selPrefix).cidr} works, but a /${best} was enough. You wasted ${usable - selReq.hosts} addresses.`, 'warn');
  }
  selPrefix = null;
  afterChange();
}

function afterChange() {
  paintMap(); clearPreview();
  const open = level.requests.filter((r) => !placements.some((p) => p.req === r));
  if (open.length === 0) { finish(); selReq = null; renderRequests(); renderPrefixes(); renderScore(); return; }
  selectFirstOpen();
  renderScore();
  const stuck = open.find((r) => findFreeSlot(parent, usedBlocks(), optimalPrefix(r)) === -1);
  if (stuck) setMessage(`No aligned space is left for ${stuck.name} (needs a /${optimalPrefix(stuck)}). Undo or reset and plan the big blocks first.`, 'err');
}

function finish() {
  const max = level.requests.length * 100;
  const pct = score() / max;
  const n = pct >= 0.9 ? 3 : pct >= 0.6 ? 2 : 1;
  if ((stars[level.id] || 0) < n) { stars[level.id] = n; saveStars(stars); }
  renderLevels();
  $('done-title').textContent = `Level complete ${'★'.repeat(n)}${'☆'.repeat(3 - n)}`;
  const used = placements.reduce((a, p) => a + blockSize(p.prefix), 0);
  $('done-text').textContent = `Score ${score()} of ${max}. You allocated ${used} of ${parent.size} addresses.`;
  $('next').hidden = lvlIdx >= LEVELS.length - 1;
  $('done').hidden = false;
}

$('undo').addEventListener('click', () => {
  if (!placements.length) return;
  placements.pop();
  $('done').hidden = true;
  setMessage('Undone.');
  afterChange();
});
$('reset').addEventListener('click', () => startLevel(lvlIdx));
$('next').addEventListener('click', () => startLevel(lvlIdx + 1));

// ---------- drill mode ----------
const drill = { n: 0, right: 0, answer: null, locked: false };
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) { const j = rnd(0, i); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}

function nextQuestion() {
  if (drill.n >= 10) { endDrill(); return; }
  drill.locked = false;
  $('drill-feedback').textContent = '';
  $('drill-feedback').className = 'message';
  $('drill-progress').textContent = `Question ${drill.n + 1} of 10   Correct ${drill.right}`;
  let correct, opts, q;
  if (Math.random() < 0.5) {
    const p = rnd(22, 30);
    correct = String(usableHosts(p)); q = `How many usable host addresses are in a /${p}?`;
    opts = new Set([correct]);
    while (opts.size < 4) opts.add(String(usableHosts(rnd(22, 30))));
  } else {
    const hosts = rnd(5, 1000);
    const p = prefixForHosts(hosts);
    correct = `/${p}`; q = `What is the smallest prefix that fits ${hosts} hosts?`;
    opts = new Set([correct]);
    while (opts.size < 4) opts.add(`/${rnd(Math.max(20, p - 2), Math.min(30, p + 2))}`);
  }
  drill.answer = correct;
  $('drill-q').textContent = q;
  const box = $('drill-options');
  box.textContent = '';
  shuffle([...opts]).forEach((o) => {
    const b = document.createElement('button');
    b.textContent = o;
    b.addEventListener('click', () => answer(o, b));
    box.appendChild(b);
  });
}

function answer(o, b) {
  if (drill.locked) return;
  drill.locked = true;
  const fb = $('drill-feedback');
  if (o === drill.answer) { drill.right++; fb.textContent = 'Correct.'; fb.className = 'message good'; }
  else { fb.textContent = `Not quite. The answer is ${drill.answer}.`; fb.className = 'message err'; }
  drill.n++;
  setTimeout(nextQuestion, 1200);
}

function endDrill() {
  $('drill-q').textContent = `Finished: ${drill.right} out of 10.`;
  $('drill-options').textContent = '';
  $('drill-progress').textContent = '';
  $('drill-restart').hidden = false;
}

$('drill-restart').addEventListener('click', startDrill);
function startDrill() {
  drill.n = 0; drill.right = 0;
  $('drill-restart').hidden = true;
  nextQuestion();
}

function setMode(mode) {
  $('arcade').hidden = mode !== 'arcade'; $('pack').hidden = mode !== 'pack'; $('drill').hidden = mode !== 'drill';
  ['arcade', 'pack', 'drill'].forEach((m) => {
    $('mode-' + m).classList.toggle('on', m === mode);
    $('mode-' + m).setAttribute('aria-pressed', String(m === mode));
  });
  setActive(mode === 'arcade');
  if (mode === 'drill') startDrill();
}
$('mode-arcade').addEventListener('click', () => setMode('arcade'));
$('mode-pack').addEventListener('click', () => setMode('pack'));
$('mode-drill').addEventListener('click', () => setMode('drill'));

startLevel(0);
initFalling();
setMode('arcade');
