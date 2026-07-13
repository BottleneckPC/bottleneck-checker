import { CPUS, GPUS } from './data.js';
import { scoreVerdict, estimateFPS, explain, formatRange } from './engine.js';

const state = {
  cpu: null,
  gpu: null,
  resolution: '1440p',
  genre: 'mixed',
  upscaling: false,
};

/* ---------------- Combobox ---------------- */
function setupCombo(kind, items) {
  const root = document.querySelector(`.combo[data-kind="${kind}"]`);
  const input = root.querySelector('.combo-input');
  const list = root.querySelector('.combo-list');
  const clear = root.querySelector('.combo-clear');
  let active = -1;
  let filtered = [];

  function render(q) {
    const query = q.trim().toLowerCase();
    filtered = (query
      ? items.filter((it) => it.name.toLowerCase().includes(query))
      : items
    ).slice(0, 80);
    active = -1;
    if (!filtered.length) {
      list.innerHTML = '<li class="combo-empty">No matches</li>';
    } else {
      list.innerHTML = filtered
        .map(
          (it, i) =>
            `<li class="combo-opt" role="option" data-i="${i}">
               <span class="opt-name">${escapeHtml(it.name)}</span>
               <span class="opt-brand">${escapeHtml(it.brand)}</span>
               <span class="opt-score">${it.score}</span>
             </li>`
        )
        .join('');
    }
    open();
  }

  function open() { list.hidden = false; input.setAttribute('aria-expanded', 'true'); }
  function close() { list.hidden = true; input.setAttribute('aria-expanded', 'false'); active = -1; }

  function choose(it) {
    state[kind] = it;
    input.value = it.name;
    root.classList.add('selected');
    clear.hidden = false;
    close();
    syncURL();
    render_result();
  }

  function setActive(i) {
    const opts = [...list.querySelectorAll('.combo-opt')];
    opts.forEach((o) => o.classList.remove('active'));
    if (i >= 0 && opts[i]) {
      opts[i].classList.add('active');
      opts[i].scrollIntoView({ block: 'nearest' });
    }
    active = i;
  }

  input.addEventListener('focus', () => render(input.value === (state[kind]?.name || '') ? '' : input.value));
  input.addEventListener('input', () => { root.classList.remove('selected'); clear.hidden = !input.value; render(input.value); });
  input.addEventListener('keydown', (e) => {
    if (list.hidden && (e.key === 'ArrowDown')) { render(''); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(active + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(active - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[active]) choose(filtered[active]); else if (filtered.length === 1) choose(filtered[0]); }
    else if (e.key === 'Escape') { close(); input.blur(); }
  });
  list.addEventListener('mousedown', (e) => {
    const li = e.target.closest('.combo-opt');
    if (li) { e.preventDefault(); choose(filtered[+li.dataset.i]); }
  });
  clear.addEventListener('click', () => {
    state[kind] = null; input.value = ''; root.classList.remove('selected'); clear.hidden = true;
    syncURL(); render_result(); input.focus();
  });
  document.addEventListener('click', (e) => { if (!root.contains(e.target)) close(); });

  return { selectById: (id) => { const it = items.find((x) => x.id === id); if (it) choose(it); } };
}

/* ---------------- Segmented + toggle ---------------- */
function setupSegmented(id, key) {
  const group = document.getElementById(id);
  group.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    group.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b === btn)));
    state[key] = btn.dataset.val;
    syncURL();
    render_result();
  });
}

function setupToggle() {
  const t = document.getElementById('toggle-upscale');
  t.addEventListener('click', () => {
    state.upscaling = !state.upscaling;
    t.setAttribute('aria-checked', String(state.upscaling));
    t.querySelector('.toggle-text').textContent = state.upscaling ? 'On' : 'Off';
    syncURL();
    render_result();
  });
}

/* ---------------- Render result ---------------- */
function render_result() {
  const placeholder = document.getElementById('placeholder');
  const result = document.getElementById('result');
  if (!state.cpu || !state.gpu) {
    placeholder.hidden = false;
    result.hidden = true;
    return;
  }
  placeholder.hidden = true;
  result.hidden = false;

  const v = scoreVerdict(state.cpu.score, state.gpu.score, state.resolution, state.genre, state.upscaling);
  const severe = v.range.high >= 30;

  // Verdict tag + headline
  const tag = document.getElementById('verdict-tag');
  const headline = document.getElementById('verdict-headline');
  tag.className = 'verdict-tag';
  if (v.type === 'balanced') {
    tag.classList.add('is-balanced');
    tag.textContent = 'Balanced';
    headline.textContent = `Well matched at ${resLabel(state.resolution)}`;
  } else if (v.type === 'cpu') {
    tag.classList.add(severe ? 'is-severe' : 'is-cpu');
    tag.textContent = 'CPU-limited';
    headline.textContent = `The CPU holds it back by ${formatRange(v.range)}`;
  } else {
    tag.classList.add(severe ? 'is-severe' : 'is-gpu');
    tag.textContent = 'GPU-limited';
    headline.textContent = `The GPU is the limit by ${formatRange(v.range)}`;
  }

  // Confidence
  const conf = document.getElementById('confidence');
  conf.className = 'confidence ' + v.confidence;
  document.getElementById('confidence-text').textContent = v.confidence + ' confidence';

  // Meter marker
  const leanSign = state.cpu.score < state.gpu.score ? -1 : 1;
  const signed = v.type === 'cpu' ? -v.pct : v.type === 'gpu' ? v.pct : leanSign * v.pct;
  const pos = Math.max(4, Math.min(96, 50 + signed));
  const marker = document.getElementById('meter-marker');
  marker.style.left = pos + '%';
  document.getElementById('meter-value').textContent = v.type === 'balanced' ? 'In balance' : formatRange(v.range);

  // Utilisation
  setBar('cpu-util', v.cpuPct);
  setBar('gpu-util', v.gpuPct);

  // FPS (use internal render resolution when upscaling, matching the site)
  const fpsRes = state.upscaling ? (state.resolution === '4k' ? '1440p' : '1080p') : state.resolution;
  const f = estimateFPS(state.cpu.score, state.gpu.score, fpsRes, 'balanced');
  document.getElementById('fps-num').textContent = f.fps;
  document.getElementById('fps-sub').textContent = `~${f.low}-${f.high} fps · balanced settings`;

  // Explanation
  document.getElementById('explanation').textContent =
    explain(state.cpu.name, state.gpu.name, state.resolution, state.genre, state.upscaling, v);
}

function setBar(prefix, pct) {
  document.getElementById(prefix + '-val').textContent = pct + '%';
  document.getElementById(prefix + '-fill').style.width = pct + '%';
}

/* ---------------- URL state ---------------- */
function syncURL() {
  const p = new URLSearchParams();
  if (state.cpu) p.set('cpu', state.cpu.id);
  if (state.gpu) p.set('gpu', state.gpu.id);
  p.set('res', state.resolution);
  if (state.genre !== 'mixed') p.set('genre', state.genre);
  if (state.upscaling) p.set('up', '1');
  history.replaceState(null, '', p.toString() ? '?' + p.toString() : location.pathname);
}

function loadFromURL(cpuCombo, gpuCombo) {
  const p = new URLSearchParams(location.search);
  const res = p.get('res');
  if (res && ['1080p', '1440p', '4k'].includes(res)) pickSegment('seg-res', res, 'resolution');
  const genre = p.get('genre');
  if (genre && ['mixed', 'esports', 'aaa', 'simulation', 'mmo'].includes(genre)) pickSegment('seg-genre', genre, 'genre');
  if (p.get('up') === '1') document.getElementById('toggle-upscale').click();
  if (p.get('cpu')) cpuCombo.selectById(p.get('cpu'));
  if (p.get('gpu')) gpuCombo.selectById(p.get('gpu'));
}

function pickSegment(id, val, key) {
  const group = document.getElementById(id);
  group.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.val === val)));
  state[key] = val;
}

/* ---------------- Util ---------------- */
function resLabel(r) { return r === '4k' ? '4K' : r; }
function escapeHtml(s) { return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/* ---------------- Init ---------------- */
const cpuCombo = setupCombo('cpu', CPUS);
const gpuCombo = setupCombo('gpu', GPUS);
setupSegmented('seg-res', 'resolution');
setupSegmented('seg-genre', 'genre');
setupToggle();
loadFromURL(cpuCombo, gpuCombo);
render_result();
