// Growth-components Short ("Where Canada's growth came from"), built on the migration Short's engine. Pure function of the frame number.
// Data: explorer/components.json, built by pipeline/build_explorer_data.py from Statistics Canada table 17-10-0008-01 (July-June periods).
// Natural increase = births - deaths. Net international migration = immigrants - net emigration + net non-permanent residents.
// Printed numbers are published values for the year on screen. Column heights, tints and bar lengths glide between years as
// animation; that is disclosed on screen. Story text arrives in the configuration, written from computed figures.
const { Deck, OrbitView, GeoJsonLayer, PathLayer, ColumnLayer, TextLayer, BitmapLayer, COORDINATE_SYSTEM } = deck;
const CART = COORDINATE_SYSTEM.CARTESIAN;
const Q = new URLSearchParams(location.search);
const SC = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob((Q.get('studio') || '').replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))));
const J = u => fetch(u).then(r => { if (!r.ok) throw new Error(u); return r.json(); });
const toKm = fc => { const c = x => typeof x[0] === 'number' ? [x[0] / 1e3, x[1] / 1e3] : x.map(c);
  fc.features.forEach(f => { f.geometry.coordinates = c(f.geometry.coordinates); if (f.properties.lx != null) { f.properties.lx /= 1e3; f.properties.ly /= 1e3; } }); return fc; };
const [prov, ntnu, ctx, lakes, pop] = await Promise.all(['../data/provinces.geojson', '../data/ntnu_combined.geojson', '../data/context_countries.geojson', '../data/lakes.geojson', '../data/explorer/components.json'].map(J));
[prov, ntnu, ctx, lakes].forEach(toKm);
const relief = await new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = '../data/relief/relief_canada_3km.png'; });
await Promise.all(['600 20px "Public Sans"', '500 20px "Public Sans"', '400 20px "Public Sans"', '700 20px "Source Serif 4"', '600 20px "Source Serif 4"'].map(f => document.fonts.load(f)));

// ---------------------------------------------------------------- data
const PROV = ['NL', 'PE', 'NS', 'NB', 'QC', 'ON', 'MB', 'SK', 'AB', 'BC'];
const NAMES = { NL: 'Newfoundland and Labrador', PE: 'Prince Edward Island', NS: 'Nova Scotia', NB: 'New Brunswick', QC: 'Quebec', ON: 'Ontario', MB: 'Manitoba', SK: 'Saskatchewan', AB: 'Alberta', BC: 'British Columbia' };
const YR = []; for (let y = SC.years[0]; y <= SC.years[1]; y++) YR.push(y);
const K = YR.length;
const row = (g, y) => { const r = pop.data[g]?.[String(y)]; for (const k of ['births', 'deaths', 'immigrants', 'net_emigration', 'net_npr']) if (r?.[k] == null) throw new Error(`missing ${g} ${y} ${k}`); return r; };
const NI = Object.fromEntries(['CAN', ...PROV].map(g => [g, YR.map(y => row(g, y).births - row(g, y).deaths)]));
const NIM = Object.fromEntries(['CAN', ...PROV].map(g => [g, YR.map(y => row(g, y).immigrants - row(g, y).net_emigration + row(g, y).net_npr)]));
const SHARE = Object.fromEntries(PROV.map(g => [g, YR.map((y, k) => { const a = NIM[g][k], b = NI[g][k]; return a + b > 0 ? Math.max(0, Math.min(1, a / (a + b))) : (a > 0 ? 1 : 0); })]));
const CAN = YR.map(y => row('CAN', y));
const anchor = {}; prov.features.forEach(f => anchor[f.properties.abbr] = [f.properties.lx, f.properties.ly]); Object.assign(anchor, SC.anchors || {});
const fmt = n => Math.abs(n).toLocaleString('en-CA'), sgn = n => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(n);
const short = n => (n > 0 ? '+' : n < 0 ? '\u2212' : '') + (Math.abs(n) >= 1e5 ? Math.round(Math.abs(n) / 1e3) + 'K' : Math.abs(n) >= 1e3 ? (Math.abs(n) / 1e3).toFixed(1) + 'K' : Math.abs(n));
const mil = n => n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 1 : 2) + 'M' : Math.round(n / 1e3) + 'K';
const plab = p => `${p}\u2013${(p + 1) % 100 === 0 ? p + 1 : String(p + 1).slice(2)}`;
const lerp = (a, b, t) => a + (b - a) * t, clamp01 = x => Math.max(0, Math.min(1, x)), ease = t => t * t * (3 - 2 * t);
const at = (arr, u) => { const i = Math.max(0, Math.min(K - 1, Math.floor(u))), j = Math.min(K - 1, i + 1), t = clamp01(u - i); return lerp(arr[i], arr[j], t); };
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((x, i) => Math.round(lerp(x, b[i], t)));
const COL = { land: hex('#FBF8EF'), neigh: hex('#E6E2D4'), ocean: hex('#CADAE4'), bound: hex('#5E5844'), ink3: hex('#655F4E'), accent: hex('#B8472F'), deep: hex('#8E2F1C'),
  pale: hex('#EDC7B8'), lossPale: hex('#D3D8DD'), dim: hex('#E9E5DA'), top: hex('#D9603F'), kid: hex('#6F7A86') };
const PRELIM = new Set(SC.preliminary || []);

// ---------------------------------------------------------------- timeline
const fps = SC.fps || 30, nI = Math.round(SC.intro * fps), per = Math.round(SC.perYear * fps), nS = Math.round(SC.summary.seconds * fps), nO = Math.round(SC.outro * fps);
const beats = (SC.beats || []).map(b => ({ ...b, k: YR.indexOf(b.year), n: Math.round(b.hold * fps) })).sort((a, b) => a.k - b.k);
const SEG = [{ kind: 'intro', n: nI }];
YR.forEach((y, k) => { const b = beats.find(x => x.k === k); const h1 = Math.floor(per / 2);
  SEG.push({ kind: 'run', k, n: h1, u0: k - 0.5, u1: k }); if (b) SEG.push({ kind: 'beat', k, n: b.n, beat: b }); SEG.push({ kind: 'run', k, n: per - h1, u0: k, u1: k + 0.5 }); });
SEG.push({ kind: 'hold', k: K - 1, n: Math.round((SC.endHold || 0) * fps) }, { kind: 'summary', k: K - 1, n: nS }, { kind: 'outro', k: K - 1, n: nO });
let acc = 0; for (const s of SEG) { s.f0 = acc; acc += s.n; s.f1 = acc; }
const N = acc, fRun1 = SEG.find(s => s.kind === 'hold').f0, fSum = SEG.find(s => s.kind === 'summary').f0, fOut = SEG.find(s => s.kind === 'outro').f0;
function where(f) { const s = SEG.find(x => f >= x.f0 && f < x.f1) || SEG.at(-1); const t = s.n ? (f - s.f0) / s.n : 0;
  const u = s.kind === 'run' ? Math.max(0, Math.min(K - 1, lerp(s.u0, s.u1, t))) : s.kind === 'intro' ? 0 : s.k; return { s, t, u, k: s.k ?? 0 }; }

// ---------------------------------------------------------------- camera
const CAM = SC.cameras;
const keys = [[0, SC.introCam], [nI - 12, SC.introCam], [nI + 24, 'wide']];
for (const b of beats) { const s = SEG.find(x => x.beat === b); keys.push([s.f0 - 34, 'wide'], [s.f0 - 2, b.cam], [s.f1, b.cam], [s.f1 + 32, 'wide']); }
keys.push([fRun1, 'wide'], [fSum, 'end'], [N - 1, 'end']); keys.sort((a, b) => a[0] - b[0]);
function camAt(f) { let i = 0; while (i < keys.length - 2 && keys[i + 1][0] <= f) i++;
  const [fa, ca] = keys[i], [fb, cb] = keys[Math.min(i + 1, keys.length - 1)], t = fb > fa ? ease(clamp01((f - fa) / (fb - fa))) : 1, A = CAM[ca], B = CAM[cb];
  return { target: [lerp(A.t[0], B.t[0], t), lerp(A.t[1], B.t[1], t), 0], zoom: lerp(A.z, B.z, t) + 0.035 * Math.sin(f / 95), rotationX: lerp(A.x, B.x, t),
    rotationOrbit: lerp(A.o, B.o, t) + Math.sin(f / N * Math.PI * 2) * 1.6 }; }
function focusAt(f) {
  if (f < nI) return { set: new Set(SC.introFocus), a: clamp01((nI - 8 - f) / 10) * clamp01((f + 1) / 10) };
  for (const b of beats) { const s = SEG.find(x => x.beat === b), a = clamp01(Math.min(f - (s.f0 - 14), s.f1 + 14 - f) / 14); if (a > 0) return { set: new Set(b.focus), a }; }
  if (f >= fSum && f < fOut) return { set: new Set(SC.summary.focus), a: clamp01((f - fSum) / 12) * clamp01((fOut - f) / 12) };
  return { set: new Set(), a: 0 };
}

// ---------------------------------------------------------------- deck
const mapEl = document.getElementById('map');
const theDeck = new Deck({ parent: mapEl, views: new OrbitView({ orbitAxis: 'Z', fovy: 28 }), controller: false, initialViewState: { ...camAt(0) },
  useDevicePixels: +Q.get('ss') || 2, _animate: false, parameters: { clearColor: [0, 0, 0, 0] } });
const rings = f => f.geometry.type === 'Polygon' ? f.geometry.coordinates : f.geometry.coordinates.flat();
const outlines = prov.features.flatMap(f => rings(f).map(r => ({ abbr: f.properties.abbr, path: r })));
const combined = prov.features.filter(f => !['NT', 'NU'].includes(f.properties.abbr)).concat(ntnu.features);
const CALLOUT = SC.callouts || {}, KMPM = SC.kmPerMillion || 110;
function fillFor(g, u, foc) {
  let c = COL.land;
  if (SHARE[g]) { const m = clamp01((at(SHARE[g], u) - 0.2) / 0.8); c = m < 0.5 ? mix(COL.land, COL.pale, m * 2) : mix(COL.pale, COL.accent, (m - 0.5) * 2 * 0.8); }
  if (foc.a > 0 && !foc.set.has(g)) c = mix(c, COL.dim, 0.7 * foc.a);
  return c;
}
function layers(f) {
  const { u, k } = where(f), foc = focusAt(f), split = YR[Math.round(u)] >= 1991, L = [];
  L.push(new GeoJsonLayer({ id: 'ctx', data: ctx, coordinateSystem: CART, filled: true, stroked: false, getFillColor: [...COL.neigh, 255], parameters: { depthTest: false } }));
  L.push(new GeoJsonLayer({ id: 'land', data: split ? prov.features : combined, coordinateSystem: CART, filled: true, stroked: false, parameters: { depthTest: false },
    getFillColor: ft => [...fillFor(ft.properties.abbr, u, foc), 255], updateTriggers: { getFillColor: [f] } }));
  if (relief) { const [l, b, r, t] = SC.relief.b; L.push(new BitmapLayer({ id: 'relief', image: relief, coordinateSystem: CART, bounds: [[l, b, 0.2], [l, t, 0.2], [r, t, 0.2], [r, b, 0.2]], opacity: SC.relief.opacity, parameters: { depthTest: false } })); }
  L.push(new GeoJsonLayer({ id: 'lakes', data: lakes, coordinateSystem: CART, filled: true, stroked: false, getFillColor: [...COL.ocean, 255], parameters: { depthTest: false } }));
  L.push(new PathLayer({ id: 'bounds', data: outlines, coordinateSystem: CART, getPath: d => d.path, getColor: d => [...COL.bound, foc.a > 0 && foc.set.has(d.abbr) ? 230 : 120],
    getWidth: d => foc.a > 0 && foc.set.has(d.abbr) ? 1 + 1.6 * foc.a : 0.9, widthUnits: 'pixels', parameters: { depthTest: false }, updateTriggers: { getColor: [f], getWidth: [f] } }));
  const R = SC.columnRadius || 34, cols = [];
  for (const g of PROV) { const a = foc.a > 0 && !foc.set.has(g) ? 1 - 0.6 * foc.a : 1, p = anchor[g];
    cols.push({ p: [p[0] - R * 1.15, p[1]], h: Math.max(0, at(NI[g], u)) / 1000 * SC.kmPerThousand, c: [...COL.kid, Math.round(255 * a)] }, { p: [p[0] + R * 1.15, p[1]], h: Math.max(0, at(NIM[g], u)) / 1000 * SC.kmPerThousand, c: [...COL.accent, Math.round(255 * a)] }); }
  L.push(new ColumnLayer({ id: 'cols', data: cols, coordinateSystem: CART, diskResolution: 20, radius: R, extruded: true, getPosition: d => d.p, getElevation: d => d.h,
    getFillColor: d => d.c, material: { ambient: 0.55, diffuse: 0.6, shininess: 24, specularColor: [255, 230, 210] }, updateTriggers: { getElevation: [f], getFillColor: [f] } }));
  // value labels sit on the column tops; the printed number is the published July 1 value for the year on screen
  const lab = PROV.map(g => { const p = CALLOUT[g] || anchor[g]; return { g, p: [p[0], p[1], (CALLOUT[g] ? 6 : Math.max(0, at(NI[g], u), at(NIM[g], u)) / 1000 * SC.kmPerThousand + 22)], t: `${g}\n${short(NIM[g][k])}`,
    a: foc.a > 0 && !foc.set.has(g) ? 1 - 0.65 * foc.a : 1 }; });
  L.push(new PathLayer({ id: 'leaders', data: PROV.filter(g => CALLOUT[g]).map(g => ({ path: [[...anchor[g], 4], [...CALLOUT[g], 4]] })), coordinateSystem: CART, getPath: d => d.path,
    getColor: [...COL.ink3, 150], getWidth: 0.8, widthUnits: 'pixels', parameters: { depthTest: false } }));
  L.push(new TextLayer({ id: 'labels', data: lab, coordinateSystem: CART, getPosition: d => d.p, getText: d => d.t, sizeUnits: 'pixels', getSize: 15, lineHeight: 1.15,
    fontFamily: '"Public Sans", Arial, sans-serif', fontWeight: 600, characterSet: 'auto', getColor: d => [...COL.deep, Math.round(255 * d.a)],
    fontSettings: { sdf: true, fontSize: 64, buffer: 6 }, outlineWidth: 4, outlineColor: [...COL.land, 235], getTextAnchor: 'middle', getAlignmentBaseline: 'bottom',
    parameters: { depthTest: false }, updateTriggers: { getText: [k], getColor: [f], getPosition: [f] } }));
  return L;
}

// ---------------------------------------------------------------- page text
const $ = id => document.getElementById(id);
$('kicker').textContent = SC.kicker; $('race').querySelector('h2').textContent = SC.raceTitle; $('race-note').textContent = '';
$('credit').innerHTML = `${SC.credit}<span>${SC.sourceLine}</span>`;
$('track').querySelector('.a').textContent = plab(YR[0]); $('track').querySelector('.b').textContent = plab(YR.at(-1));
$('hook').innerHTML = `<div class="k">${SC.kicker}</div>` + SC.hook.map((t, i) => `<p class="${i ? 's' : ''}">${t}</p>`).join('') + (SC.hookNote ? `<p class="n">${SC.hookNote}</p>` : '');
$('summary').innerHTML = `<div class="k">${SC.summary.title}</div>` + SC.summary.items.map(it => `<div class="row ${it.dir}"><b>${it.big}</b><span><i>${it.place}</i>${it.text}</span></div>`).join('');
$('outro').innerHTML = `<h3>${SC.outro_card.title}</h3>` + SC.outro_card.lines.map(l => `<p class="${l.cls || ''}">${l.text}</p>`).join('');
function finding(k) { const pre = PRELIM.has(YR[k]) ? ' (preliminary)' : '', a = NIM.CAN[k], b = NI.CAN[k];
  return `Births minus deaths: <span class="down">${sgn(b)}</span>. International migration: <span class="up">${sgn(a)}</span>${pre}. Share from international: <b>${a + b > 0 ? Math.round(a / (a + b) * 100) + '%' : 'n/a'}</b>.`; }
let lastK = -1;
const svg = $('race-svg'), CW = 600, CH = 168, AXY = 128, BW = CW / K, VMAX = Math.max(...YR.map((y, k) => Math.max(0, NI.CAN[k]) + CAN[k].immigrants + Math.max(0, CAN[k].net_npr))), PX = (AXY - 6) / VMAX;
// Canada's growth by component, one bar per period, revealed as the timeline passes. Below the line: outflows (net emigration, negative net temporary residents).
function race(u, k, foc) {
  const shown = Math.min(K - 1, u + 0.5), cur = Math.round(u);
  let out = `<line x1="0" x2="${CW}" y1="${AXY}" y2="${AXY}" stroke="#1F1D14" stroke-opacity=".45"/>`;
  for (let i = 0; i < K; i++) { const grow = clamp01(shown - i + 1); if (grow <= 0) continue;
    const x = i * BW + 1, w = BW - 2, c = CAN[i], ni = NI.CAN[i], hl = i === cur ? 1 : 0.62, prelim = PRELIM.has(YR[i]);
    let up = AXY, dn = AXY; const seg = (v, col) => { const h = Math.abs(v) * PX * grow; if (v >= 0) { up -= h; out += `<rect x="${x.toFixed(1)}" y="${up.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${col}" opacity="${hl}"/>`; } else { out += `<rect x="${x.toFixed(1)}" y="${dn.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${col}" opacity="${hl}"/>`; dn += h; } };
    seg(ni, '#6F7A86'); seg(c.immigrants, '#B8472F'); seg(c.net_npr, '#E79A7E'); seg(-c.net_emigration, '#BDB6A6');
    if (prelim) out += `<rect x="${x.toFixed(1)}" y="0" width="${w.toFixed(1)}" height="${CH}" fill="url(#hatch)" opacity="${(0.5 * grow).toFixed(2)}"/>`; }
  out = `<defs><pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="4" stroke="#1F1D14" stroke-opacity=".25" stroke-width="1.2"/></pattern></defs>` + out
    + `<text x="0" y="${CH - 2}" font-family="Public Sans" font-size="11" fill="#655F4E">${plab(YR[0])}</text><text x="${CW}" y="${CH - 2}" text-anchor="end" font-family="Public Sans" font-size="11" fill="#655F4E">${plab(YR.at(-1))}${PRELIM.has(YR.at(-1)) ? ' (prelim.)' : ''}</text>`;
  svg.innerHTML = out;
}

// ---------------------------------------------------------------- frame
function renderFrame(f) {
  f = Math.max(0, Math.min(N - 1, Math.round(f)));
  const w = where(f), { u, k } = w, foc = focusAt(f), y = YR[k];
  theDeck.setProps({ viewState: camAt(f), layers: layers(f) });
  if (k !== lastK) { $('period').textContent = plab(y); $('period-sub').innerHTML = `July ${y} to<br>June ${y + 1}${PRELIM.has(y) ? ' (prelim.)' : ''}`; $('finding').innerHTML = finding(k); lastK = k; }
  $('track').querySelector('i').style.width = (clamp01((u + 0.5) / K) * 100).toFixed(2) + '%';
  race(u, k, foc);
  const fade = (a, b, n = 9) => clamp01(Math.min(f - a + 1, b - f) / n);
  $('hook').style.opacity = f < nI ? clamp01((nI - f) / 9) : 0; $('summary').style.opacity = f >= fSum && f < fOut ? fade(fSum, fOut) : 0; $('outro').style.opacity = f >= fOut ? clamp01((f - fOut + 1) / 12) : 0;
  $('top').style.opacity = Math.min(clamp01((f - nI + 1) / 9), 1 - clamp01((f - fSum + 1) / 9));
  const B = beats.find(b => { const s = SEG.find(x => x.beat === b); return f >= s.f0 - 10 && f < s.f1 + 12; });
  if (B) { const s = SEG.find(x => x.beat === B), a = clamp01(Math.min(f - (s.f0 - 10) + 1, s.f1 + 12 - f) / 10); const el = $('beat');
    el.querySelector('b').textContent = B.kicker; el.querySelector('span').textContent = B.text; el.style.opacity = a; el.style.maxWidth = (B.cardWidth || 470) + 'px'; el.style.top = (B.cardTop || 360) + 'px'; el.style.transform = `translateX(${((1 - ease(a)) * -18).toFixed(1)}px)`; }
  else $('beat').style.opacity = 0;
  return { frame: f, year: plab(y), phase: f < nI ? 'intro' : f >= fOut ? 'outro' : f >= fSum ? 'summary' : 'run', title: SC.title,
    finding: f < nI || f >= fSum ? '' : $('finding').innerText, annotation: B ? B.text : '' };
}
window.CTT = { ready: false, frameCount: N, fps, renderFrame, config: SC, years: YR.map(plab) };
window.CTX = { NI, NIM, SHARE, CAN, YR, SEG, beats, anchor, camAt, where, theDeck };
renderFrame(0);
setTimeout(() => { window.CTT.ready = true; }, 300);
