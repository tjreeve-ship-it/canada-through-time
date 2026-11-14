// v3 map Short: long-running weather stations, each coloured by its 10-year average annual temperature minus its own
// 1961–1990 average. Every frame is a pure function of its number (window.CTT.renderFrame), so renders are reproducible.
// Data: climate/ahccd.json (ECCC Adjusted and Homogenized Canadian Climate Data, annual mean temperature), with the same
// rules as the explorer's climate view: a baseline needs 25 of the 30 years 1961–1990, a 10-year window needs 8 of its
// 10 years. A station without enough data for a window is not drawn and not counted (never zero). Colours fade between
// consecutive windows as animation (disclosed on screen).
const Q = new URLSearchParams(location.search);
const SC = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob((Q.get('studio') || '').replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))));
const J = u => fetch(u).then(r => { if (!r.ok) throw new Error(u); return r.json(); });
const [A, P] = await Promise.all([J('../data/climate/ahccd.json'), J('../data/provinces.geojson')]);
await Promise.all(['600 20px "Public Sans"', '500 20px "Public Sans"', '700 20px "Source Serif 4"', '600 20px "Source Serif 4"'].map(f => document.fonts.load(f)));
const $ = id => document.getElementById(id);
const lerp = (a, b, t) => a + (b - a) * t, clamp01 = x => Math.max(0, Math.min(1, x)), ease = t => t * t * (3 - 2 * t);

// ---------------------------------------------------------------- data
const YR = []; for (let y = SC.years[0]; y <= SC.years[1]; y++) YR.push(y);   // window end years
const K = YR.length;
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const ST = [];
for (const s of A.stations) {
  if (!s.t) continue;
  const t = {}; s.t[1].forEach((v, i) => { if (v != null) t[s.t[0] + i] = v; });
  const b = []; for (let y = 1961; y <= 1990; y++) if (y in t) b.push(t[y]);
  if (b.length < 25) continue;
  const base = mean(b), an = YR.map(y => { const l = []; for (let x = y - 9; x <= y; x++) if (x in t) l.push(t[x]); return l.length >= 8 ? mean(l) - base : null; });
  ST.push({ id: s.id, name: s.name, prov: s.prov, xy: s.xy, an });
}
const COUNT = YR.map((y, k) => { let n = 0, up = 0; for (const s of ST) if (s.an[k] != null) { n++; up += s.an[k] > 0; } return [up, n]; });

// ---------------------------------------------------------------- timeline
const fps = SC.fps || 30;
const SEG = []; let acc = 0, u = 0;
for (const st of SC.plan) {
  const n = Math.round(st.s * fps);
  if (st.kind === 'run') { SEG.push({ ...st, n, u0: u, u1: st.to }); u = st.to; } else SEG.push({ ...st, n, u0: u, u1: u });
}
for (const s of SEG) { s.f0 = acc; acc += s.n; s.f1 = acc; }
const N = acc, fHook = Math.round(SC.hook.seconds * fps);
const shape = { linear: t => t, out: t => 1 - (1 - t) * (1 - t), in: t => t * t, inout: ease };
function where(f) {
  const s = SEG.find(x => f >= x.f0 && f < x.f1) || SEG.at(-1), t = s.n ? (f - s.f0) / s.n : 0;
  return { s, t, u: s.kind === 'run' ? lerp(s.u0, s.u1, (shape[s.ease] || shape.linear)(t)) : s.kind === 'loop' ? 0 : s.u0 };
}

// ---------------------------------------------------------------- map
const [MX0, MX1, MY0, MY1] = [3690.8, 9015.6, 658.9, 5241.9], W0 = 30, WID = 660, TOPY = 428;
const SCL = WID / (MX1 - MX0);
const sx = x => W0 + (x - MX0) * SCL, sy = y => TOPY + (MY1 - y) * SCL;
let outline = '';
for (const f of P.features) {
  const polys = f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates];
  for (const poly of polys) for (const ring of poly) {
    let d = '', lx = null, ly = null;
    ring.forEach(([x, y], i) => { const X = sx(x / 1000), Y = sy(y / 1000); if (i && Math.abs(X - lx) < 0.6 && Math.abs(Y - ly) < 0.6) return; d += (d ? 'L' : 'M') + X.toFixed(1) + ',' + Y.toFixed(1); lx = X; ly = Y; });
    outline += d + 'Z';
  }
}
const RAMP = SC.ramp;   // [cold, neutral, warm], range ±SC.range °C
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const [C0, C1, C2] = RAMP.map(hex);
const colour = a => { const t = Math.max(-1, Math.min(1, a / SC.range)), [p, q] = t < 0 ? [C1, C0] : [C1, C2], m = Math.abs(t);
  return `rgb(${p.map((v, i) => Math.round(lerp(v, q[i], m))).join(',')})`; };
const fmtC = a => (a > 0 ? '+' : a < 0 ? '−' : '±') + Math.abs(a).toFixed(1) + ' °C';
function legend() {
  const x = 40, y = 940, w = 220; let st = '';
  for (let i = 0; i <= 20; i++) st += `<stop offset="${i * 5}%" stop-color="${colour((i / 10 - 1) * SC.range)}"/>`;
  return `<defs><linearGradient id="lg">${st}</linearGradient></defs><rect x="${x}" y="${y}" width="${w}" height="12" rx="3" fill="url(#lg)"/>` +
    [[-SC.range, 'start', 0], [0, 'middle', w / 2], [SC.range, 'end', w]].map(([v, a, o]) => `<text x="${x + o}" y="${y + 32}" text-anchor="${a}" font-family="Public Sans" font-size="15" fill="#4A4636">${v === 0 ? 'same' : fmtC(v)}</text>`).join('') +
    `<text x="${x}" y="${y - 10}" font-family="Public Sans" font-size="15" font-weight="600" fill="#1F1D14">vs the station’s 1961–1990 average</text>`;
}
const LEG = legend();
function map(uu, alpha, focus) {
  const i = Math.max(0, Math.min(K - 1, Math.floor(uu))), j = Math.min(K - 1, i + 1), t = uu - i;
  let o = `<path d="${outline}" fill="#FBF8EF" stroke="#B9B19C" stroke-width="1" opacity="${alpha.toFixed(3)}"/>`, ring = '';
  for (const s of ST) {
    const a = s.an[i], b = s.an[j]; let v, op;
    if (a != null && b != null) { v = lerp(a, b, t); op = 1; } else if (a != null) { v = a; op = 1 - t; } else if (b != null) { v = b; op = t; } else continue;
    const fo = focus ? (focus.has(s.id) ? 1 : 0.15) : 1;
    o += `<circle cx="${sx(s.xy[0]).toFixed(1)}" cy="${sy(s.xy[1]).toFixed(1)}" r="6.4" fill="${colour(v)}" stroke="rgba(31,29,20,.35)" stroke-width=".8" opacity="${(op * alpha * fo).toFixed(3)}"/>`;
    if (focus && focus.has(s.id)) ring += `<circle cx="${sx(s.xy[0]).toFixed(1)}" cy="${sy(s.xy[1]).toFixed(1)}" r="13" fill="none" stroke="#1F1D14" stroke-width="2.5"/>`;
  }
  return o + ring + `<g opacity="${alpha.toFixed(3)}">${LEG}</g>`;
}

// ---------------------------------------------------------------- summary: share warmer, one bar per decade's window
function sumChart(grow) {
  const ks = YR.map((y, k) => k).filter(k => YR[k] % 10 === 0), W = 640, H = 200, bw = W / ks.length;
  let o = '';
  ks.forEach((k, i) => { const [up, n] = COUNT[k], sh = up / n, g = ease(clamp01(grow * ks.length - i)), h = sh * (H - 46) * g;
    o += `<rect x="${(i * bw + 3).toFixed(1)}" y="${(H - 24 - h).toFixed(1)}" width="${(bw - 6).toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${colour(sh >= 0.5 ? SC.range * 0.8 : -SC.range * 0.8)}"/>`;
    if (g > 0.98) o += `<text x="${(i * bw + bw / 2).toFixed(1)}" y="${(H - 30 - h).toFixed(1)}" text-anchor="middle" font-family="Public Sans" font-size="13" font-weight="600" fill="#1F1D14">${up < n && Math.round(sh * 100) === 100 ? (Math.floor(sh * 1000) / 10).toFixed(1) : Math.round(sh * 100)}%</text>`;
    o += `<text x="${(i * bw + bw / 2).toFixed(1)}" y="${H - 4}" text-anchor="middle" font-family="Public Sans" font-size="12" fill="#655F4E">${String(YR[k] - 9).slice(2)}–${String(YR[k]).slice(2)}</text>`; });
  return `<svg width="${W}" height="${H}">${o}</svg>`;
}

// ---------------------------------------------------------------- frame
$('kicker').textContent = SC.kicker; $('q').innerHTML = SC.hook.question; $('note').innerHTML = SC.note;
const sm = $('summary'); sm.querySelector('.kick').textContent = SC.summary.kicker; sm.querySelector('.big').textContent = SC.summary.big;
sm.querySelector('.line').innerHTML = SC.summary.line; sm.querySelector('.sub').innerHTML = SC.summary.sub;
function cueAt(f) {
  if (f <= 0) return '';
  const a = where(f), b = where(f - 1);
  if (a.s !== b.s && a.s.kind === 'beat' && a.s.sfx) return a.s.sfx;
  if (a.s !== b.s && a.s.kind === 'summary') return 'hit';
  if (a.s.kind === 'run' && a.s.riser && a.s.f1 - f === Math.round(1.6 * fps)) return 'riser';
  const ya = YR[Math.round(a.u)], yb = YR[Math.round(b.u)];
  if (a.s.kind === 'run' && ya !== yb && ya % 10 === 0) return 'tick';
  return '';
}
function renderFrame(f) {
  f = Math.max(0, Math.min(N - 1, Math.round(f)));
  const w = where(f), s = w.s, k = Math.round(w.u), y = YR[k];
  const inBeat = s.kind === 'beat', inSum = s.kind === 'summary', inLoop = s.kind === 'loop';
  const tIn = (n = 10) => clamp01((f - s.f0 + 1) / n), tOut = (n = 10) => clamp01((s.f1 - f) / n);
  const focus = inBeat && s.focus ? new Set(s.focus) : null;
  const sumA = inSum ? tIn(12) : inLoop ? clamp01(1 - (f - s.f0) / (s.n * 0.35)) : 0;
  const mapA = inSum ? 1 - tIn(12) : inLoop ? ease(clamp01(((f - s.f0) / s.n - 0.3) / 0.7)) : 1;
  $('chart').innerHTML = map(w.u, mapA, focus && Math.min(tIn(8), tOut(8)) > 0.5 ? focus : null);
  const [up, n] = COUNT[k];
  $('year').textContent = `${y - 9}–${String(y).slice(2)}`;
  $('yearbox').querySelector('.cnt').textContent = `${up} of ${n}`;
  $('yearbox').querySelector('.cl').textContent = 'stations warmer than their 1961–1990 average';
  $('yearbox').style.opacity = mapA.toFixed(3);
  $('head').style.opacity = (inSum ? 1 - tIn(12) : inLoop ? mapA : 1).toFixed(3);
  const bt = $('beat');
  if (inBeat) { const a = Math.min(tIn(9), tOut(9)); bt.querySelector('.kick').textContent = s.kicker; bt.querySelector('.big').textContent = s.big; bt.querySelector('.line').innerHTML = s.line;
    bt.style.opacity = a; bt.style.top = (s.cardTop || 560) + 'px'; bt.style.transform = `translateY(${((1 - ease(a)) * 24).toFixed(1)}px)`; } else bt.style.opacity = 0;
  sm.querySelector('.chart').innerHTML = sumChart(inSum ? clamp01((f - s.f0 - 8) / 40) : 1); sm.style.opacity = sumA.toFixed(3); sm.style.transform = `scale(${(0.96 + 0.04 * ease(inSum ? tIn(14) : 1)).toFixed(4)})`;
  $('glow').style.opacity = (inBeat ? Math.min(tIn(9), tOut(9)) : inSum ? sumA * 0.8 : 0).toFixed(3);
  $('flash').style.opacity = 0;
  for (let d = 0; d < 6; d++) { const c = cueAt(f - d); if (c === 'hit') { $('flash').style.opacity = (0.35 * (1 - d / 6)).toFixed(3); break; } }
  return { frame: f, year: `${y - 9}–${y}`, phase: f < fHook ? 'intro' : s.kind, title: SC.title, warmer: up, stations: n,
    annotation: inBeat ? `${s.kicker}: ${s.big}. ${s.line.replace(/<[^>]+>/g, '')}` : inSum ? `${SC.summary.big} ${SC.summary.line.replace(/<[^>]+>/g, '')}` : '', cue: cueAt(f) };
}
window.CTT = { ready: false, frameCount: N, fps, renderFrame, config: SC, years: YR.map(String) };
window.CTX = { ST, COUNT, YR, SEG, where };
renderFrame(0);
setTimeout(() => { window.CTT.ready = true; }, 300);
