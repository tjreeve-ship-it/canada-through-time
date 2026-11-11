/* v2 — "Field Atlas" story frame, 9:16 and 16:9 (?fmt=).
 * All words on screen come from web/stories/<id>.ledger.json, generated from the claims ledger
 * (stories/<id>/ledger.yaml). Numbers that change with time come from the data and are re-verified by
 * pipeline/check_ledger.py against the frame log that renderFrame() returns.
 * Spikes = population (height) and change since baseline (colour). The map itself is a calm, neutral base.
 * Everything visible is a pure function of the frame number (same contract as v1: window.CTT).
 */
const { Deck, OrbitView, GeoJsonLayer, ColumnLayer, TextLayer, LineLayer, LightingEffect, AmbientLight, DirectionalLight, COORDINATE_SYSTEM } = deck;
const CART = COORDINATE_SYSTEM.CARTESIAN;

const params = new URLSearchParams(location.search);
const STORY_ID = params.get('story') || 'population-provinces-1971-2026';
const RENDER = params.get('render') === '1';
const SCALE = parseFloat(params.get('scale') || '1');
const SHOW_SAFE = params.get('safe') === '1';
const FMT = ['16x9', '9x16'].includes(params.get('fmt')) ? params.get('fmt') : '9x16';
const NTNU_SPLIT = '1991-07-01';
const PROV = ['NL', 'PE', 'NS', 'NB', 'QC', 'ON', 'MB', 'SK', 'AB', 'BC', 'YT', 'NT', 'NU'];
const KM_PER_MILLION = 70, SPIKE_RADIUS = 58;

// ---------- tokens from theme.css (single source of truth) ----------
if (params.get('palette')) document.body.classList.add('palette-' + params.get('palette'));
const css = getComputedStyle(document.body);
const tok = n => css.getPropertyValue('--' + n).trim();
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const T = Object.fromEntries(['water', 'land', 'land-neighbour', 'boundary', 'coast', 'ink-1', 'ink-2', 'ink-3', 'ground',
  'grow-1', 'grow-2', 'grow-3', 'grow-4', 'neutral', 'decline-1', 'decline-2', 'decline-3', 'accent'].map(k => [k, rgb(tok(k))]));

// change → colour. |change| < 2% is "no meaningful change" and stays neutral.
const DEAD = 0.02;
const GROW = [[DEAD, 'grow-1'], [0.5, 'grow-2'], [1.0, 'grow-3'], [2.0, 'grow-4']];
const DECL = [[-DEAD, 'decline-1'], [-0.10, 'decline-2'], [-0.25, 'decline-3']];
function ramp(stops, v) {
  const a = Math.abs(v);
  if (a <= Math.abs(stops[0][0])) return T[stops[0][1]];
  for (let i = 1; i < stops.length; i++) {
    const [x0, k0] = stops[i - 1], [x1, k1] = stops[i];
    if (a <= Math.abs(x1)) { const t = (a - Math.abs(x0)) / (Math.abs(x1) - Math.abs(x0)); return T[k0].map((c, j) => Math.round(c + (T[k1][j] - c) * t)); }
  }
  return T[stops[stops.length - 1][1]];
}
const colorFor = v => Math.abs(v) < DEAD ? T.neutral : v > 0 ? ramp(GROW, v) : ramp(DECL, v);
const cssc = c => `rgb(${c.join(',')})`;

// ---------- formatting ----------
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const fmtDate = d => { const [y, m, dd] = d.split('-').map(Number); return `${MONTHS[m - 1]} ${dd}, ${y}`; };
const fmtMY = d => { const [y, m] = d.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };
const fmtInt = n => n.toLocaleString('en-CA');
function sig3(n) { // one rule for every value on screen: 3 significant figures
  const [div, suf] = n >= 1e6 ? [1e6, 'M'] : [1e3, 'K'];
  const v = n / div, d = v >= 100 ? 0 : v >= 10 ? 1 : 2;
  return v.toFixed(d) + suf;
}
const fmtPct = p => { const r = Math.round(p * 100); return r === 0 ? '0%' : (r > 0 ? '+' : '−') + Math.abs(r) + '%'; };
const lerp = (a, b, t) => a + (b - a) * t;

// ---------- load ----------
const J = u => fetch(u).then(r => { if (!r.ok) throw new Error(u); return r.json(); });
const toKm = fc => { const c = x => typeof x[0] === 'number' ? [x[0] / 1e3, x[1] / 1e3] : x.map(c);
  fc.features.forEach(f => { f.geometry.coordinates = c(f.geometry.coordinates); if (f.properties.lx != null) { f.properties.lx /= 1e3; f.properties.ly /= 1e3; } }); return fc; };
const [story, TX, pop, provinces, ntnu, countries, lakes] = await Promise.all([
  J(`../stories/${STORY_ID}.json`), J(`../stories/${STORY_ID}.ledger.json`), J('../data/population.json'), J('../data/provinces.geojson').then(toKm),
  J('../data/ntnu_combined.geojson').then(toKm), J('../data/context_countries.geojson').then(toKm), J('../data/lakes.geojson').then(toKm)]);
await Promise.all(['600 32px "IBM Plex Sans"', '400 32px "IBM Plex Sans"', '700 32px "Source Serif 4"', '600 32px "Source Serif 4"', '400 20px "IBM Plex Mono"'].map(f => document.fonts.load(f)));

const V = story.v2, S = pop.series, dates = pop.dates;
function V_CALLOUTS() { return story.v2['callouts_' + FMT] || story.v2.callouts; }
const i0 = dates.indexOf(TX.start), i1 = dates.indexOf(TX.end);
const base = {};
for (const k of [...PROV, 'NT+NU', 'CAN']) for (let i = i0; i <= i1; i++) if (S[k][i] != null) { base[k] = { v: S[k][i], d: dates[i] }; break; }

// preliminary status: ledger revision classes (checked against Statistics Canada's table note 3)
const prelimFrom = TX.prelim_from;

// anchors: label points of each region (inside the province, not its population centre — stated on screen)
const anchor = {};
provinces.features.forEach(f => anchor[f.properties.abbr] = [f.properties.lx, f.properties.ly]);
anchor['NT+NU'] = [ntnu.features[0].properties.lx, ntnu.features[0].properties.ly];
// small Atlantic provinces: labels sit offshore with leader lines (pixel offsets at 1080 px wide)
const CALLOUT = V_CALLOUTS();

// ---------- events (annotations + derived milestones) ----------
// ---------- events: every card's tag, date, words and source line come from the ledger ----------
const events = TX.events.map(e => ({ ...e, idx: dates.findIndex(d => d >= e.date) }))
  .filter(e => e.idx >= i0 && e.idx <= i1).sort((a, b) => a.idx - b.idx);

// ---------- time model: steady playback that pauses briefly at each event ----------
const sec = V.seconds, fps = story.fps;
const rate = (i1 - i0) / sec.play; // quarters per second while playing
// Each card stays up at least card_seconds.minimum: if the next event (or the end) comes sooner, playback holds longer.
const CARD = TX.card_seconds;
const segs = []; { let t = sec.intro, p = i0;
  events.forEach((e, j) => { const dt = (e.idx - p) / rate; segs.push({ t0: t, t1: t + dt, p0: p, p1: e.idx }); t += dt; e.t = t;
    const travelNext = ((events[j + 1]?.idx ?? i1) - e.idx) / rate, hold = Math.max(sec.dwell, CARD.minimum - travelNext);
    segs.push({ t0: t, t1: t + hold, p0: e.idx, p1: e.idx }); t += hold; p = e.idx; });
  segs.push({ t0: t, t1: t + (i1 - p) / rate, p0: p, p1: i1 }); }
events.forEach((e, j) => { e.tEnd = Math.min(e.t + CARD.show, events[j + 1]?.t ?? Infinity); });
const playEnd = segs.at(-1).t1, total = playEnd + sec.outro;
const frameCount = Math.round(total * fps);
function posAt(t) {
  if (t <= sec.intro) return i0;
  for (const s of segs) if (t <= s.t1) return s.t1 === s.t0 ? s.p0 : lerp(s.p0, s.p1, (t - s.t0) / (s.t1 - s.t0));
  return i1;
}

// ---------- layout ----------
const stage = document.getElementById('stage');
const fmt = story.formats[FMT], W = fmt.width * SCALE, H = fmt.height * SCALE, U = SCALE;
stage.className = 'fmt-' + FMT;
stage.style.width = W + 'px'; stage.style.height = H + 'px'; stage.style.setProperty('--u', U + 'px');
if (!RENDER) { const s = Math.min(innerWidth / W, innerHeight / H); stage.style.transform = `translate(${(innerWidth - W * s) / 2}px,0) scale(${s})`; }

// static text
const LEG = TX.legend;
const md = s => s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
document.getElementById('kicker').textContent = TX.kicker;
document.getElementById('headline').textContent = TX.headline;
document.getElementById('leg-height').textContent = LEG.height;
document.getElementById('leg-ramp').innerHTML = `<span class="t">${LEG.ramp_title}<br><span style="color:var(--ink-3)">${LEG.ramp_sub}</span></span>` +
  LEG.ramp.map(([v, l]) =>
    `<span style="display:flex;flex-direction:column;align-items:center;gap:6px"><span class="sw" style="background:${cssc(colorFor(v))}"></span><span style="font-size:${18 * U}px;color:var(--ink-3)">${l}</span></span>`).join('');
document.getElementById('source').textContent = TX.source_note;
document.getElementById('share-y0').textContent = TX.start.slice(0, 4);

// share bars
const regions = V.regions;
const shareAt = i => { const keys = dates[i] >= NTNU_SPLIT ? PROV : PROV.filter(k => k !== 'NT' && k !== 'NU').concat('NT+NU');
  const tot = S.CAN[i]; return regions.map(r => r.members.filter(m => keys.includes(m)).reduce((a, m) => a + S[m][i], 0) / tot); };
const bar0 = document.getElementById('bar0'), bar1 = document.getElementById('bar1'), sl = document.getElementById('share-labels');
const sh0 = shareAt(i0);
bar0.innerHTML = sh0.map(s => `<span style="width:${s * 100}%"></span>`).join('');
bar1.innerHTML = regions.map(r => `<span data-k="${r.key}"></span>`).join('');
sl.innerHTML = regions.map(r => `<div data-k="${r.key}"><b>${r.short}</b><span></span></div>`).join('');

// timeline marks
const tlMarks = document.getElementById('tl-marks');
tlMarks.innerHTML = events.map(e => `<i style="left:${((e.idx - i0) / (i1 - i0)) * 100}%"></i>`).join('') +
  `<span style="left:0;transform:none">${TX.start.slice(0, 4)}</span><span style="left:auto;right:0;transform:none">${TX.end.slice(0, 4)}</span>`;

// end card: ledger wording; big numbers are ledger displays (recomputed by the checker)
document.querySelector('#end .lbl').textContent = TX.end_card.title;
document.getElementById('end-items').innerHTML = TX.end_card.items.map(it =>
  `<div class="end-item"><div class="big">${it.big}</div><div class="txt">${md(it.text)}</div></div>`).join('');
document.getElementById('end-next').textContent = TX.end_card.footer;

// safe-zone overlay for review (?safe=1)
const SAFE = FMT === '9x16'
  ? [[0, 0, 1080, 150, 'platform UI: top 150'], [0, 1580, 1080, 340, 'platform UI: bottom 340 (captions, buttons)'], [940, 1000, 140, 580, 'actions']]
  : [[0, 0, 1920, 54, 'title-safe 5%'], [0, 1026, 1920, 54, 'title-safe 5% / player controls'], [0, 0, 96, 1080, ''], [1824, 0, 96, 1080, '']];
if (SHOW_SAFE) { const z = document.getElementById('safe'); z.classList.remove('hidden');
  z.innerHTML = SAFE
    .map(([x, y, w, h, l]) => `<div class="z" style="left:${x * U}px;top:${y * U}px;width:${w * U}px;height:${h * U}px"><span>${l}</span></div>`).join(''); }

// ---------- deck ----------
const mapEl = document.getElementById('map');
const MW = (FMT === '16x9' ? 1240 : 1080) * U, MH = (FMT === '16x9' ? 860 : 760) * U;
const theDeck = new Deck({
  parent: mapEl, width: MW, height: MH, views: new OrbitView({ orbitAxis: 'Z', fovy: 28 }), controller: false, useDevicePixels: 1,
  glOptions: { preserveDrawingBuffer: true }, parameters: { clearColor: [0, 0, 0, 0] },
  effects: [new LightingEffect({
    amb: new AmbientLight({ color: [255, 255, 255], intensity: 0.9 }),
    key: new DirectionalLight({ color: [255, 248, 236], intensity: 0.9, direction: [-2, -5, -8] }),
  })],
  initialViewState: { target: [6200, 2300, 0], zoom: -3, rotationX: 40, rotationOrbit: 0 },
});
const fitZoom = Math.log2(Math.min(MW / 5500, MH / 4100));
function cam(p) {
  const [a, b] = V['camera_' + FMT] || V.camera; const t = p * p * (3 - 2 * p);
  return { target: a.target.map((v, i) => lerp(v, b.target[i], t)), zoom: fitZoom + lerp(a.zoomOffset, b.zoomOffset, t),
    rotationX: lerp(a.rotationX, b.rotationX, t), rotationOrbit: lerp(a.rotationOrbit, b.rotationOrbit, t) };
}

const baseLayers = [
  new GeoJsonLayer({ id: 'nb', data: countries, coordinateSystem: CART, filled: true, stroked: true, getFillColor: T['land-neighbour'], getLineColor: T.coast, lineWidthMinPixels: 1 }),
  new GeoJsonLayer({ id: 'lakes', data: lakes, coordinateSystem: CART, filled: true, stroked: false, getFillColor: T.water }),
];

function render(frame) {
  const t = frame / fps;
  const pos = posAt(t);
  const lo = Math.floor(pos + 1e-9), hi = Math.min(lo + 1, i1), f = pos - lo;
  const obs = dates[lo], split = obs >= NTNU_SPLIT;
  const keys = split ? PROV : PROV.filter(k => k !== 'NT' && k !== 'NU').concat('NT+NU');
  const vis = {}, shown = {}, chg = {};
  for (const k of keys) { const a = S[k][lo], b = S[k][hi] ?? a; vis[k] = lerp(a, b, f); shown[k] = a; chg[k] = a / base[k].v - 1; }
  const prog = (pos - i0) / (i1 - i0);
  const outro = t > playEnd;

  const pts = keys.map(k => ({ k, p: anchor[k] }));
  const top = k => (vis[k] / 1e6) * KM_PER_MILLION;
  const call = pts.filter(d => CALLOUT[d.k]), plain = pts.filter(d => !CALLOUT[d.k]);
  const layers = [
    ...baseLayers,
    new GeoJsonLayer({ id: 'land', data: split ? provinces : { type: 'FeatureCollection', features: provinces.features.filter(f => !['NT', 'NU'].includes(f.properties.abbr)).concat(ntnu.features) },
      coordinateSystem: CART, filled: true, stroked: true, getFillColor: T.land, getLineColor: T.boundary, lineWidthMinPixels: 1.2 * U }),
    new ColumnLayer({ id: 'spikes', data: pts, coordinateSystem: CART, diskResolution: 28, radius: SPIKE_RADIUS, extruded: true,
      getPosition: d => [d.p[0], d.p[1], 0], getElevation: d => top(d.k), getFillColor: d => colorFor(chg[d.k]),
      material: { ambient: 0.55, diffuse: 0.5, shininess: 16, specularColor: [40, 40, 40] }, updateTriggers: { getElevation: frame, getFillColor: lo } }),
    new TextLayer({ id: 'abbr', data: plain, coordinateSystem: CART, parameters: { depthTest: false }, getPosition: d => [d.p[0], d.p[1], top(d.k)],
      getText: d => d.k === 'NT+NU' ? 'NT+NU' : d.k, getPixelOffset: [0, -40 * U], getSize: 26 * U, fontFamily: 'IBM Plex Sans', fontWeight: 600,
      getColor: T['ink-1'], characterSet: 'auto', fontSettings: { sdf: true, fontSize: 64, buffer: 8 }, outlineWidth: 7, outlineColor: [...T.ground, 255],
      updateTriggers: { getPosition: frame } }),
    new TextLayer({ id: 'val', data: plain, coordinateSystem: CART, parameters: { depthTest: false }, getPosition: d => [d.p[0], d.p[1], top(d.k)],
      getText: d => sig3(shown[d.k]), getPixelOffset: [0, -14 * U], getSize: 23 * U, fontFamily: 'IBM Plex Sans', fontWeight: 400,
      getColor: T['ink-2'], characterSet: 'auto', fontSettings: { sdf: true, fontSize: 64, buffer: 8 }, outlineWidth: 7, outlineColor: [...T.ground, 255],
      updateTriggers: { getPosition: frame, getText: lo } }),
    new LineLayer({ id: 'leaders', data: call, coordinateSystem: CART, getSourcePosition: d => [d.p[0], d.p[1], top(d.k)],
      getTargetPosition: d => [CALLOUT[d.k][0], CALLOUT[d.k][1], 20], parameters: { depthTest: false }, getColor: T['ink-3'], getWidth: 1.5 * U, updateTriggers: { getSourcePosition: frame } }),
    new TextLayer({ id: 'callouts', data: call, coordinateSystem: CART, getPosition: d => [CALLOUT[d.k][0], CALLOUT[d.k][1], 20], parameters: { depthTest: false },
      getText: d => `${d.k} ${sig3(shown[d.k])}`, getPixelOffset: [0, 0],
      getTextAnchor: 'middle', getAlignmentBaseline: 'center', getSize: 22 * U, background: true, getBackgroundColor: [...T.ground, 235], backgroundPadding: [8 * U, 4 * U], fontFamily: 'IBM Plex Sans', fontWeight: 600,
      getColor: T['ink-1'], characterSet: 'auto', fontSettings: { sdf: true, fontSize: 64, buffer: 8 }, outlineWidth: 7, outlineColor: [...T.ground, 255],
      updateTriggers: { getPosition: frame, getText: lo } }),
  ];
  theDeck.setProps({ layers, viewState: cam(Math.min(1, Math.max(0, (t - sec.intro) / (playEnd - sec.intro)))) });

  // header
  document.getElementById('year').textContent = obs.slice(0, 4);
  document.getElementById('asof').textContent = `Statistics Canada estimate, ${fmtDate(obs)}${prelimFrom && obs >= prelimFrom ? ' (preliminary)' : ''}`;
  document.getElementById('total').textContent = fmtInt(S.CAN[lo]);
  const dc = S.CAN[lo] - base.CAN.v;
  document.getElementById('total-chg').textContent = lo === i0 ? 'people' : `${dc >= 0 ? '+' : '−'}${(Math.abs(dc) / 1e6).toFixed(1)} million since ${TX.start.slice(0, 4)} (${fmtPct(S.CAN[lo] / base.CAN.v - 1)})`;

  // share bar + labels
  const sh = shareAt(lo);
  document.getElementById('share-y1').textContent = obs.slice(0, 4);
  let acc = 0; const widthPx = bar1.offsetWidth;
  regions.forEach((r, j) => {
    const span = bar1.querySelector(`[data-k="${r.key}"]`); span.style.width = sh[j] * 100 + '%';
    span.className = sh[j] > sh0[j] + 0.005 ? 'hi' : '';
    const lab = sl.querySelector(`[data-k="${r.key}"]`);
    const centre = (acc + sh[j] / 2) * widthPx; acc += sh[j];
    lab.style.left = centre + 'px'; lab.style.display = sh[j] < 0.03 ? 'none' : '';
    lab.querySelector('span').textContent = (sh[j] * 100).toFixed(1) + '%';
  });
  const north = regions.findIndex(r => r.key === 'no');
  document.getElementById('share-title').textContent = LEG.share_title;

  // event card: from its event until card_seconds.show later or the next event (never less than card_seconds.minimum)
  const box = document.getElementById('card');
  const live = !outro && events.find(e => t >= e.t && t < e.tEnd);
  if (live) { box.classList.remove('off');
    document.getElementById('card-tag').textContent = live.tag;
    document.getElementById('card-date').textContent = live.display_date;
    document.getElementById('card-text').textContent = live.text;
    document.getElementById('card-src').textContent = live.source;
  } else box.classList.add('off');
  document.getElementById('end').classList.toggle('off', !outro);
  document.getElementById('tl-fill').style.width = prog * 100 + '%';
  tlMarks.querySelectorAll('i').forEach((el, j) => el.classList.toggle('past', pos >= events.at(j).idx));
  // frame log for pipeline/check_ledger.py: every visible text element, plus map labels and share values
  const dom = {};
  for (const el of stage.querySelectorAll('[id]')) {
    if (el.id === 'safe' || el.closest('.off') || el.closest('.hidden') || ['map', 'stage'].includes(el.id)) continue;
    if (el.querySelector('[id]')) continue; // leaf text containers only (the end card is read as a whole below)
    const txt = el.innerText.replace(/\s+/g, ' ').trim(); if (txt) dom[el.id] = txt; }
  if (outro) dom.end = document.getElementById('end').innerText.replace(/\s+/g, ' ').trim();
  const spikes = {}, callouts = {};
  for (const d of plain) spikes[d.k] = `${d.k} ${sig3(shown[d.k])}`;
  for (const d of call) callouts[d.k] = `${d.k} ${sig3(shown[d.k])}`;
  const share = Object.fromEntries(regions.map((r, j) => [r.key, [r.members, sh[j] < 0.03 ? null : (sh[j] * 100).toFixed(1) + '%']]));
  return { frame, obs, t: +t.toFixed(3), dom, spikes, callouts, share, end: outro,
    card: live ? { tag: live.tag, date: live.display_date, text: live.text, src: live.source } : null };
}

// ---------- frame-exact contract ----------
const paint = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
window.CTT = { story, frameCount, fps, events, renderFrame: async f => { const info = render(f); theDeck.redraw('render'); await paint(); render(f); theDeck.redraw('render'); await paint(); return info; } };
for (let i = 0; i < 3; i++) await window.CTT.renderFrame(0);
await new Promise(r => setTimeout(r, 300));
window.CTT.ready = true;

if (!RENDER) { let f = 0; const tick = () => { render(f); f = (f + 1) % frameCount; requestAnimationFrame(tick); }; if (params.get('play') === '1') tick(); else render(Number(params.get('frame') || 0)); }
