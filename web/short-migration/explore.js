// Interprovincial migration Short. Every frame is a pure function of its frame number (CTT.renderFrame), so renders are reproducible.
// Data: flows.json, built by pipeline/build_explorer_data.py from Statistics Canada table 17-10-0045-01 (quarters summed to July-June periods).
// Printed figures are published values (or sums of them). Arc widths, dots, tints and bars glide between periods as animation; that is
// disclosed on screen. All story text (hook, beats, summary, source) arrives in the configuration, written from computed figures.
const { Deck, OrbitView, GeoJsonLayer, PathLayer, LineLayer, ScatterplotLayer, TextLayer, BitmapLayer, COORDINATE_SYSTEM } = deck;
const CART = COORDINATE_SYSTEM.CARTESIAN;
const Q = new URLSearchParams(location.search);
const SC = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob((Q.get('studio') || '').replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))));
const J = u => fetch(u).then(r => { if (!r.ok) throw new Error(u); return r.json(); });
const toKm = fc => { const c = x => typeof x[0] === 'number' ? [x[0] / 1e3, x[1] / 1e3] : x.map(c);
  fc.features.forEach(f => { f.geometry.coordinates = c(f.geometry.coordinates); if (f.properties.lx != null) { f.properties.lx /= 1e3; f.properties.ly /= 1e3; } }); return fc; };
const [prov, ntnu, ctx, lakes, flows] = await Promise.all(['../data/provinces.geojson', '../data/ntnu_combined.geojson', '../data/context_countries.geojson', '../data/lakes.geojson', '../data/explorer/flows.json'].map(J));
[prov, ntnu, ctx, lakes].forEach(toKm);
const relief = await new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = '../data/relief/relief_canada_3km.png'; });
await Promise.all(['600 20px "Public Sans"', '500 20px "Public Sans"', '400 20px "Public Sans"', '700 20px "Source Serif 4"', '600 20px "Source Serif 4"'].map(f => document.fonts.load(f)));

// ---------------------------------------------------------------- data
const PROV = ['NL', 'PE', 'NS', 'NB', 'QC', 'ON', 'MB', 'SK', 'AB', 'BC'];
const NAMES = { NL: 'Newfoundland and Labrador', PE: 'Prince Edward Island', NS: 'Nova Scotia', NB: 'New Brunswick', QC: 'Quebec', ON: 'Ontario', MB: 'Manitoba',
  SK: 'Saskatchewan', AB: 'Alberta', BC: 'British Columbia', YT: 'Yukon', NT: 'Northwest Territories', NU: 'Nunavut', 'NT+NU': 'Northwest Territories and Nunavut' };
const P0 = SC.periods[0], P1 = SC.periods[1], PER = []; for (let p = P0; p <= P1; p++) PER.push(p);
for (const p of PER) if (!flows.data[String(p)]) throw new Error('no flows for ' + p);
const K = PER.length;
const anchor = {}; prov.features.forEach(f => anchor[f.properties.abbr] = [f.properties.lx, f.properties.ly]); anchor['NT+NU'] = [ntnu.features[0].properties.lx, ntnu.features[0].properties.ly];
Object.assign(anchor, SC.anchors || {});   // a few anchors nudged so arcs meet the province, not its label (listed in the configuration)
const pairs = new Map();   // "O>D" -> per-period people
const net = Object.fromEntries(Object.keys(anchor).map(g => [g, new Array(K).fill(0)]));
PER.forEach((p, k) => { for (const [o, d, v] of flows.data[String(p)]) { const key = o + '>' + d; if (!pairs.has(key)) pairs.set(key, new Array(K).fill(0)); pairs.get(key)[k] = v; net[d][k] += v; net[o][k] -= v; } });
const cum = Object.fromEntries(PROV.map(g => { let s = 0; return [g, net[g].map(v => (s += v))]; }));
const VMAX = Math.max(...[...pairs.values()].flat());
const fmt = n => Math.abs(n).toLocaleString('en-CA'), sgn = n => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(n);
const short = n => { const a = Math.abs(n); return (n > 0 ? '+' : n < 0 ? '−' : '') + (a >= 1e5 ? Math.round(a / 1e3) + 'K' : a >= 1e3 ? (a / 1e3).toFixed(1) + 'K' : a); };
const plab = p => `${p}–${(p + 1) % 100 === 0 ? p + 1 : String(p + 1).slice(2)}`;
const lerp = (a, b, t) => a + (b - a) * t, clamp01 = x => Math.max(0, Math.min(1, x)), ease = t => t * t * (3 - 2 * t);
const at = (arr, u) => { const i = Math.max(0, Math.min(K - 1, Math.floor(u))), j = Math.min(K - 1, i + 1), t = clamp01(u - i); return lerp(arr[i], arr[j], t); };
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((x, i) => Math.round(lerp(x, b[i], t)));
const COL = { land: hex('#FBF8EF'), neigh: hex('#E6E2D4'), ocean: hex('#CADAE4'), coast: hex('#8C97A6'), bound: hex('#5E5844'), ink: hex('#1F1D14'), ink3: hex('#655F4E'),
  accent: hex('#B8472F'), deep: hex('#8E2F1C'), pale: hex('#EDC7B8'), glow: hex('#E0603F'), loss: hex('#6F7A86'), lossPale: hex('#D3D8DD'), dim: hex('#E9E5DA') };

// ---------------------------------------------------------------- timeline (frames)
const fps = SC.fps || 30, nI = Math.round(SC.intro * fps), per = Math.round(SC.perPeriod * fps), nS = Math.round(SC.summary.seconds * fps), nO = Math.round(SC.outro * fps);
const beats = (SC.beats || []).map(b => ({ ...b, k: PER.indexOf(b.period), n: Math.round(b.hold * fps) })).sort((a, b) => a.k - b.k);
// segments: intro, then each period slot (split at its middle where a beat holds the map still), then summary and outro
const SEG = [{ kind: 'intro', n: nI }];
PER.forEach((p, k) => { const b = beats.find(x => x.k === k); const h1 = Math.floor(per / 2);
  SEG.push({ kind: 'run', k, n: h1, u0: k - 0.5, u1: k }); if (b) SEG.push({ kind: 'beat', k, n: b.n, beat: b }); SEG.push({ kind: 'run', k, n: per - h1, u0: k, u1: k + 0.5 }); });
SEG.push({ kind: 'hold', k: K - 1, n: Math.round((SC.endHold || 0) * fps) }, { kind: 'summary', k: K - 1, n: nS }, { kind: 'outro', k: K - 1, n: nO });
let acc = 0; for (const s of SEG) { s.f0 = acc; acc += s.n; s.f1 = acc; }
const N = acc, fRun0 = SEG[1].f0, fRun1 = SEG.find(s => s.kind === 'hold').f0, fSum = SEG.find(s => s.kind === 'summary').f0, fOut = SEG.find(s => s.kind === 'outro').f0;
function where(f) { const s = SEG.find(x => f >= x.f0 && f < x.f1) || SEG.at(-1); const t = s.n ? (f - s.f0) / s.n : 0;
  const u = s.kind === 'run' ? Math.max(0, Math.min(K - 1, lerp(s.u0, s.u1, t))) : s.kind === 'intro' ? 0 : s.k;
  return { s, t, u, k: s.k ?? 0 }; }

// ---------------------------------------------------------------- camera: named shots, eased between keyframes
const CAM = SC.cameras;
const keys = [[0, SC.introCam], [nI - 12, SC.introCam], [nI + 20, 'wide']];
for (const b of beats) { const s = SEG.find(x => x.beat === b); keys.push([s.f0 - 34, 'wide'], [s.f0 - 2, b.cam], [s.f1, b.cam], [s.f1 + 32, 'wide']); }
keys.push([fRun1, 'wide'], [fSum, 'end'], [N - 1, 'end']);
keys.sort((a, b) => a[0] - b[0]);
function camAt(f) { let i = 0; while (i < keys.length - 2 && keys[i + 1][0] <= f) i++;
  const [fa, ca] = keys[i], [fb, cb] = keys[Math.min(i + 1, keys.length - 1)], t = fb > fa ? ease(clamp01((f - fa) / (fb - fa))) : 1, A = CAM[ca], B = CAM[cb];
  const drift = Math.sin(f / N * Math.PI * 2) * 1.6;   // a slow sway keeps the map alive while the camera is otherwise parked
  return { target: [lerp(A.t[0], B.t[0], t), lerp(A.t[1], B.t[1], t), 0], zoom: lerp(A.z, B.z, t) + 0.035 * Math.sin(f / 95), rotationX: lerp(A.x, B.x, t), rotationOrbit: lerp(A.o, B.o, t) + drift }; }

// ---------------------------------------------------------------- spotlight: provinces a beat (or the hook) is about
function focusAt(f) { // returns { set, a } with a in 0..1
  if (f < nI) return { set: new Set(SC.introFocus), a: clamp01((nI - 8 - f) / 10) * clamp01((f + 1) / 10) };
  for (const b of beats) { const s = SEG.find(x => x.beat === b), a = clamp01(Math.min(f - (s.f0 - 14), s.f1 + 14 - f) / 14); if (a > 0) return { set: new Set(b.focus), a, flow: b.flow }; }
  if (f >= fSum && f < fOut) return { set: new Set(SC.summary.focus), a: clamp01((f - fSum) / 12) * clamp01((fOut - f) / 12) };
  return { set: new Set(), a: 0 };
}

// ---------------------------------------------------------------- arc geometry (drawn by us, so the dots ride exactly on the curve)
const SEGS = 30;
const geom = new Map();
for (const key of pairs.keys()) { const [o, d] = key.split('>'), A = anchor[o], B = anchor[d]; if (!A || !B) continue;
  const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L, side = o < d ? 1 : -1, H = 0.2 * L + 60, bow = 0.07 * L * side;
  const pts = []; for (let i = 0; i <= SEGS; i++) { const t = i / SEGS, b = 4 * t * (1 - t); pts.push([A[0] + dx * t + nx * bow * b, A[1] + dy * t + ny * bow * b, 8 + H * b]); }
  geom.set(key, { o, d, L, pts, seed: ((o.charCodeAt(0) * 31 + d.charCodeAt(0) * 17 + (o.charCodeAt(1) || 0) * 7) % 97) / 97 }); }
const pointAt = (g, t) => { const x = t * SEGS, i = Math.min(SEGS - 1, Math.floor(x)), r = x - i, a = g.pts[i], b = g.pts[i + 1]; return [lerp(a[0], b[0], r), lerp(a[1], b[1], r), lerp(a[2], b[2], r)]; };

// ---------------------------------------------------------------- deck
const mapEl = document.getElementById('map');
const theDeck = new Deck({ parent: mapEl, views: new OrbitView({ orbitAxis: 'Z', fovy: 28 }), controller: false, initialViewState: { ...camAt(0) },
  useDevicePixels: +Q.get('ss') || 2, _animate: false, parameters: { clearColor: [0, 0, 0, 0] } });
const ringFeats = prov.features.filter(f => !['NT', 'NU'].includes(f.properties.abbr)).concat(ntnu.features);
const rings = f => f.geometry.type === 'Polygon' ? f.geometry.coordinates : f.geometry.coordinates.flat();
const outlines = prov.features.flatMap(f => rings(f).map(r => ({ abbr: f.properties.abbr, path: r })));
const CALLOUT = SC.callouts || {};

function fillFor(g, u, foc) {
  const v = net[g] ? at(net[g], u) : 0, m = Math.min(1, Math.sqrt(Math.abs(v) / (SC.netScale || 45000)));
  let c = Math.abs(v) < 400 ? COL.land : v > 0 ? (m < 0.5 ? mix(COL.land, COL.pale, m * 2) : mix(COL.pale, COL.accent, (m - 0.5) * 2)) : mix(COL.land, COL.lossPale, Math.min(1, m * 1.6));
  if (foc.a > 0 && !foc.set.has(g)) c = mix(c, COL.dim, 0.7 * foc.a);
  return c;
}
function layers(f) {
  const { u, k } = where(f), foc = focusAt(f), split = PER[Math.round(u)] >= 1991;
  const feats = split ? prov.features : ringFeats;
  const L = [];
  L.push(new GeoJsonLayer({ id: 'ctx', data: ctx, coordinateSystem: CART, filled: true, stroked: false, getFillColor: [...COL.neigh, 255], parameters: { depthTest: false } }));
  L.push(new GeoJsonLayer({ id: 'land', data: feats, coordinateSystem: CART, filled: true, stroked: false, parameters: { depthTest: false },
    getFillColor: ft => [...fillFor(ft.properties.abbr, u, foc), 255], updateTriggers: { getFillColor: [f] } }));
  if (relief) { const [l, b, r, t] = SC.relief.b; L.push(new BitmapLayer({ id: 'relief', image: relief, coordinateSystem: CART, bounds: [[l, b, 0.2], [l, t, 0.2], [r, t, 0.2], [r, b, 0.2]], opacity: SC.relief.opacity, parameters: { depthTest: false } })); }
  L.push(new GeoJsonLayer({ id: 'lakes', data: lakes, coordinateSystem: CART, filled: true, stroked: false, getFillColor: [...COL.ocean, 255], parameters: { depthTest: false } }));
  L.push(new PathLayer({ id: 'bounds', data: outlines, coordinateSystem: CART, getPath: d => d.path, getColor: d => [...COL.bound, foc.a > 0 && foc.set.has(d.abbr) ? 230 : 120],
    getWidth: d => foc.a > 0 && foc.set.has(d.abbr) ? 1 + 1.6 * foc.a : 0.9, widthUnits: 'pixels', parameters: { depthTest: false }, updateTriggers: { getColor: [f], getWidth: [f] } }));
  // arcs: width = people moving that period (square-root scale), muted at the origin, red at the destination
  const segs = [], dots = [];
  for (const [key, g] of geom) { const v = at(pairs.get(key), u); if (v < (SC.minFlow || 700)) continue;
    const s = Math.sqrt(v / VMAX), hot = !foc.flow || (g.o === foc.flow[0] && g.d === foc.flow[1]), touch = foc.set.has(g.o) || foc.set.has(g.d);
    const fade = foc.a > 0 ? lerp(1, hot && foc.flow ? 1 : touch && !foc.flow ? 1 : 0.18, foc.a) : 1;
    const w = 0.7 + 11 * s * (hot && foc.flow ? 1 + 0.5 * foc.a : 1);
    for (let i = 0; i < SEGS; i++) { const t = (i + 0.5) / SEGS, c = mix(COL.ink3, COL.accent, Math.pow(t, 0.8));
      segs.push({ a: g.pts[i], b: g.pts[i + 1], c: [...c, Math.round((60 + 180 * Math.pow(t, 0.7)) * (0.35 + 0.65 * Math.sqrt(s)) * fade)], w }); }
    // dots show direction only; their number follows the flow so busy routes look busy
    const n = Math.min(26, v / (SC.peoplePerDot || 1500)), T = 70 + g.L / 32;
    for (let j = 0; j < Math.ceil(n); j++) { const a = clamp01(n - j) * fade, t0 = (g.seed + j / Math.max(1, Math.ceil(n)) + f / T) % 1;
      for (let tr = 0; tr < 4; tr++) { const t = t0 - tr * 0.014; if (t < 0.02 || t > 0.985) continue;
        dots.push({ p: pointAt(g, t), r: (2.3 + 1.6 * s) * (1 - tr * 0.2), c: [...(tr ? COL.glow : COL.deep), Math.round(a * (tr ? 150 - tr * 40 : 235))] }); } } }
  L.push(new LineLayer({ id: 'arcs', data: segs, coordinateSystem: CART, getSourcePosition: d => d.a, getTargetPosition: d => d.b, getColor: d => d.c, getWidth: d => d.w,
    widthUnits: 'pixels', parameters: { depthTest: false }, updateTriggers: { getColor: [f], getWidth: [f] } }));
  L.push(new ScatterplotLayer({ id: 'dots', data: dots, coordinateSystem: CART, getPosition: d => d.p, getRadius: d => d.r, radiusUnits: 'pixels', getFillColor: d => d.c,
    parameters: { depthTest: false }, updateTriggers: { getPosition: [f], getFillColor: [f], getRadius: [f] } }));
  // labels: printed numbers are the published net for the period on screen
  const lab = PROV.map(g => { const v = net[g][k], p = CALLOUT[g] || anchor[g]; return { g, p: [p[0], p[1], 10], t: `${g}\n${short(v)}`, v,
    a: foc.a > 0 && !foc.set.has(g) ? 1 - 0.65 * foc.a : 1 }; });
  L.push(new PathLayer({ id: 'leaders', data: PROV.filter(g => CALLOUT[g]).map(g => ({ g, path: [[...anchor[g], 6], [...CALLOUT[g], 6]] })), coordinateSystem: CART, getPath: d => d.path,
    getColor: [...COL.ink3, 150], getWidth: 0.8, widthUnits: 'pixels', parameters: { depthTest: false } }));
  L.push(new TextLayer({ id: 'labels', data: lab, coordinateSystem: CART, getPosition: d => d.p, getText: d => d.t, sizeUnits: 'pixels', getSize: 15, lineHeight: 1.15,
    fontFamily: '"Public Sans", Arial, sans-serif', fontWeight: 600, characterSet: 'auto', getColor: d => [...(d.v > 0 ? COL.deep : d.v < 0 ? COL.ink3 : COL.ink3), Math.round(255 * d.a)],
    fontSettings: { sdf: true, fontSize: 64, buffer: 6 }, outlineWidth: 4, outlineColor: [...COL.land, 235], getTextAnchor: 'middle', getAlignmentBaseline: 'center',
    parameters: { depthTest: false }, updateTriggers: { getText: [k], getColor: [f] } }));
  return L;
}

// ---------------------------------------------------------------- page text
const $ = id => document.getElementById(id);
$('kicker').textContent = SC.kicker; $('race').querySelector('h2').textContent = SC.raceTitle; $('race-note').textContent = SC.raceNote;
$('credit').innerHTML = `${SC.credit}<span>${SC.sourceLine}</span>`;
$('track').querySelector('.a').textContent = plab(P0); $('track').querySelector('.b').textContent = plab(P1);
$('hook').innerHTML = `<div class="k">${SC.kicker}</div>` + SC.hook.map((t, i) => `<p class="${i ? 's' : ''}">${t}</p>`).join('') + (SC.hookNote ? `<p class="n">${SC.hookNote}</p>` : '');
$('summary').innerHTML = `<div class="k">${SC.summary.title}</div>` + SC.summary.items.map(it => `<div class="row ${it.dir}"><b>${it.big}</b><span><i>${it.place}</i>${it.text}</span></div>`).join('');
$('outro').innerHTML = `<h3>${SC.outro_card.title}</h3>` + SC.outro_card.lines.map(l => `<p class="${l.cls || ''}">${l.text}</p>`).join('');
function finding(k) { const r = PROV.map(g => [g, net[g][k]]).sort((a, b) => b[1] - a[1]), up = r[0], dn = r.at(-1);
  return `<span class="up">${NAMES[up[0]]} ${sgn(up[1])}</span> gained the most from other provinces. <span class="down">${NAMES[dn[0]]} ${sgn(dn[1])}</span> lost the most.`; }
let lastK = -1;

// cumulative race: rows ordered by a soft rank so bars slide past each other instead of jumping
const svg = $('race-svg'), RW = 600, AX = 300, BW = 238, RH = 16.5, CMAX = Math.max(...PROV.map(g => Math.max(...cum[g].map(Math.abs))));
function race(u, k, foc) {
  const v = Object.fromEntries(PROV.map(g => [g, at(cum[g], u)]));
  // order at the two neighbouring periods; rows slide between them as the bars grow, so a swap never jumps
  const order = i => { const o = PROV.slice().sort((a, b) => cum[b][i] - cum[a][i] || a.localeCompare(b)); return Object.fromEntries(o.map((g, r) => [g, r])); };
  const i0 = Math.max(0, Math.min(K - 1, Math.floor(u))), i1 = Math.min(K - 1, i0 + 1), tt = ease(clamp01(u - i0)), r0 = order(i0), r1 = order(i1);
  const rank = g => lerp(r0[g], r1[g], tt);
  let out = `<line x1="${AX}" x2="${AX}" y1="0" y2="${PROV.length * RH}" stroke="#1F1D14" stroke-opacity=".35"/>`;
  for (const g of PROV) { const y = rank(g) * RH, w = Math.abs(v[g]) / CMAX * BW, pos = v[g] >= 0, x = pos ? AX : AX - w, dim = foc.a > 0 && !foc.set.has(g) ? 1 - 0.55 * foc.a : 1;
    const shown = cum[g][k];
    out += `<g opacity="${dim.toFixed(3)}"><rect x="${x.toFixed(1)}" y="${(y + 3).toFixed(1)}" width="${Math.max(1, w).toFixed(1)}" height="${RH - 6}" rx="2" fill="${pos ? '#B8472F' : '#8C96A1'}"/>`
      + `<text x="${pos ? AX - 7 : AX + 7}" y="${(y + RH / 2 + 4).toFixed(1)}" text-anchor="${pos ? 'end' : 'start'}" font-family="Public Sans" font-weight="600" font-size="13" fill="#1F1D14">${g}</text>`
      + `<text x="${(pos ? AX + w + 6 : AX - w - 6).toFixed(1)}" y="${(y + RH / 2 + 4).toFixed(1)}" text-anchor="${pos ? 'start' : 'end'}" font-family="Public Sans" font-weight="500" font-size="13" fill="${pos ? '#8E2F1C' : '#4A4636'}">${sgn(shown)}</text></g>`; }
  svg.innerHTML = out;
}

// ---------------------------------------------------------------- frame
function renderFrame(f) {
  f = Math.max(0, Math.min(N - 1, Math.round(f)));
  const w = where(f), { u, k } = w, foc = focusAt(f), p = PER[k];
  theDeck.setProps({ viewState: camAt(f), layers: layers(f) });
  if (k !== lastK) { $('period').textContent = plab(p); $('period-sub').innerHTML = `July ${p} to<br>June ${p + 1}`; $('finding').innerHTML = finding(k); lastK = k; }
  $('track').querySelector('i').style.width = (clamp01((u + 0.5) / K) * 100).toFixed(2) + '%';
  race(u, k, foc);
  const fade = (a, b, n = 9) => clamp01(Math.min(f - a + 1, b - f) / n);
  const kHook = f < nI ? clamp01((nI - f) / 9) : 0, kSum = f >= fSum && f < fOut ? fade(fSum, fOut) : 0, kOut = f >= fOut ? clamp01((f - fOut + 1) / 12) : 0;
  $('hook').style.opacity = kHook; $('summary').style.opacity = kSum; $('outro').style.opacity = kOut;
  $('top').style.opacity = Math.min(clamp01((f - nI + 1) / 9), 1 - clamp01((f - fSum + 1) / 9));
  const B = beats.find(b => { const s = SEG.find(x => x.beat === b); return f >= s.f0 - 10 && f < s.f1 + 12; });
  if (B) { const s = SEG.find(x => x.beat === B), a = clamp01(Math.min(f - (s.f0 - 10) + 1, s.f1 + 12 - f) / 10); const el = $('beat');
    el.querySelector('b').textContent = B.kicker; el.querySelector('span').textContent = B.text; el.style.opacity = a; el.style.transform = `translateX(${((1 - ease(a)) * -18).toFixed(1)}px)`; }
  else $('beat').style.opacity = 0;
  return { frame: f, year: plab(p), phase: f < nI ? 'intro' : f >= fOut ? 'outro' : f >= fSum ? 'summary' : 'run', title: SC.title,
    finding: f < nI || f >= fSum ? '' : $('finding').innerText, annotation: B ? B.text : '', between: w.s.kind === 'run' ? [plab(PER[Math.floor(u)]), +(u % 1).toFixed(3)] : null };
}
window.CTT = { ready: false, frameCount: N, fps, renderFrame, config: SC, years: PER.map(plab) };
window.CTX = { net, cum, pairs, PER, SEG, beats, anchor, camAt, where, theDeck };
renderFrame(0);
setTimeout(() => { window.CTT.ready = true; }, 300);
