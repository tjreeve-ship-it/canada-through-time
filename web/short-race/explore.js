// v3 bar-race Short. Every frame is a pure function of its number (window.CTT.renderFrame), so renders are reproducible.
// Data: explorer/pr_citizenship.json, built by pipeline/ingest_ircc_pr.py from IRCC open data (admissions of permanent
// residents by country of citizenship). Printed numbers are the published value for the year on screen; bar lengths and
// positions glide between consecutive years as animation (disclosed on screen). Story text comes from the configuration,
// which tools/build_race_config.py writes from computed figures.
const Q = new URLSearchParams(location.search);
const SC = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob((Q.get('studio') || '').replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))));
const J = u => fetch(u).then(r => { if (!r.ok) throw new Error(u); return r.json(); });
const D = await J('../data/explorer/pr_citizenship.json');
await Promise.all(['600 20px "Public Sans"', '500 20px "Public Sans"', '700 20px "Source Serif 4"', '600 20px "Source Serif 4"'].map(f => document.fonts.load(f)));
const $ = id => document.getElementById(id);

// ---------------------------------------------------------------- data
const YR = []; for (let y = SC.years[0]; y <= SC.years[1]; y++) YR.push(y);
const K = YR.length, TOP = SC.top || 8;
const EXCLUDE = new Set(SC.exclude || []);
const NAMES = Object.keys(D.countries).filter(c => !EXCLUDE.has(c));
const V = Object.fromEntries(NAMES.map(c => [c, YR.map(y => D.countries[c][y] ?? null)]));   // null = suppressed or not published
const TOT = YR.map(y => { const t = D.total[y]; if (t == null) throw new Error('no total ' + y); return t; });
const RANK = YR.map((y, k) => { const r = {}; NAMES.filter(c => V[c][k] != null).sort((a, b) => V[b][k] - V[a][k] || a.localeCompare(b)).forEach((c, i) => r[c] = i); return r; });
const SHOW = new Set(); RANK.forEach(r => Object.entries(r).forEach(([c, i]) => i < TOP && SHOW.add(c)));
const LEADER = RANK.map(r => Object.keys(r).find(c => r[c] === 0));
const short = c => (SC.short || {})[c] || c.replace(/, (People's |Federal |Islamic |Democratic )?Republic of$/, '').replace(/ SAR$/, '');
const fmt = n => n.toLocaleString('en-CA');
const lerp = (a, b, t) => a + (b - a) * t, clamp01 = x => Math.max(0, Math.min(1, x)), ease = t => t * t * (3 - 2 * t);

// ---------------------------------------------------------------- timeline (steps from the configuration)
const fps = SC.fps || 30;
const SEG = []; let acc = 0, u = 0;
for (const st of SC.plan) {
  const n = Math.round(st.s * fps);
  if (st.kind === 'run') { SEG.push({ ...st, n, u0: u, u1: st.to }); u = st.to; }
  else SEG.push({ ...st, n, u0: u, u1: u });
}
for (const s of SEG) { s.f0 = acc; acc += s.n; s.f1 = acc; }
const N = acc, fHook = Math.round(SC.hook.seconds * fps);
const shape = { linear: t => t, out: t => 1 - (1 - t) * (1 - t), in: t => t * t, inout: ease };
function where(f) {
  const s = SEG.find(x => f >= x.f0 && f < x.f1) || SEG.at(-1), t = s.n ? (f - s.f0) / s.n : 0;
  return { s, t, u: s.kind === 'run' ? lerp(s.u0, s.u1, (shape[s.ease] || shape.linear)(t)) : s.kind === 'loop' ? 0 : s.u0 };
}

// ---------------------------------------------------------------- bars
const barsEl = $('bars'), ROW = 68, MAXW = 500;
const els = {};
for (const c of SHOW) { const d = document.createElement('div'); d.className = 'bar'; d.innerHTML = '<span class="rk"></span><i></i><span class="nm"></span><span class="val"></span>'; barsEl.appendChild(d); els[c] = d; }
const colorOf = c => (SC.colors || {})[c] || SC.otherColor || '#A39D8A';
const measure = document.createElement('canvas').getContext('2d'); measure.font = '600 24px "Public Sans"';
const valAt = (c, uu) => { const i = Math.max(0, Math.min(K - 1, Math.floor(uu))), j = Math.min(K - 1, i + 1), t = clamp01(uu - i), a = V[c][i] ?? 0, b = V[c][j] ?? 0; return lerp(a, b, t); };
const posAt = (c, uu) => { const i = Math.max(0, Math.min(K - 1, Math.floor(uu))), j = Math.min(K - 1, i + 1), t = ease(clamp01(uu - i)), r = k => Math.min(RANK[k][c] ?? TOP + 1, TOP + 1); return lerp(r(i), r(j), t); };
function drawBars(uu, alpha, focus) {
  const k = Math.round(uu), vis = [...SHOW].map(c => ({ c, v: valAt(c, uu), p: posAt(c, uu) })).filter(d => d.p < TOP + 0.99);
  const vmax = Math.max(...vis.map(d => d.v), 1) * 1.02;
  for (const c of SHOW) {
    const el = els[c], d = vis.find(x => x.c === c);
    if (!d) { el.style.opacity = 0; continue; }
    const w = Math.max(6, d.v / vmax * MAXW), nameW = measure.measureText(short(c)).width + 28, inside = w > nameW;
    const fade = clamp01((TOP - 0.2 - d.p) / 0.8) * alpha * (focus && !focus.has(c) ? 0.22 : 1);
    el.style.top = (d.p * ROW).toFixed(1) + 'px'; el.style.opacity = fade.toFixed(3);
    const bar = el.querySelector('i'); bar.style.width = w.toFixed(1) + 'px'; bar.style.background = colorOf(c);
    const nm = el.querySelector('.nm'); nm.textContent = short(c); nm.className = 'nm' + (inside ? '' : ' out'); nm.style.left = (inside ? 14 : w + 12) + 'px';
    const pub = V[c][k], val = el.querySelector('.val');
    val.textContent = pub == null ? '' : fmt(pub); val.style.left = ((inside ? w : w + nameW - 2) + 12).toFixed(1) + 'px';
    
  }
}

// ---------------------------------------------------------------- summary chart: one country's published yearly admissions
function sumChart(grow) {
  const c = SC.summary.country, vals = V[c], mx = Math.max(...vals), W = 640, H = 210, bw = W / K;
  let out = '';
  vals.forEach((v, i) => { const g = clamp01(grow * K - i); if (v == null || g <= 0) return; const h = v / mx * (H - 34) * ease(g);
    out += `<rect x="${(i * bw + 2).toFixed(1)}" y="${(H - 22 - h).toFixed(1)}" width="${(bw - 4).toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${colorOf(c)}" opacity="${i === K - 1 ? 1 : 0.55}"/>`; });
  const lab = (i, a) => `<text x="${a === 'end' ? W : 0}" y="${H - 4}" text-anchor="${a}" font-family="Public Sans" font-size="15" fill="#655F4E">${YR[i]}: ${fmt(vals[i])}</text>`;
  return `<svg width="${W}" height="${H}">${out}${grow >= 1 ? lab(0, 'start') + lab(K - 1, 'end') : ''}</svg>`;
}

// ---------------------------------------------------------------- frame
$('kicker').textContent = SC.kicker; $('q').innerHTML = SC.hook.question; $('note').innerHTML = SC.note;
function cueAt(f) {
  if (f <= 0) return '';
  const a = where(f), b = where(f - 1);
  if (a.s !== b.s && a.s.kind === 'beat' && a.s.sfx) return a.s.sfx;
  if (a.s !== b.s && a.s.kind === 'summary') return 'hit';
  if (a.s.kind === 'run' && a.s.riser && a.s.f1 - f === Math.round(1.6 * fps)) return 'riser';
  const ka = Math.round(a.u), kb = Math.round(b.u);
  if (a.s.kind === 'run' && ka !== kb && LEADER[ka] !== LEADER[kb]) return 'tick';
  return '';
}
function renderFrame(f) {
  f = Math.max(0, Math.min(N - 1, Math.round(f)));
  const w = where(f), s = w.s, k = Math.round(w.u), y = YR[k];
  const inBeat = s.kind === 'beat', inSum = s.kind === 'summary', inLoop = s.kind === 'loop';
  const tIn = (n = 10) => clamp01((f - s.f0 + 1) / n), tOut = (n = 10) => clamp01((s.f1 - f) / n);
  // beat focus fades in and out across the beat segment
  const focus = inBeat && s.focus ? new Set(s.focus) : null;
  const sumA = inSum ? tIn(12) : inLoop ? clamp01(1 - (f - s.f0) / (s.n * 0.35)) : 0;
  const loopA = inLoop ? ease(clamp01((f - s.f0) / s.n)) : 1;
  const barsA = inSum ? 1 - tIn(12) : inLoop ? ease(clamp01(((f - s.f0) / s.n - 0.3) / 0.7)) : 1;
  drawBars(w.u, barsA, focus && Math.min(tIn(8), tOut(8)) > 0.5 ? focus : null);
  $('year').textContent = y; $('year').parentElement.style.opacity = barsA.toFixed(3);
  const L = LEADER[k]; $('lead').querySelector('.n').textContent = short(L); $('lead').querySelector('.v').textContent = fmt(V[L][k]);
  $('head').style.opacity = (inSum ? 1 - tIn(12) : inLoop ? barsA : 1).toFixed(3);
  const bt = $('beat');
  if (inBeat) { const a = Math.min(tIn(9), tOut(9)); bt.querySelector('.kick').textContent = s.kicker; bt.querySelector('.big').textContent = s.big; bt.querySelector('.line').innerHTML = s.line;
    bt.style.opacity = a; bt.style.top = (s.cardTop || 560) + 'px'; bt.style.transform = `translateY(${((1 - ease(a)) * 24).toFixed(1)}px)`; } else bt.style.opacity = 0;
  const sm = $('summary'); sm.querySelector('.kick').textContent = SC.summary.kicker; sm.querySelector('.big').textContent = SC.summary.big;
  sm.querySelector('.line').innerHTML = SC.summary.line; sm.querySelector('.sub').innerHTML = SC.summary.sub;
  sm.querySelector('.chart').innerHTML = sumChart(inSum ? clamp01((f - s.f0 - 8) / 40) : 1); sm.querySelector('.ccap').textContent = SC.summary.chartCaption; sm.style.opacity = sumA.toFixed(3);
  sm.style.transform = `scale(${(0.96 + 0.04 * ease(inSum ? tIn(14) : 1)).toFixed(4)})`;
  $('glow').style.opacity = (inBeat ? Math.min(tIn(9), tOut(9)) : inSum ? sumA * 0.8 : 0).toFixed(3);
  const cue = cueAt(f);
  $('flash').style.opacity = 0;
  for (let d = 0; d < 6; d++) { const c = cueAt(f - d); if (c === 'hit') { $('flash').style.opacity = (0.35 * (1 - d / 6)).toFixed(3); break; } }
  return { frame: f, year: String(y), phase: f < fHook ? 'intro' : s.kind, title: SC.title, leader: short(L), leader_value: V[L][k],
    annotation: inBeat ? `${s.kicker}: ${s.big}. ${s.line.replace(/<[^>]+>/g, '')}` : inSum ? `${SC.summary.big} ${SC.summary.line.replace(/<[^>]+>/g, '')}` : '', cue };
}
window.CTT = { ready: false, frameCount: N, fps, renderFrame, config: SC, years: YR.map(String) };
window.CTX = { V, RANK, LEADER, TOT, YR, SEG, where };
renderFrame(0);
setTimeout(() => { window.CTT.ready = true; }, 300);
