/* v2 prototype — "Field Atlas" social frame (9:16).
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
const [story, pop, provinces, ntnu, countries, lakes] = await Promise.all([
  J(`../stories/${STORY_ID}.json`), J('../data/population.json'), J('../data/provinces.geojson').then(toKm),
  J('../data/ntnu_combined.geojson').then(toKm), J('../data/context_countries.geojson').then(toKm), J('../data/lakes.geojson').then(toKm)]);
await Promise.all(['600 32px "IBM Plex Sans"', '400 32px "IBM Plex Sans"', '700 32px "Source Serif 4"', '600 32px "Source Serif 4"', '400 20px "IBM Plex Mono"'].map(f => document.fonts.load(f)));

const V = story.v2, S = pop.series, dates = pop.dates;
function V_CALLOUTS() { return story.v2.callouts; }
const i0 = dates.indexOf(story.start), i1 = dates.indexOf(story.end);
const base = {};
for (const k of [...PROV, 'NT+NU', 'CAN']) for (let i = i0; i <= i1; i++) if (S[k][i] != null) { base[k] = { v: S[k][i], d: dates[i] }; break; }

// preliminary status read from Statistics Canada's own table note, not hard-coded
const prelimFrom = (() => { const n = pop.notes.find(x => /preliminary postcensal from/i.test(x)); if (!n) return null;
  const m = n.match(/preliminary postcensal from ([A-Z][a-z]+) (\d+), (\d{4})/); if (!m) return null;
  return `${m[3]}-${String(MONTHS.indexOf(m[1]) + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`; })();

// anchors: label points of each region (inside the province, not its population centre — stated on screen)
const anchor = {};
provinces.features.forEach(f => anchor[f.properties.abbr] = [f.properties.lx, f.properties.ly]);
anchor['NT+NU'] = [ntnu.features[0].properties.lx, ntnu.features[0].properties.ly];
// small Atlantic provinces: labels sit offshore with leader lines (pixel offsets at 1080 px wide)
const CALLOUT = V_CALLOUTS();

// ---------- events (annotations + derived milestones) ----------
const events = [
  ...story.annotations.map(a => ({ ...a, tag: a.kind === 'data_note' ? 'Data note' : 'Historical fact' })),
  ...(story.milestones || []).map(m => { const i = dates.findIndex((d, j) => j >= i0 && S.CAN[j] >= m);
    return i < 0 ? null : { date: dates[i], tag: 'Derived from the data', text: `Canada passes ${m / 1e6} million people`,
      source: `First quarterly estimate ≥ ${fmtInt(m)}: ${fmtInt(S.CAN[i])}` }; }).filter(Boolean),
].map(e => ({ ...e, idx: dates.findIndex(d => d >= e.date) })).filter(e => e.idx >= i0 && e.idx <= i1).sort((a, b) => a.idx - b.idx);

// ---------- time model: steady playback that pauses briefly at each event ----------
const sec = V.seconds, fps = story.fps;
const rate = (i1 - i0) / sec.play; // quarters per second while playing
const segs = []; { let t = sec.intro, p = i0;
  for (const e of events) { const dt = (e.idx - p) / rate; segs.push({ t0: t, t1: t + dt, p0: p, p1: e.idx }); t += dt; e.t = t; segs.push({ t0: t, t1: t + sec.dwell, p0: e.idx, p1: e.idx }); t += sec.dwell; p = e.idx; }
  segs.push({ t0: t, t1: t + (i1 - p) / rate, p0: p, p1: i1 }); }
const playEnd = segs.at(-1).t1, total = playEnd + sec.outro;
const frameCount = Math.round(total * fps);
function posAt(t) {
  if (t <= sec.intro) return i0;
  for (const s of segs) if (t <= s.t1) return s.t1 === s.t0 ? s.p0 : lerp(s.p0, s.p1, (t - s.t0) / (s.t1 - s.t0));
  return i1;
}

// ---------- layout ----------
const stage = document.getElementById('stage');
const fmt = story.formats['9x16'], W = fmt.width * SCALE, H = fmt.height * SCALE, U = SCALE;
stage.style.width = W + 'px'; stage.style.height = H + 'px'; stage.style.setProperty('--u', U + 'px');
if (!RENDER) { const s = Math.min(innerWidth / W, innerHeight / H); stage.style.transform = `translate(${(innerWidth - W * s) / 2}px,0) scale(${s})`; }

// static text
document.getElementById('kicker').textContent = V.kicker;
document.getElementById('headline').textContent = V.headline;
document.getElementById('leg-height').textContent = 'Height = people';
document.getElementById('leg-ramp').innerHTML = `<span class="t">Change since ${story.start.slice(0, 4)}<br><span style="color:var(--ink-3)">NT, NU since 1991</span></span>` +
  [[-0.1, '−10%'], [0, '±2%'], [0.5, '+50%'], [1, '+100%'], [2, '+200%']].map(([v, l]) =>
    `<span style="display:flex;flex-direction:column;align-items:center;gap:6px"><span class="sw" style="background:${cssc(colorFor(v))}"></span><span style="font-size:${18 * U}px;color:var(--ink-3)">${l}</span></span>`).join('');
document.getElementById('source').innerHTML =
  `Statistics Canada, Table 17-10-0009-01, quarterly estimates${prelimFrom ? `; ${fmtMY(prelimFrom)} preliminary` : ''}.<br>` +
  `Rounded to 3 significant figures. Spikes sit inside each province, not at its population centre. YT, NT, NU (under 0.5% of Canadians) omitted from the share bar.`;
document.getElementById('share-y0').textContent = story.start.slice(0, 4);

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
  `<span style="left:0;transform:none">${story.start.slice(0, 4)}</span><span style="left:auto;right:0;transform:none">${story.end.slice(0, 4)}</span>`;

// end card (computed, never typed)
{ const e = i1, g = k => S[k][e] / base[k].v - 1;
  const provs = ['NL', 'PE', 'NS', 'NB', 'QC', 'ON', 'MB', 'SK', 'AB', 'BC'].sort((a, b) => g(b) - g(a));
  const nm = { AB: 'Alberta', BC: 'B.C.', ON: 'Ontario', QC: 'Quebec', NL: 'Newfoundland and Labrador', SK: 'Saskatchewan', MB: 'Manitoba', NS: 'Nova Scotia', NB: 'New Brunswick', PE: 'P.E.I.' };
  const sh1 = shareAt(i1), atl = regions.findIndex(r => r.key === 'atl');
  document.getElementById('end-items').innerHTML = [
    [fmtPct(g('CAN')), `<b>Canada</b> grew from ${(base.CAN.v / 1e6).toFixed(1)} million to ${(S.CAN[e] / 1e6).toFixed(1)} million people.`],
    [fmtPct(g(provs[0])), `<b>${nm[provs[0]]}</b> grew fastest of the provinces, then ${nm[provs[1]]} (${fmtPct(g(provs[1]))}). Yukon: ${fmtPct(g('YT'))}.`],
    [`${(sh0[atl] * 100).toFixed(1)}→${(sh1[atl] * 100).toFixed(1)}%`, `<b>Atlantic Canada's share</b> of the population. ${nm[provs.at(-1)]} grew least (${fmtPct(g(provs.at(-1)))}).`],
  ].map(([b, t]) => `<div class="end-item"><div class="big">${b}</div><div class="txt">${t}</div></div>`).join('');
  document.getElementById('end-next').innerHTML = `These totals show <b>where</b> Canada grew, not why. Next story: births, deaths, immigration and moves between provinces.`; }

// safe-zone overlay for review (?safe=1)
if (SHOW_SAFE) { const z = document.getElementById('safe'); z.classList.remove('hidden');
  z.innerHTML = [[0, 0, 1080, 150, 'platform UI: top 150'], [0, 1580, 1080, 340, 'platform UI: bottom 340 (captions, buttons)'], [940, 1000, 140, 580, 'actions']]
    .map(([x, y, w, h, l]) => `<div class="z" style="left:${x * U}px;top:${y * U}px;width:${w * U}px;height:${h * U}px"><span>${l}</span></div>`).join(''); }

// ---------- deck ----------
const mapEl = document.getElementById('map');
const MW = W, MH = 760 * U;
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
  const [a, b] = V.camera; const t = p * p * (3 - 2 * p);
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
  document.getElementById('total-chg').textContent = lo === i0 ? 'people' : `${dc >= 0 ? '+' : '−'}${(Math.abs(dc) / 1e6).toFixed(1)} million since ${story.start.slice(0, 4)} (${fmtPct(S.CAN[lo] / base.CAN.v - 1)})`;

  // share bar + labels
  const sh = shareAt(lo);
  document.getElementById('share-y1').textContent = obs.slice(0, 4);
  let acc = 0; const widthPx = (876 - 84) * U;
  regions.forEach((r, j) => {
    const span = bar1.querySelector(`[data-k="${r.key}"]`); span.style.width = sh[j] * 100 + '%';
    span.className = sh[j] > sh0[j] + 0.005 ? 'hi' : '';
    const lab = sl.querySelector(`[data-k="${r.key}"]`);
    const centre = (acc + sh[j] / 2) * widthPx; acc += sh[j];
    lab.style.left = centre + 'px'; lab.style.display = sh[j] < 0.03 ? 'none' : '';
    lab.querySelector('span').textContent = (sh[j] * 100).toFixed(1) + '%';
  });
  const north = regions.findIndex(r => r.key === 'no');
  document.getElementById('share-title').textContent = `Share of Canadians · brighter = share rose since ${story.start.slice(0, 4)}`;

  // event card: shown for sec.card seconds after its event, or until the next event
  const box = document.getElementById('card');
  const live = !outro && events.filter(e => t >= e.t && t < e.t + sec.card).pop();
  if (live) { box.classList.remove('off');
    document.getElementById('card-tag').textContent = live.tag;
    document.getElementById('card-date').textContent = fmtMY(live.date);
    document.getElementById('card-text').textContent = live.short || live.text;
    document.getElementById('card-src').textContent = live.source;
  } else box.classList.add('off');
  document.getElementById('end').classList.toggle('off', !outro);
  document.getElementById('tl-fill').style.width = prog * 100 + '%';
  tlMarks.querySelectorAll('i').forEach((el, j) => el.classList.toggle('past', pos >= events.at(j).idx));
  return { frame, obs, t: +t.toFixed(3), event: live ? live.text : null };
}

// ---------- frame-exact contract ----------
const paint = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
window.CTT = { story, frameCount, fps, events, renderFrame: async f => { const info = render(f); theDeck.redraw('render'); await paint(); render(f); theDeck.redraw('render'); await paint(); return info; } };
for (let i = 0; i < 3; i++) await window.CTT.renderFrame(0);
await new Promise(r => setTimeout(r, 300));
window.CTT.ready = true;

if (!RENDER) { let f = 0; const tick = () => { render(f); f = (f + 1) % frameCount; requestAnimationFrame(tick); }; if (params.get('play') === '1') tick(); else render(Number(params.get('frame') || 0)); }
