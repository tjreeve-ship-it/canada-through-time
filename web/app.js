/* Canada Through Time — map + timelapse engine.
 * One code path drives both the interactive explorer and the frame-exact video renderer:
 * everything visible is a pure function of (story, format, frame).
 */
const { Deck, OrbitView, GeoJsonLayer, TextLayer, LightingEffect, AmbientLight, DirectionalLight, COORDINATE_SYSTEM } = deck;

const params = new URLSearchParams(location.search);
const STORY_ID = params.get('story') || 'population-provinces-1971-2026';
const RENDER = params.get('render') === '1';
const SCALE = parseFloat(params.get('scale') || '1'); // 2 = 4K

const NTNU_SPLIT = '1991-07-01';
const ORDER = ['NL', 'PE', 'NS', 'NB', 'QC', 'ON', 'MB', 'SK', 'AB', 'BC', 'YT', 'NT', 'NU'];
const KM_PER_MILLION = 55; // prism height scale

// ---------- colour: diverging, decline (red) <- grey -> growth (blue) ----------
const NEG_MIN = -0.30, POS_MAX = 2.00;
const STOPS = [
  [-0.30, '#d03b3b'], [-0.12, '#e66767'], [0, '#8f8e88'],
  [0.40, '#86b6ef'], [1.00, '#5598e7'], [2.00, '#2a78d6'],
];
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
function colorFor(chg) {
  const c = Math.max(NEG_MIN, Math.min(POS_MAX, chg));
  for (let i = 1; i < STOPS.length; i++) {
    if (c <= STOPS[i][0]) {
      const [a, ca] = STOPS[i - 1], [b, cb] = STOPS[i];
      const t = (c - a) / (b - a), A = hex(ca), B = hex(cb);
      return A.map((v, k) => Math.round(v + (B[k] - v) * t));
    }
  }
  return hex(STOPS[STOPS.length - 1][1]);
}
const cssColor = c => `rgb(${c.join(',')})`;
const pctPos = v => ((v - NEG_MIN) / (POS_MAX - NEG_MIN)) * 100;

// ---------- formatting ----------
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const fmtDate = d => { const [y, m, dd] = d.split('-').map(Number); return `${MONTHS[m - 1]} ${dd}, ${y}`; };
const fmtMonthYear = d => { const [y, m] = d.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };
const fmtInt = n => n.toLocaleString('en-CA');
function fmtPop(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 1 : 2) + 'M';
  return Math.round(n / 1000) + 'K';
}
const fmtPct = p => { const r = Math.round(p * 100); return r === 0 ? '0%' : (r > 0 ? '+' : '−') + Math.abs(r) + '%'; };
const lerp = (a, b, t) => a + (b - a) * t;

// ---------- load ----------
async function getJSON(u) { const r = await fetch(u); if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); }
function toKm(fc) {
  const conv = c => typeof c[0] === 'number' ? [c[0] / 1000, c[1] / 1000] : c.map(conv);
  for (const f of fc.features) {
    f.geometry.coordinates = conv(f.geometry.coordinates);
    if (f.properties.lx != null) { f.properties.lx /= 1000; f.properties.ly /= 1000; }
  }
  return fc;
}

const [story, pop, provinces, ntnu, countries, lakes] = await Promise.all([
  getJSON(`stories/${STORY_ID}.json`), getJSON('data/population.json'),
  getJSON('data/provinces.geojson').then(toKm), getJSON('data/ntnu_combined.geojson').then(toKm),
  getJSON('data/context_countries.geojson').then(toKm), getJSON('data/lakes.geojson').then(toKm),
]);

const dates = pop.dates;
const i0 = dates.indexOf(story.start), i1 = dates.indexOf(story.end);
if (i0 < 0 || i1 < 0) throw new Error('Story dates not in dataset');
const S = pop.series;

// base value for colour = first available value on/after story start (NT, NU start Jul 1991)
const base = {};
for (const k of [...ORDER, 'NT+NU', 'CAN']) {
  for (let i = i0; i <= i1; i++) if (S[k][i] != null) { base[k] = { v: S[k][i], date: dates[i] }; break; }
}
const maxEnd = Math.max(...ORDER.map(k => S[k][i1] || 0));

const featsSplit = provinces.features;
const featsCombined = [...provinces.features.filter(f => f.properties.abbr !== 'NT' && f.properties.abbr !== 'NU'), ...ntnu.features];

// milestones derived from the data itself (reproducible)
const derivedAnnotations = (story.milestones || []).map(m => {
  for (let i = i0; i <= i1; i++) if (S.CAN[i] >= m) return {
    date: dates[i], kind: 'derived',
    text: `Canada passes ${m / 1e6} million people`,
    source: `Derived: first quarterly estimate ≥ ${fmtInt(m)} (${fmtInt(S.CAN[i])}), Table 17-10-0009-01`,
  };
  return null;
}).filter(Boolean);
const annotations = [...story.annotations, ...derivedAnnotations]
  .map(a => ({ ...a, idx: dates.indexOf(a.date) >= 0 ? dates.indexOf(a.date) : dates.findIndex(d => d >= a.date) }))
  .filter(a => a.idx >= i0 && a.idx <= i1)
  .sort((a, b) => a.idx - b.idx);

// ---------- time model ----------
const fps = story.fps, sec = story.seconds;
const frameCount = Math.round((sec.intro + sec.play + sec.outro) * fps);
function timeAt(frame) {
  const t = frame / fps;
  const p = Math.max(0, Math.min(1, (t - sec.intro) / sec.play));
  return { p, pos: i0 + p * (i1 - i0), t };
}

// ---------- format / layout ----------
const stage = document.getElementById('stage');
let fmtKey = params.get('fmt') || '16x9';
let W, H;
const MAP_INSETS = { // where the map sits inside the frame, in design px (u = 1)
  '16x9': { l: 420, r: 560, t: 150, b: 90 },
  '9x16': { l: 0, r: 0, t: 470, b: 760 },
  '1x1': { l: 300, r: 0, t: 190, b: 170 },
};
function applyFormat(key) {
  fmtKey = key;
  const f = story.formats[key];
  W = f.width * SCALE; H = f.height * SCALE;
  const u = Math.min(W, H) / 1080;
  stage.className = 'fmt-' + key;
  stage.style.width = W + 'px'; stage.style.height = H + 'px';
  stage.style.setProperty('--u', u + 'px');
  if (!RENDER) {
    const s = Math.min(innerWidth / W, (innerHeight - 70) / H);
    stage.style.transform = `translate(${(innerWidth - W * s) / 2}px, 0) scale(${s})`;
  } else stage.style.transform = 'none';
  return u;
}
let U = applyFormat(fmtKey);

// ---------- static DOM ----------
document.getElementById('title').innerHTML = story.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/(\d{4}–\d{4})/, '<span style="white-space:nowrap">$1</span>');
document.getElementById('subtitle').textContent = story.subtitle;
document.getElementById('legend-base').textContent = fmtMonthYear(story.start) + ' (NT, NU: July 1991)';
document.getElementById('legend-bar').style.background = 'linear-gradient(90deg,' +
  STOPS.map(([v, c]) => `${c} ${pctPos(v).toFixed(2)}%`).join(',') + ')';
document.getElementById('legend-ticks').innerHTML = [-0.3, 0, 0.5, 1, 2]
  .map(v => `<span style="left:${pctPos(v)}%">${v === 0 ? '0' : (v === 2 ? '≥ ' : '') + fmtPct(v)}</span>`).join('');
const prelim = pop.status.CAN[i1] === 'p' || story.end >= '2026-07-01';
document.getElementById('credits').innerHTML =
  `Source: Statistics Canada, Table 17-10-0009-01, Population estimates, quarterly (doi.org/10.25318/1710000901-eng)` +
  `${prelim ? '; ' + fmtMonthYear(story.end) + ' estimates are preliminary' : ''}. ` +
  `Figures are the latest published quarter; prisms move smoothly between quarterly estimates. ` +
  `NT and NU were reported only as a combined total before July 1991. ` +
  `Boundaries: Natural Earth (public domain), current boundaries, Statistics Canada Lambert projection.`;

const ranking = document.getElementById('ranking');
ranking.innerHTML = `<div class="rank-head"><span></span><span>Population</span><span></span><span>Change</span></div>`;
const rows = {};
for (const k of [...ORDER, 'NT+NU']) {
  const el = document.createElement('div');
  el.className = 'row';
  el.innerHTML = `<span class="ab"></span><span class="track"><span class="bar"></span></span><span class="val"></span><span class="chg"></span>`;
  el.querySelector('.ab').textContent = k === 'NT+NU' ? 'NT·NU' : k;
  ranking.appendChild(el);
  rows[k] = el;
}

// ---------- deck ----------
const lighting = new LightingEffect({
  ambient: new AmbientLight({ color: [255, 255, 255], intensity: 0.75 }),
  key: new DirectionalLight({ color: [255, 246, 232], intensity: 0.85, direction: [-3, -6, -9] }),
  fill: new DirectionalLight({ color: [170, 200, 255], intensity: 0.35, direction: [4, 3, -3] }),
});
const mapEl = document.getElementById('map');
const theDeck = new Deck({
  parent: mapEl,
  views: new OrbitView({ orbitAxis: 'Z', fovy: 30 }),
  controller: false,
  effects: [lighting],
  useDevicePixels: 1,
  glOptions: { preserveDrawingBuffer: true },
  initialViewState: { target: [6200, 2300, 0], zoom: -3, rotationX: 40, rotationOrbit: 0 },
  parameters: { clearColor: [0, 0, 0, 0] },
});

function placeMap() {
  const m = MAP_INSETS[fmtKey];
  Object.assign(mapEl.style, { left: m.l * U + 'px', right: m.r * U + 'px', top: m.t * U + 'px', bottom: m.b * U + 'px' });
  const w = W - (m.l + m.r) * U, h = H - (m.t + m.b) * U;
  theDeck.setProps({ width: w, height: h });
  return Math.log2(Math.min(w / 5900, h / 4300));
}
let fitZoom = placeMap();

function cameraAt(p) {
  const ks = story.camera;
  let a = ks[0], b = ks[ks.length - 1];
  for (let i = 1; i < ks.length; i++) if (p <= ks[i].t) { a = ks[i - 1]; b = ks[i]; break; }
  let t = b.t === a.t ? 0 : (p - a.t) / (b.t - a.t);
  t = t * t * (3 - 2 * t); // smoothstep between keyframes
  return {
    target: a.target.map((v, i) => lerp(v, b.target[i], t)),
    zoom: fitZoom + lerp(a.zoomOffset, b.zoomOffset, t),
    rotationX: lerp(a.rotationX, b.rotationX, t),
    rotationOrbit: lerp(a.rotationOrbit, b.rotationOrbit, t),
  };
}

// ---------- the pure frame function ----------
let freeCamera = false, lastView = null;
function render(frame) {
  const { p, pos } = timeAt(frame);
  const lo = Math.floor(pos + 1e-9), hi = Math.min(lo + 1, i1), f = pos - lo;
  const obsDate = dates[lo];
  const split = obsDate >= NTNU_SPLIT;
  const keys = split ? ORDER : ORDER.filter(k => k !== 'NT' && k !== 'NU').concat('NT+NU');

  const visual = {}, shown = {}, chg = {};
  for (const k of keys) {
    const a = S[k][lo], b = S[k][hi] ?? a;
    visual[k] = lerp(a, b, f);           // smooth geometry only
    shown[k] = a;                        // numbers: latest observed quarter, never interpolated
    chg[k] = a / base[k].v - 1;
  }

  // map
  const feats = split ? featsSplit : featsCombined;
  const layers = [
    new GeoJsonLayer({
      id: 'countries', data: countries, coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
      filled: true, stroked: true, getFillColor: [22, 33, 52], getLineColor: [44, 58, 82], lineWidthMinPixels: 1 * U,
    }),
    new GeoJsonLayer({
      id: 'lakes', data: lakes, coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
      filled: true, stroked: false, getFillColor: [10, 17, 30],
    }),
    new GeoJsonLayer({
      id: 'prisms', data: feats, coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
      extruded: true, wireframe: true, filled: true,
      getElevation: d => (visual[d.properties.abbr] / 1e6) * KM_PER_MILLION + 4,
      getFillColor: d => colorFor(chg[d.properties.abbr]),
      getLineColor: [255, 255, 255, 40],
      material: { ambient: 0.32, diffuse: 0.62, shininess: 24, specularColor: [70, 74, 82] },
      updateTriggers: { getElevation: frame, getFillColor: lo },
    }),
    new TextLayer({
      id: 'labels', data: feats.filter(d => !['PE', 'NS', 'NB'].includes(d.properties.abbr) || fmtKey !== '9x16'),
      coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
      getPosition: d => [d.properties.lx, d.properties.ly, (visual[d.properties.abbr] / 1e6) * KM_PER_MILLION + 30],
      getText: d => d.properties.abbr === 'NT+NU' ? 'NT·NU' : d.properties.abbr,
      getSize: 15 * U, sizeUnits: 'pixels', fontWeight: 700,
      fontFamily: 'Inter, Segoe UI, Helvetica Neue, Arial, sans-serif',
      getColor: d => { const c = colorFor(chg[d.properties.abbr]); return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) > 140 ? [10, 16, 28, 240] : [244, 243, 240, 245]; },
      fontSettings: { sdf: true, fontSize: 64, buffer: 6 },
      characterSet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ·+',
      updateTriggers: { getPosition: frame, getColor: lo },
    }),
  ];
  const view = freeCamera && lastView ? lastView : cameraAt(p);
  if (!freeCamera) lastView = view;
  theDeck.setProps({ layers, viewState: freeCamera ? undefined : view, initialViewState: freeCamera ? lastView : undefined });

  // clock
  document.getElementById('year').textContent = obsDate.slice(0, 4);
  document.getElementById('asof').textContent = `Statistics Canada estimate for ${fmtDate(obsDate)}${pop.status.CAN[lo] ? ' (' + pop.status.CAN[lo] + ')' : ''}`;
  document.getElementById('total').textContent = fmtInt(S.CAN[lo]);
  const dc = S.CAN[lo] - base.CAN.v;
  document.getElementById('total-change').textContent =
    lo === i0 ? ' ' : `${dc >= 0 ? '+' : '−'}${(Math.abs(dc) / 1e6).toFixed(1)} million since ${story.start.slice(0, 4)} (${fmtPct(S.CAN[lo] / base.CAN.v - 1)})`;

  // ranking (rows positioned by rank of the observed value)
  const rowH = (fmtKey === '9x16' ? 36 : fmtKey === '1x1' ? 26 : 38) * U;
  const sorted = keys.slice().sort((a, b) => shown[b] - shown[a]);
  for (const k of Object.keys(rows)) rows[k].style.display = keys.includes(k) ? '' : 'none';
  sorted.forEach((k, r) => {
    const el = rows[k];
    el.style.top = r * rowH + 'px';
    el.style.height = rowH + 'px';
    const bar = el.querySelector('.bar');
    bar.style.width = Math.max(0.4, (shown[k] / maxEnd) * 100) + '%';
    bar.style.background = cssColor(colorFor(chg[k]));
    el.querySelector('.val').textContent = shown[k] >= 1e6 ? fmtPop(shown[k]) : fmtInt(Math.round(shown[k] / 100) * 100);
    el.querySelector('.chg').textContent = lo === i0 && !(k === 'NT' || k === 'NU') ? '' : fmtPct(chg[k]);
  });
  ranking.style.height = sorted.length * rowH + 'px';

  // annotation: the most recent one reached, shown for ~3.2 s of playback
  const qPerSec = (i1 - i0) / sec.play;
  const active = annotations.filter(a => pos >= a.idx && pos < a.idx + 3.2 * qPerSec).pop();
  const box = document.getElementById('annotation');
  if (active && p > 0) {
    box.classList.remove('hidden');
    document.getElementById('ann-date').textContent = fmtMonthYear(active.date) + (active.kind === 'data_note' ? ' · data note' : '');
    document.getElementById('ann-text').textContent = active.text;
    document.getElementById('ann-source').textContent = active.source;
  } else box.classList.add('hidden');

  document.getElementById('timeline-fill').style.width = p * 100 + '%';
  return { frame, obsDate, p };
}

// ---------- frame-exact handshake for the video renderer ----------
function nextPaint() { return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }
async function renderAndWait(frame) {
  const info = render(frame);
  theDeck.redraw('render');
  await nextPaint();
  return info;
}

window.CTT = {
  story, frameCount, fps,
  size: () => ({ width: W, height: H }),
  setFormat: async key => { U = applyFormat(key); fitZoom = placeMap(); await nextPaint(); },
  renderFrame: renderAndWait,
  annotations,
};

// warm-up: let fonts and shaders compile before anyone captures a frame
await document.fonts.ready;
for (let i = 0; i < 4; i++) await renderAndWait(0);
await new Promise(r => setTimeout(r, 400));
await renderAndWait(0);
window.CTT.ready = true;

// ---------- interactive explorer ----------
if (!RENDER) {
  const ctl = document.getElementById('controls'); ctl.classList.remove('hidden');
  const scrub = document.getElementById('scrub'), playBtn = document.getElementById('play');
  let frame = 0, playing = false, last = 0;
  const show = fr => { frame = fr; scrub.value = Math.round((fr / (frameCount - 1)) * 1000); render(fr); };
  scrub.oninput = () => { playing = false; playBtn.textContent = 'Play'; show(Math.round((scrub.value / 1000) * (frameCount - 1))); };
  playBtn.onclick = () => { playing = !playing; playBtn.textContent = playing ? 'Pause' : 'Play'; if (frame >= frameCount - 1) frame = 0; };
  document.getElementById('fmt').value = fmtKey;
  document.getElementById('fmt').onchange = async e => { await window.CTT.setFormat(e.target.value); show(frame); };
  document.getElementById('orbit').onchange = e => {
    freeCamera = e.target.checked;
    theDeck.setProps({ controller: freeCamera, onViewStateChange: ({ viewState }) => { lastView = viewState; theDeck.setProps({ viewState }); } });
    show(frame);
  };
  addEventListener('resize', async () => { await window.CTT.setFormat(fmtKey); show(frame); });
  const tick = ts => {
    if (playing && ts - last >= 1000 / fps) { last = ts; show(Math.min(frame + 1, frameCount - 1)); if (frame >= frameCount - 1) { playing = false; playBtn.textContent = 'Play'; } }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  show(0);
}
