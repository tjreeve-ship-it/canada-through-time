// v3 falling-lines Short: glaciers' running mass-balance totals. Every frame is a pure function of its number
// (window.CTT.renderFrame), so renders are reproducible.
// Data: climate/glaciers.json, built by pipeline/ingest_climate.py from the WGMS Fluctuations of Glaciers database
// (glacier-wide annual mass balance, m water equivalent). A line's value for a year is the running sum of the published
// annual values from the glacier's first measured year through that year. A year with no published value is drawn as a gap
// and adds nothing; it is never treated as zero loss. Lines grow between years as animation (disclosed on screen).
const Q = new URLSearchParams(location.search);
const SC = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob((Q.get('studio') || '').replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))));
const J = u => fetch(u).then(r => { if (!r.ok) throw new Error(u); return r.json(); });
const G = await J('../data/climate/glaciers.json');
await Promise.all(['600 20px "Public Sans"', '500 20px "Public Sans"', '700 20px "Source Serif 4"', '600 20px "Source Serif 4"'].map(f => document.fonts.load(f)));
const $ = id => document.getElementById(id);
const lerp = (a, b, t) => a + (b - a) * t, clamp01 = x => Math.max(0, Math.min(1, x)), ease = t => t * t * (3 - 2 * t);

// ---------------------------------------------------------------- data
const YR = []; for (let y = SC.years[0]; y <= SC.years[1]; y++) YR.push(y);
const K = YR.length;
const S = SC.glaciers.map(g => {
  const rec = G.glaciers.find(x => x.name === g.name); if (!rec) throw new Error('no glacier ' + g.name);
  const [y0, vals] = rec.b; let run = 0; const cum = YR.map(() => null), pub = YR.map(() => false);
  vals.forEach((v, i) => { const k = y0 + i - YR[0]; if (v == null) return; run += v; if (k >= 0 && k < K) { cum[k] = +run.toFixed(3); pub[k] = true; } });
  if (y0 < YR[0]) throw new Error('series starts before window ' + g.name);
  return { ...g, y0, cum, k0: y0 - YR[0] };
});
const fmtM = v => (v < 0 ? '−' : v > 0 ? '+' : '') + Math.abs(v).toFixed(1) + ' m';
const lastAt = (s, k) => { for (let j = Math.min(k, K - 1); j >= 0; j--) if (s.cum[j] != null) return [j, s.cum[j]]; return null; };

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

// ---------------------------------------------------------------- chart geometry
const X0 = 52, X1 = 428, Y0 = 470, Y1 = 985, [VMIN, VMAX] = SC.yRange;
const px = k => X0 + (X1 - X0) * k / (K - 1), py = v => Y0 + (Y1 - Y0) * (VMAX - v) / (VMAX - VMIN);
function grid(alpha) {
  let o = `<g opacity="${alpha.toFixed(3)}">`;
  for (let v = 0; v >= VMIN; v -= SC.gridStep) {
    o += `<line x1="${X0}" x2="${X1 + 6}" y1="${py(v).toFixed(1)}" y2="${py(v).toFixed(1)}" stroke="${v === 0 ? '#8C8672' : '#D6CFBC'}" stroke-width="${v === 0 ? 1.5 : 1}"/>`;
    o += `<text x="${X0}" y="${(py(v) - 6).toFixed(1)}" font-family="Public Sans" font-size="14" fill="#655F4E">${v === 0 ? '0 (first year measured)' : fmtM(v)}</text>`;
  }
  for (const y of SC.xTicks) { const k = y - YR[0]; o += `<text x="${px(k).toFixed(1)}" y="${Y1 + 24}" text-anchor="middle" font-family="Public Sans" font-size="14" fill="#655F4E">${y}</text>`; }
  return o + '</g>';
}
function path(s, uu) {
  // segments between consecutive published years; a missing year breaks the line
  const kEnd = Math.floor(uu), t = uu - kEnd; let d = '', pen = false, tip = null;
  for (let k = s.k0; k <= Math.min(kEnd, K - 1); k++) {
    const v = s.cum[k]; if (v == null) { pen = false; continue; }
    d += (pen ? 'L' : 'M') + px(k).toFixed(1) + ',' + py(v).toFixed(1); pen = true; tip = [px(k), py(v)];
  }
  const kn = kEnd + 1;   // the next year's segment grows in as animation
  if (pen && t > 0 && kn < K && s.cum[kn] != null && s.cum[kEnd] != null) {
    const x = lerp(px(kEnd), px(kn), t), y = lerp(py(s.cum[kEnd]), py(s.cum[kn]), t); d += `L${x.toFixed(1)},${y.toFixed(1)}`; tip = [x, y];
  } else if (t > 0 && kn < K && s.cum[kn] != null && kn === s.k0) {   // first point appears
    tip = [px(kn), py(s.cum[kn])]; d += `M${tip[0].toFixed(1)},${tip[1].toFixed(1)}`;
  }
  return { d, tip };
}
function chart(uu, alpha, focus) {
  const k = Math.round(uu);
  let o = grid(alpha), labs = [];
  for (const s of S) {
    const { d, tip } = path(s, uu); if (!tip) continue;
    const a = alpha * (focus && !focus.has(s.name) ? 0.18 : 1);
    o += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width || 4}" stroke-linejoin="round" stroke-linecap="round" opacity="${a.toFixed(3)}"/>`;
    o += `<circle cx="${tip[0].toFixed(1)}" cy="${tip[1].toFixed(1)}" r="6" fill="${s.color}" stroke="#FBF8EF" stroke-width="2" opacity="${a.toFixed(3)}"/>`;
    const la = lastAt(s, k); if (la) labs.push({ s, y: tip[1], v: la[1], a });
  }
  // labels at the right edge of the plot, pushed apart so they never overlap
  labs.sort((p, q) => p.y - q.y); const GAP = 27;
  for (let i = 1; i < labs.length; i++) labs[i].ly = Math.max(labs[i].y, (labs[i - 1].ly ?? labs[i - 1].y) + GAP);
  if (labs.length) labs[0].ly = labs[0].ly ?? labs[0].y;
  const over = labs.length ? labs.at(-1).ly - (Y1 + 4) : 0; if (over > 0) labs.forEach(l => l.ly -= over);
  for (const l of labs) {
    o += `<text x="${X1 + 18}" y="${(l.ly + 6).toFixed(1)}" font-family="Public Sans" font-size="21" font-weight="600" fill="#1F1D14" opacity="${l.a.toFixed(3)}"><tspan fill="${l.s.color}">●</tspan> ${l.s.label} <tspan font-weight="500" fill="#4A4636">${fmtM(l.v)}</tspan></text>`;
  }
  return o;
}

// ---------------------------------------------------------------- summary: total since first measured year
function sumChart(grow) {
  const rows = S.map(s => ({ s, v: lastAt(s, K - 1)[1] })).sort((a, b) => a.v - b.v), mx = Math.max(...rows.map(r => -r.v)), W = 640, RH = 34;
  let o = '';
  rows.forEach((r, i) => { const g = ease(clamp01(grow * rows.length - i)), w = (-r.v / mx) * 290 * g, y = i * RH;
    o += `<text x="0" y="${y + 23}" font-family="Public Sans" font-size="18" font-weight="600" fill="#1F1D14">${r.s.label}</text>`;
    o += `<rect x="170" y="${y + 6}" width="${Math.max(0, w).toFixed(1)}" height="${RH - 12}" rx="3" fill="${r.s.color}"/>`;
    if (g > 0.98) o += `<text x="${(178 + w).toFixed(1)}" y="${y + 23}" font-family="Public Sans" font-size="17" font-weight="500" fill="#4A4636">${fmtM(r.v)} since ${r.s.y0}</text>`; });
  return `<svg width="${W}" height="${rows.length * RH}">${o}</svg>`;
}

// ---------------------------------------------------------------- frame
$('kicker').textContent = SC.kicker; $('q').innerHTML = SC.hook.question; $('note').innerHTML = SC.note;
$('yearbox').querySelector('.sub').innerHTML = SC.yearSub;
const sm = $('summary'); sm.querySelector('.kick').textContent = SC.summary.kicker; sm.querySelector('.big').textContent = SC.summary.big;
sm.querySelector('.line').innerHTML = SC.summary.line; sm.querySelector('.sub').innerHTML = SC.summary.sub;
function cueAt(f) {
  if (f <= 0) return '';
  const a = where(f), b = where(f - 1);
  if (a.s !== b.s && a.s.kind === 'beat' && a.s.sfx) return a.s.sfx;
  if (a.s !== b.s && a.s.kind === 'summary') return 'hit';
  if (a.s.kind === 'run' && a.s.riser && a.s.f1 - f === Math.round(1.6 * fps)) return 'riser';
  const ya = YR[Math.floor(a.u)], yb = YR[Math.floor(b.u)];
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
  const barsA = inSum ? 1 - tIn(12) : inLoop ? ease(clamp01(((f - s.f0) / s.n - 0.3) / 0.7)) : 1;
  $('chart').innerHTML = chart(w.u, barsA, focus && Math.min(tIn(8), tOut(8)) > 0.5 ? focus : null);
  $('year').textContent = y; $('yearbox').style.opacity = barsA.toFixed(3);
  $('head').style.opacity = (inSum ? 1 - tIn(12) : inLoop ? barsA : 1).toFixed(3);
  const bt = $('beat');
  if (inBeat) { const a = Math.min(tIn(9), tOut(9)); bt.querySelector('.kick').textContent = s.kicker; bt.querySelector('.big').textContent = s.big; bt.querySelector('.line').innerHTML = s.line;
    bt.style.opacity = a; bt.style.top = (s.cardTop || 560) + 'px'; bt.style.transform = `translateY(${((1 - ease(a)) * 24).toFixed(1)}px)`; } else bt.style.opacity = 0;
  sm.querySelector('.chart').innerHTML = sumChart(inSum ? clamp01((f - s.f0 - 8) / 40) : 1); sm.style.opacity = sumA.toFixed(3);
  sm.style.transform = `scale(${(0.96 + 0.04 * ease(inSum ? tIn(14) : 1)).toFixed(4)})`;
  $('glow').style.opacity = (inBeat ? Math.min(tIn(9), tOut(9)) : inSum ? sumA * 0.8 : 0).toFixed(3);
  $('flash').style.opacity = 0;
  for (let d = 0; d < 6; d++) { const c = cueAt(f - d); if (c === 'hit') { $('flash').style.opacity = (0.35 * (1 - d / 6)).toFixed(3); break; } }
  return { frame: f, year: String(y), phase: f < fHook ? 'intro' : s.kind, title: SC.title,
    annotation: inBeat ? `${s.kicker}: ${s.big}. ${s.line.replace(/<[^>]+>/g, '')}` : inSum ? `${SC.summary.big} ${SC.summary.line.replace(/<[^>]+>/g, '')}` : '', cue: cueAt(f) };
}
window.CTT = { ready: false, frameCount: N, fps, renderFrame, config: SC, years: YR.map(String) };
window.CTX = { S, YR, SEG, where };
renderFrame(0);
setTimeout(() => { window.CTT.ready = true; }, 300);
