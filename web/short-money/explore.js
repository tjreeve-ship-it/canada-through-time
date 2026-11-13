// v3 map Short: federal money collected minus spent, by province, running totals. Pure function of the frame number.
// Data: more/govt.json, built by pipeline/ingest_economy.py from Statistics Canada table 36-10-0450-01 (federal general
// government, revenue minus expenditure = "surplus or deficit", allocated to provinces by Statistics Canada, $ millions,
// current dollars, calendar years). Printed totals are sums of published yearly values through the year on screen; fill
// colour glides between years as animation (disclosed on screen). Story text comes from tools/build_money_config.py.
const Q = new URLSearchParams(location.search);
const SC = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob((Q.get('studio') || '').replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))));
const J = u => fetch(u).then(r => { if (!r.ok) throw new Error(u); return r.json(); });
const [G, prov] = await Promise.all([J('../data/more/govt.json'), J('../data/provinces.geojson')]);
await Promise.all(['600 20px "Public Sans"', '500 20px "Public Sans"', '700 20px "Source Serif 4"', '600 20px "Source Serif 4"'].map(f => document.fonts.load(f)));
const $ = id => document.getElementById(id);
const lerp = (a, b, t) => a + (b - a) * t, clamp01 = x => Math.max(0, Math.min(1, x)), ease = t => t * t * (3 - 2 * t);

// ---------------------------------------------------------------- data
const YR = []; for (let y = SC.years[0]; y <= SC.years[1]; y++) YR.push(y);
const K = YR.length, PT = ['NL', 'PE', 'NS', 'NB', 'QC', 'ON', 'MB', 'SK', 'AB', 'BC', 'YT', 'NT', 'NU'];
const F = G.data.federal;
const BAL = Object.fromEntries([...PT, 'CAN'].map(g => [g, YR.map(y => { const v = F[g]?.[y]?.bal; if (v == null) throw new Error(`missing ${g} ${y}`); return v; })]));
const CUM = Object.fromEntries(Object.entries(BAL).map(([g, a]) => { let s = 0; return [g, a.map(v => (s += v))]; }));
const B = v => { const a = Math.abs(v) / 1000; return (v > 0 ? '+' : v < 0 ? '−' : '') + '$' + (a >= 100 ? Math.round(a) : a >= 10 ? a.toFixed(0) : a.toFixed(1)) + 'B'; };
const cumAt = (g, u) => { const i = Math.max(0, Math.min(K - 1, Math.floor(u))), j = Math.min(K - 1, i + 1); return lerp(CUM[g][i], CUM[g][j], clamp01(u - i)); };

// ---------------------------------------------------------------- map (flat SVG, projected StatCan Lambert metres)
const svg = $('map'), X0 = 3690800, X1 = 9015600, Y0 = 658900, Y1 = 5241900, S = Math.min(660 / (X1 - X0), 540 / (Y1 - Y0));
const ox = (720 - (X1 - X0) * S) / 2, oy = 10;
const px = ([x, y]) => [ox + (x - X0) * S, oy + (Y1 - y) * S];
const ring = r => 'M' + r.map(p => px(p).map(v => v.toFixed(1)).join(',')).join('L') + 'Z';
const pathOf = f => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).flatMap(poly => poly.map(ring)).join('');
const LAB = Object.fromEntries(prov.features.map(f => [f.properties.abbr, px([f.properties.lx, f.properties.ly])]));
Object.entries(SC.labels || {}).forEach(([g, o]) => { LAB[g] = [LAB[g][0] + o[0], LAB[g][1] + o[1], o[2]]; });
svg.innerHTML = prov.features.map(f => `<path id="p-${f.properties.abbr}" d="${pathOf(f)}" stroke="#5E5844" stroke-width="0.8" stroke-linejoin="round"/>`).join('')
  + PT.map(g => { const a = prov.features.find(f => f.properties.abbr === g); const [x0, y0] = px([a.properties.lx, a.properties.ly]); const [x, y, lead] = LAB[g];
    return (lead ? `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y - 6).toFixed(1)}" stroke="#4A4636" stroke-width="1"/>` : '')
      + `<g id="l-${g}"><text x="${x.toFixed(1)}" y="${(y - 10).toFixed(1)}" text-anchor="middle" font-size="15" fill="#4A4636">${g}</text><text class="amt" x="${x.toFixed(1)}" y="${(y + 12).toFixed(1)}" text-anchor="middle" font-size="20"></text></g>`; }).join('');
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), rgb = c => `rgb(${c.map(Math.round).join(',')})`, mix = (a, b, t) => a.map((x, i) => lerp(x, b[i], t));
const LAND = hex('#FBF8EF'), POS = hex('#2F6F8F'), NEG = hex('#C27A2C'), DIM = hex('#ECE8DD'), REF = SC.colourScale || 200000;
const fillOf = v => mix(LAND, v >= 0 ? POS : NEG, 0.12 + 0.88 * Math.sqrt(clamp01(Math.abs(v) / REF)));

// ---------------------------------------------------------------- timeline
const fps = SC.fps || 30, SEG = []; let acc = 0, u = 0;
for (const st of SC.plan) { const n = Math.round(st.s * fps); if (st.kind === 'run') { SEG.push({ ...st, n, u0: u, u1: st.to }); u = st.to; } else SEG.push({ ...st, n, u0: u, u1: u }); }
for (const s of SEG) { s.f0 = acc; acc += s.n; s.f1 = acc; }
const N = acc, fHook = Math.round(SC.hook.seconds * fps), shape = { linear: t => t, out: t => 1 - (1 - t) * (1 - t), inout: ease };
function where(f) { const s = SEG.find(x => f >= x.f0 && f < x.f1) || SEG.at(-1), t = s.n ? (f - s.f0) / s.n : 0;
  return { s, t, u: s.kind === 'run' ? lerp(s.u0, s.u1, (shape[s.ease] || shape.linear)(t)) : s.kind === 'loop' ? 0 : s.u0 }; }

// ---------------------------------------------------------------- summary chart: all 13, sorted, diverging
function sumChart(grow) {
  const rows = PT.map(g => [g, CUM[g][K - 1]]).sort((a, b) => b[1] - a[1]), W = 640, RH = 42, mid = 330, mx = Math.max(...rows.map(r => Math.abs(r[1]))), sc = 250 / mx;
  let o = `<line x1="${mid}" x2="${mid}" y1="0" y2="${rows.length * RH}" stroke="#1F1D14" stroke-opacity=".5"/>`;
  rows.forEach(([g, v], i) => { const gg = ease(clamp01(grow * 1.6 - i * 0.05)), w = Math.abs(v) * sc * gg, y = i * RH + 4, pos = v >= 0;
    o += `<rect x="${(pos ? mid : mid - w).toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="${RH - 12}" rx="3" fill="${pos ? '#2F6F8F' : '#C27A2C'}"/>`
      + `<text x="${pos ? mid - 10 : mid + 10}" y="${y + 22}" text-anchor="${pos ? 'end' : 'start'}" font-family="Public Sans" font-weight="600" font-size="19" fill="#1F1D14">${SC.names[g]}</text>`
      + (gg > 0.95 ? `<text x="${(pos ? mid + w + 8 : mid - w - 8).toFixed(1)}" y="${y + 22}" text-anchor="${pos ? 'start' : 'end'}" font-family="Public Sans" font-weight="600" font-size="19" fill="#4A4636">${B(v)}</text>` : ''); });
  return `<svg width="${W}" height="${rows.length * RH}" overflow="visible">${o}</svg>`;
}

// ---------------------------------------------------------------- frame
$('kicker').textContent = SC.kicker; $('q').innerHTML = SC.hook.question; $('note').innerHTML = SC.note;
const lead = $('lead'); lead.querySelector('.k').textContent = SC.leadLabel;
function cueAt(f) { if (f <= 0) return ''; const a = where(f), b = where(f - 1);
  if (a.s !== b.s && a.s.kind === 'beat' && a.s.sfx) return a.s.sfx;
  if (a.s !== b.s && a.s.kind === 'summary') return 'tick';
  if (a.s.kind === 'run' && a.s.riser && a.s.f1 - f === Math.round(1.6 * fps)) return 'riser';
  return ''; }
function renderFrame(f) {
  f = Math.max(0, Math.min(N - 1, Math.round(f)));
  const w = where(f), s = w.s, k = Math.round(w.u), y = YR[k];
  const inBeat = s.kind === 'beat', inSum = s.kind === 'summary', inLoop = s.kind === 'loop';
  const tIn = (n = 10) => clamp01((f - s.f0 + 1) / n), tOut = (n = 10) => clamp01((s.f1 - f) / n);
  const focus = inBeat && s.focus ? new Set(s.focus) : null, fa = inBeat ? Math.min(tIn(9), tOut(9)) : 0;
  const mainA = inSum ? 1 - tIn(12) : inLoop ? ease(clamp01(((f - s.f0) / s.n - 0.3) / 0.7)) : 1;
  const sumA = inSum ? tIn(12) : inLoop ? clamp01(1 - (f - s.f0) / (s.n * 0.35)) : 0;
  for (const g of PT) {
    const v = cumAt(g, w.u); let c = fillOf(v); if (focus && !focus.has(g)) c = mix(c, DIM, 0.75 * fa);
    $('p-' + g).setAttribute('fill', rgb(c));
    const l = $('l-' + g); l.querySelector('.amt').textContent = B(CUM[g][k]); l.querySelector('.amt').setAttribute('fill', CUM[g][k] >= 0 ? '#1F4E66' : '#8A5216');
    l.style.opacity = (focus && !focus.has(g) ? 1 - 0.75 * fa : 1).toFixed(3);
  }
  ['NT', 'NU'].forEach(g => { const p = $('p-' + g); if (p) p.setAttribute('stroke-width', '0.8'); });
  $('mapwrap').style.opacity = $('key').style.opacity = mainA.toFixed(3);
  $('mapwrap').style.transform = `translateY(${((1 - mainA) * 20).toFixed(1)}px)`;
  // camera: tilt in during the hook, slow drift through the middle, back to the opening tilt for a seamless loop
  const fLoop = SEG.find(x => x.kind === 'loop').f0, A = SC.tilt || [52, 22];
  const tt = f < fHook ? ease(f / fHook) : inLoop ? 1 - ease((f - s.f0) / s.n) : 1;
  const drift = f >= fHook && f < fLoop ? Math.sin(Math.PI * (f - fHook) / (fLoop - fHook)) : 0;
  svg.style.transform = `rotateX(${lerp(A[0], A[1], tt).toFixed(2)}deg) scale(${(lerp(0.9, 1, tt) + 0.05 * drift).toFixed(4)}) rotateZ(${(-2.5 * drift).toFixed(2)}deg)`;
  $('year').textContent = y; $('yearbox').style.opacity = (mainA * (1 - fa)).toFixed(3);
  lead.querySelector('.n').textContent = `since ${YR[0]}`; lead.querySelector('.v').textContent = SC.leadSub;
  $('head').style.opacity = (mainA * (1 - fa)).toFixed(3);
  const bt = $('beat');
  if (inBeat) { bt.className = s.tone || ''; bt.querySelector('.kick').textContent = s.kicker; bt.querySelector('.big').textContent = s.big; bt.querySelector('.line').innerHTML = s.line;
    bt.style.opacity = fa; bt.style.top = (s.cardTop || 96) + 'px'; bt.style.transform = `translateY(${((1 - ease(fa)) * 24).toFixed(1)}px)`; } else bt.style.opacity = 0;
  const sm = $('summary'); sm.querySelector('.kick').textContent = SC.summary.kicker; sm.querySelector('.line').innerHTML = SC.summary.line;
  sm.querySelector('.chart').innerHTML = sumChart(inSum ? clamp01((f - s.f0 - 6) / 45) : 1); sm.querySelector('.sub').innerHTML = SC.summary.sub; sm.style.opacity = sumA.toFixed(3);
  $('glow').style.opacity = (fa * 0.9).toFixed(3);
  $('flash').style.opacity = 0; for (let d = 0; d < 6; d++) if (cueAt(f - d) === 'hit') { $('flash').style.opacity = (0.3 * (1 - d / 6)).toFixed(3); break; }
  return { frame: f, year: String(y), phase: f < fHook ? 'intro' : s.kind, title: SC.title,
    annotation: inBeat ? `${s.kicker}: ${s.big}. ${s.line.replace(/<[^>]+>/g, '')}` : inSum ? `${SC.summary.kicker}. ${SC.summary.line.replace(/<[^>]+>/g, '')}` : '', cue: cueAt(f) };
}
window.CTT = { ready: false, frameCount: N, fps, renderFrame, config: SC, years: YR.map(String) };
window.CTX = { CUM, BAL, YR, SEG, where, LAB };
renderFrame(0);
setTimeout(() => { window.CTT.ready = true; }, 300);
