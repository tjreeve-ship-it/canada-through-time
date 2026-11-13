// Neighbourhoods: every census tract in Canada's 50 tracted cities (41 CMAs + 9 tracted CAs), 2021 Census of Population.
// Values are Statistics Canada's published figures (98-401-X2021007). Missing or suppressed values are drawn as missing, never zero.
// A few measures are simple ratios of two published figures from the same table (stated in the panel where they are used).
const { Deck, OrthographicView, GeoJsonLayer } = window.deck;
const BASE = document.documentElement.dataset.base || '..';
const J = u => window.__DATA?.[u] ? Promise.resolve(window.__DATA[u]) : fetch(u.replace(/^\.\.\//, BASE + '/')).then(r => { if (!r.ok) throw new Error(u); return r.json(); });

// ---------------------------------------------------------------- formatting
const nf = (v, dp = 0) => v.toLocaleString('en-CA', { minimumFractionDigits: dp, maximumFractionDigits: dp });
const money = v => '$' + nf(v);
const moneyK = v => v >= 1e6 ? '$' + (v / 1e6).toFixed(v >= 1e7 ? 1 : 2) + 'M' : '$' + Math.round(v / 1e3) + 'K';
const pc = v => nf(v, v !== 0 && Math.abs(v) < 10 ? 1 : 0) + '%';
const pc1 = v => nf(v, 1) + '%';
const ord = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// ---------------------------------------------------------------- measures
// get(a) receives an area record {v, pob, ...}; X[key] is the index of a published field.
let P, X = {}, POB = [];
const val = (a, k) => a.v[X[k]] ?? null;
const ratio = (n, d) => n == null || d == null || d <= 0 ? null : n / d * 100;
const MS = [
  { k: 'hhinc', g: 'Income', l: 'Median household income', q: 'Where are household incomes highest and lowest?', f: money, t: moneyK, get: a => val(a, 'hhinc'),
    def: 'Median total income of households in 2020, before tax. 2020 incomes include pandemic benefits.' },
  { k: 'hhinc_at', g: 'Income', l: 'Median income after tax', q: 'Household income after income tax.', f: money, t: moneyK, get: a => val(a, 'hhinc_at'), def: 'Median after-tax income of households in 2020.' },
  { k: 'lim', g: 'Income', l: 'Low income', q: 'What share of people live in a low-income household?', f: pc1, t: pc, get: a => val(a, 'lim'),
    def: 'Prevalence of low income, after-tax low-income measure (LIM-AT), share of people in private households, 2020 income.' },
  { k: 'rent', g: 'Housing', l: 'Renters', q: 'Where do renters live?', f: pc1, t: pc, get: a => val(a, 'rent'), def: 'Share of private households that rent their home.' },
  { k: 'shelter30', g: 'Housing', l: 'Shelter costs 30%+ of income', q: 'Where do households spend 30% or more of income on housing?', f: pc1, t: pc, get: a => val(a, 'shelter30'),
    def: 'Share of owner and tenant households spending 30% or more of total income on shelter costs.' },
  { k: 'homeval', g: 'Housing', l: 'Median home value', q: 'What owners say their homes are worth.', f: money, t: moneyK, get: a => val(a, 'homeval'),
    def: 'Median value of owned dwellings, as estimated by the owners on the census form (May 2021).' },
  { k: 'dens', g: 'People', l: 'Density', q: 'How tightly packed is each neighbourhood?', f: v => nf(v) + '/km²', t: v => v >= 1e3 ? nf(v / 1e3, 1) + 'K' : nf(v), log: true, get: a => val(a, 'dens'),
    def: 'People per square kilometre of land, 2021.' },
  { k: 'growth', g: 'People', l: 'Growth 2016–2021', q: 'Which neighbourhoods grew and which shrank?', f: v => (v > 0 ? '+' : v < 0 ? '−' : '') + nf(Math.abs(v), 1) + '%', t: v => (v > 0 ? '+' : v < 0 ? '−' : '') + nf(Math.abs(v)) + '%', div: true,
    get: a => { const p = val(a, 'pop'), q = val(a, 'pop16'); return p == null || q == null || q < 50 ? null : (p - q) / q * 100; },
    def: 'Change in population from 2016 to 2021, both counted on 2021 tract boundaries as Statistics Canada publishes them. Tracts with fewer than 50 people in 2016 are left blank (the percentage is meaningless).' },
  { k: 'age', g: 'People', l: 'Median age', q: 'Where do younger and older people live?', f: v => nf(v, 1) + ' years', t: v => nf(v), get: a => val(a, 'age'), def: 'Median age of the population, 2021.' },
  { k: 'kids', g: 'People', l: 'Children (0–14)', q: 'Where do families with children live?', f: pc1, t: pc, get: a => ratio(val(a, 'u15'), val(a, 'pop')), def: 'People aged 0 to 14 as a share of all residents (published counts, 100% data).' },
  { k: 'seniors', g: 'People', l: 'Seniors (65+)', q: 'Where do seniors live?', f: pc1, t: pc, get: a => ratio(val(a, 'o65'), val(a, 'pop')), def: 'People aged 65 and over as a share of all residents (published counts, 100% data).' },
  { k: 'imm', g: 'Origins', l: 'Immigrants', q: 'Where do immigrants live?', f: pc1, t: pc, get: a => val(a, 'imm'), def: 'Immigrants (people who are, or have ever been, permanent residents) as a share of people in private households.' },
  { k: 'imm_new', g: 'Origins', l: 'Arrived 2016–2021', q: 'Where do the newest immigrants settle?', f: pc1, t: pc, get: a => val(a, 'imm_new'), def: 'Immigrants who arrived between 2016 and May 2021, share of people in private households.' },
  { k: 'npr', g: 'Origins', l: 'Temporary residents', q: 'Where do non-permanent residents live?', f: pc1, t: pc, get: a => val(a, 'npr'), def: 'Non-permanent residents (work and study permit holders, asylum claimants and family members), share of people in private households, May 2021.' },
  { k: 'born', g: 'Origins', l: 'Born in…', q: 'Where do people born in a given country live?', f: pc1, t: pc, sub: 'pob',
    get: (a, s) => { const n = a.pob?.[s]; return n == null ? null : ratio(n, val(a, 'ph')); },
    def: 'Immigrants born in the chosen country or region as a share of people in private households (two published counts from the same 25% sample).' },
  { k: 'vm', g: 'Origins', l: 'Visible minority groups', q: 'Where do different visible minority groups live?', f: pc1, t: pc, sub: 'vm',
    get: (a, s) => val(a, s), def: 'Share of people in private households in the chosen group, as defined by the Employment Equity Act and self-reported.' },
  { k: 'indig', g: 'Origins', l: 'Indigenous identity', q: 'Where do Indigenous people live in cities?', f: pc1, t: pc, get: a => val(a, 'indig'), def: 'People with an Indigenous identity, share of people in private households.' },
  { k: 'nonoff', g: 'Language', l: 'Mother tongue: other', q: 'Where is a language other than English or French the first language?', f: pc1, t: pc, get: a => val(a, 'nonoff'),
    def: 'Mother tongue is a single non-official language, share of the population (excluding institutional residents).' },
  { k: 'fr', g: 'Language', l: 'Mother tongue: French', q: 'Where is French the first language?', f: pc1, t: pc, get: a => val(a, 'fr'), def: 'Mother tongue is French only, share of the population (excluding institutional residents).' },
  { k: 'en', g: 'Language', l: 'Mother tongue: English', q: 'Where is English the first language?', f: pc1, t: pc, get: a => val(a, 'en'), def: 'Mother tongue is English only, share of the population (excluding institutional residents).' },
  { k: 'degree', g: 'Work and school', l: 'University degree', q: 'Where do university graduates live?', f: pc1, t: pc, get: a => val(a, 'degree'), def: "Bachelor's degree or higher, share of people aged 15 and over in private households." },
  { k: 'ur', g: 'Work and school', l: 'Unemployment rate', q: 'Where was unemployment highest in May 2021?', f: pc1, t: pc, get: a => val(a, 'ur'),
    def: 'Unemployment rate in census week (May 2021, during COVID-19 restrictions), people aged 15 and over.' },
];
const MK = Object.fromEntries(MS.map(m => [m.k, m]));
const VM_SUB = [['vm', 'Any visible minority'], ['vm_sa', 'South Asian'], ['vm_cn', 'Chinese'], ['vm_bl', 'Black'], ['vm_fi', 'Filipino'], ['vm_ar', 'Arab'], ['vm_la', 'Latin American'], ['vm_sea', 'Southeast Asian'], ['vm_wa', 'West Asian'], ['vm_ko', 'Korean'], ['vm_ja', 'Japanese']];
const PROFILE_ROWS = ['hhinc', 'lim', 'rent', 'shelter30', 'homeval', 'dens', 'growth', 'age', 'kids', 'seniors', 'imm', 'imm_new', 'npr', 'vm', 'indig', 'nonoff', 'fr', 'degree', 'ur'];

// ---------------------------------------------------------------- state
const S = { cma: null, m: 'hhinc', vm: 'vm_sa', pob: null, scale: 'city', tract: null, hover: null };
let CITIES = [], TRACTS = {}, FEATS = {}, BBOX = {}, CORE = {}, deckI = null, ready = null, el = null;
const subOf = m => m.sub === 'vm' ? S.vm : m.sub === 'pob' ? S.pob : null;
const subName = m => m.sub === 'vm' ? VM_SUB.find(x => x[0] === S.vm)[1] : m.sub === 'pob' ? P.pob_names[S.pob] : '';
const mLabel = m => m.sub === 'pob' ? 'Born in ' + subName(m) : m.sub === 'vm' ? subName(m) : m.l;
const value = (m, a) => { const v = m.get(a, subOf(m)); return v == null || !isFinite(v) ? null : v; };
const cityName = c => c.name.replace(' / Grand Sudbury', '').replace(/ - /g, '–');

async function load() {
  const [p, shapes] = await Promise.all([J('../data/cities/ct_profile.json'), J('../data/cities/ct_shapes.geojson')]);
  P = p; P.fields.forEach((f, i) => X[f] = i);
  for (const a of Object.values(P.areas)) { const o = {}; (a.pob || []).forEach((v, i) => { if (v != null) o[P.pob_ids[i]] = v; }); a.pob = o; }   // expand compact lists
  CITIES = Object.entries(P.areas).filter(([, a]) => a.level !== 'Census tract').map(([id, a]) => ({ id, code: id.slice(-3), ...a })).sort((a, b) => b.v[X.pop] - a.v[X.pop]);
  for (const [id, a] of Object.entries(P.areas)) if (a.level === 'Census tract') (TRACTS[a.cma] ||= []).push(id);
  // country list: countries (not continents or "other") in order of their total across all 50 cities
  const tot = {}; for (const c of CITIES) for (const [k, n] of Object.entries(c.pob)) tot[k] = (tot[k] || 0) + n;
  const CONT = ['Americas', 'Europe', 'Africa', 'Asia'];
  POB = Object.keys(P.pob_names).filter(k => !CONT.includes(P.pob_names[k]) && !/^Other|^Oceania/.test(P.pob_names[k])).sort((a, b) => (tot[b] || 0) - (tot[a] || 0));
  S.pob = POB[0];
  for (const f of shapes.features) {
    const id = f.properties.DGUID, a = P.areas[id]; if (!a) continue;
    const km = x => typeof x[0] === 'number' ? [x[0] / 1e3, x[1] / 1e3] : x.map(km);
    f.geometry.coordinates = km(f.geometry.coordinates);
    (FEATS[a.cma] ||= []).push(f);
  }
  for (const [c, fs] of Object.entries(FEATS)) { let b = [1e9, 1e9, -1e9, -1e9];
    const walk = x => { if (typeof x[0] === 'number') { b[0] = Math.min(b[0], x[0]); b[1] = Math.min(b[1], x[1]); b[2] = Math.max(b[2], x[0]); b[3] = Math.max(b[3], x[1]); } else x.forEach(walk); };
    fs.forEach(f => walk(f.geometry.coordinates)); BBOX[c] = b;
    // open on the built-up area: large rural fringe tracts otherwise take most of the screen
    b = [1e9, 1e9, -1e9, -1e9]; const core = fs.filter(f => (P.areas[f.properties.DGUID].v[X.dens] ?? 0) >= 400);
    if (core.length >= 5) { core.forEach(f => walk(f.geometry.coordinates)); CORE[c] = b; } else CORE[c] = BBOX[c]; }
  S.cma = S.cma || CITIES[0].id;
}

// ---------------------------------------------------------------- colour
const css = n => getComputedStyle(document.body).getPropertyValue(n).trim();
const hex = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const lerp = (a, b, t) => a.map((x, i) => Math.round(x + (b[i] - x) * t));
const rampAt = (st, t) => { t = Math.max(0, Math.min(1, t)) * (st.length - 1); const i = Math.min(st.length - 2, Math.floor(t)); return lerp(st[i], st[i + 1], t - i); };
let PAL = null;
function pal() { PAL = { seq: [1, 2, 3, 4, 5].map(i => hex(css('--seq-' + i))), dec: [1, 2, 3].map(i => hex(css('--dec-' + i))), neu: hex(css('--neutral')),
  miss: hex(css('--land-dim')), line: hex(css('--page')), sel: hex(css('--select')), page: css('--page') }; }
const quant = (xs, q) => { if (!xs.length) return null; const s = xs[Math.floor((xs.length - 1) * q)]; return s; };
// Colour domain: 2nd–98th percentile of tract values, in this city or across all 50 cities, so one extreme tract can't wash out the rest.
function domain(m) {
  const ids = S.scale === 'all' ? Object.values(TRACTS).flat() : TRACTS[S.cma];
  const xs = ids.map(id => value(m, P.areas[id])).filter(v => v != null).sort((a, b) => a - b);
  let lo = quant(xs, 0.02), hi = quant(xs, 0.98);
  if (m.div) { const r = Math.max(Math.abs(lo), Math.abs(hi)) || 1; return { lo: -r, hi: r, n: xs.length }; }
  if (m.log) lo = Math.max(lo, 1);
  if (!(hi > lo)) hi = lo + 1;
  return { lo, hi, n: xs.length };
}
function colour(m, v, d) {
  if (v == null) return PAL.miss;
  if (m.div) { const dead = d.hi * 0.04; if (Math.abs(v) < dead) return PAL.neu; return v > 0 ? rampAt(PAL.seq, (v - dead) / (d.hi - dead)) : rampAt(PAL.dec, (-v - dead) / (d.hi - dead)); }
  const t = m.log ? (Math.log10(Math.max(v, 1)) - Math.log10(d.lo)) / (Math.log10(d.hi) - Math.log10(d.lo)) : (v - d.lo) / (d.hi - d.lo);
  return rampAt(PAL.seq, t);
}

// ---------------------------------------------------------------- shell
function build() {
  el = document.createElement('section'); el.id = 'nb'; el.hidden = true; el.setAttribute('aria-label', 'Neighbourhoods');
  el.innerHTML = `
  <header id="nb-top"><button id="nb-back" aria-label="Back to the national map">← Canada</button>
    <div id="nb-title"><span class="kick">Neighbourhoods · 2021 Census</span><h1 id="nb-h"></h1></div>
    <label class="nb-city"><span>City</span><select id="nb-city"></select></label>
    <label class="nb-city nb-mpick"><span>Showing</span><select id="nb-mselect"></select></label></header>
  <aside id="nb-side"><div id="nb-ms"></div><div id="nb-subwrap"></div><div id="nb-rank"></div></aside>
  <div id="nb-map" aria-label="Map of census tracts"></div>
  <div id="nb-legend"></div>
  <aside id="nb-detail"><div id="nb-read"></div><div id="nb-dt"></div></aside>
  <div id="nb-tip" role="tooltip"></div>
  <div id="nb-load">Loading 6,247 neighbourhoods…</div>`;
  document.body.appendChild(el);
  el.addEventListener('click', onClick);
  el.querySelector('#nb-back').onclick = close;
  el.querySelector('#nb-city').onchange = e => { setCity(e.target.value); };
  el.querySelector('#nb-mselect').onchange = e => { S.m = e.target.value; render(); };
  el.addEventListener('change', e => { if (e.target.id === 'nb-sub') { const m = MK[S.m]; if (m.sub === 'vm') S.vm = e.target.value; else S.pob = e.target.value; render(); } });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !el.hidden) { if (S.tract) { S.tract = null; render(); } else close(); } });
  addEventListener('resize', () => { if (!el.hidden) fit(); });
}
function onClick(e) {
  const b = e.target.closest('[data-nbm]'); if (b) { S.m = b.dataset.nbm; render(); return; }
  const c = e.target.closest('[data-nbc]'); if (c) { setCity(c.dataset.nbc); return; }
  const t = e.target.closest('[data-nbt]'); if (t) { S.tract = t.dataset.nbt; render(); flyTo(t.dataset.nbt); return; }
  const s = e.target.closest('[data-scale]'); if (s) { S.scale = s.dataset.scale; render(); return; }
  if (e.target.closest('[data-nbclear]')) { S.tract = null; render(); }
}
function setCity(id) { S.cma = id; S.tract = null; render(); fit(); }

function fit() {
  const b = CORE[S.cma], B = BBOX[S.cma], box = el.querySelector('#nb-map').getBoundingClientRect(); if (!b || !deckI) return;
  const zf = k => Math.log2(Math.min(box.width / (k[2] - k[0]), box.height / (k[3] - k[1])) * 0.9), z = zf(b), zAll = zf(B);
  deckI.setProps({ initialViewState: { target: [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2, 0], zoom: z, minZoom: zAll - 1, maxZoom: z + 5, transitionDuration: 0 } });
}
function flyTo(id) {
  const f = FEATS[S.cma].find(f => f.properties.DGUID === id); if (!f) return; let b = [1e9, 1e9, -1e9, -1e9];
  const walk = x => { if (typeof x[0] === 'number') { b = [Math.min(b[0], x[0]), Math.min(b[1], x[1]), Math.max(b[2], x[0]), Math.max(b[3], x[1])]; } else x.forEach(walk); }; walk(f.geometry.coordinates);
  const box = el.querySelector('#nb-map').getBoundingClientRect(), zf = k => Math.log2(Math.min(box.width / (k[2] - k[0]), box.height / (k[3] - k[1])) * 0.9);
  const z0 = zf(CORE[S.cma]), z = Math.min(z0 + 3, Math.log2(Math.min(box.width / (b[2] - b[0] + 0.5), box.height / (b[3] - b[1] + 0.5)) * 0.35));
  deckI.setProps({ initialViewState: { target: [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2, 0], zoom: Math.max(z, z0), minZoom: zf(BBOX[S.cma]) - 1, maxZoom: z0 + 5, transitionDuration: 600 } });
}

// ---------------------------------------------------------------- render
function render() {
  pal(); writeHash();
  const m = MK[S.m], c = P.areas[S.cma], ids = TRACTS[S.cma], d = domain(m), city = CITIES.find(x => x.id === S.cma);
  el.querySelector('#nb-h').textContent = cityName(city);
  const sel = el.querySelector('#nb-city');
  sel.innerHTML = CITIES.map(x => `<option value="${x.id}" ${x.id === S.cma ? 'selected' : ''}>${esc(cityName(x))} · ${nf(x.v[X.pop])}</option>`).join('');
  // measure picker (chips on desktop, a select on phones)
  el.querySelector('#nb-mselect').innerHTML = [...new Set(MS.map(x => x.g))].map(g => `<optgroup label="${g}">${MS.filter(x => x.g === g).map(x => `<option value="${x.k}" ${x.k === S.m ? 'selected' : ''}>${x.l}</option>`).join('')}</optgroup>`).join('');
  const groups = [...new Set(MS.map(x => x.g))];
  el.querySelector('#nb-ms').innerHTML = groups.map(g => `<div class="nb-g"><h3>${g}</h3><div>${MS.filter(x => x.g === g).map(x => `<button data-nbm="${x.k}" class="${x.k === S.m ? 'on' : ''}">${x.l}</button>`).join('')}</div></div>`).join('');
  el.querySelector('#nb-subwrap').innerHTML = m.sub ? `<label class="nb-sub"><span>${m.sub === 'vm' ? 'Group' : 'Place of birth'}</span><select id="nb-sub">${
    (m.sub === 'vm' ? VM_SUB : POB.map(k => [k, P.pob_names[k]])).map(([k, n]) => `<option value="${k}" ${k === subOf(m) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>` : '';
  // reading
  const vals = ids.map(id => [id, value(m, P.areas[id]), P.areas[id]]).filter(r => r[1] != null).sort((a, b) => a[1] - b[1]);
  const cv = value(m, c), rank = CITIES.map(x => [x.id, value(m, x)]).filter(r => r[1] != null).sort((a, b) => b[1] - a[1]), ri = rank.findIndex(r => r[0] === S.cma);
  const miss = ids.length - vals.length, lo = vals[0], hi = vals[vals.length - 1];
  el.querySelector('#nb-read').innerHTML = `<h2>${esc(mLabel(m))}</h2><p class="q">${esc(m.q)}</p>
    ${cv != null ? `<div class="big"><b>${m.f(cv)}</b><span>${esc(cityName(city))} overall${ri >= 0 ? ` · ${ord(ri + 1)} of ${rank.length} cities` : ''}</span></div>` : '<div class="big"><b>—</b><span>No city-wide figure published</span></div>'}
    ${vals.length ? `<p class="rng">Across its ${nf(ids.length)} tracts: from <b>${m.f(lo[1])}</b> to <b>${m.f(hi[1])}</b>.${miss ? ` ${nf(miss)} tract${miss > 1 ? 's have' : ' has'} no published value (shown blank).` : ''}</p>` : '<p class="rng">No tract values are published for this measure here.</p>'}
    ${hist(m, vals, d, cv)}
    <div class="scale" role="group" aria-label="Colour scale"><span>Colours fit</span><button data-scale="city" class="${S.scale === 'city' ? 'on' : ''}">this city</button><button data-scale="all" class="${S.scale === 'all' ? 'on' : ''}">all 50 cities</button></div>
    <p class="def">${esc(m.def)}</p>
    <p class="src">Source: Statistics Canada, 2021 Census of Population, Census Profile 98-401-X2021007 (census metropolitan areas, tracted agglomerations and census tracts). Boundaries: 2021 census tract digital boundary file (simplified; water areas inside tracts are not cut out).</p>`;
  el.querySelector('#nb-rank').innerHTML = `<h4>All 50 cities · ${esc(mLabel(m))}</h4><div class="nb-rank">${rank.map(([id, v], i) => { const x = CITIES.find(y => y.id === id), w = rank[0][1] > 0 ? Math.max(0, v) / Math.max(...rank.map(r => r[1])) * 100 : 0;
      return `<button data-nbc="${id}" class="${id === S.cma ? 'on' : ''}"><i>${i + 1}</i><span>${esc(cityName(x))}</span><em style="--w:${m.div ? 50 + v / Math.max(...rank.map(r => Math.abs(r[1]))) * 50 : w}%"></em><b>${m.f(v)}</b></button>`; }).join('')}</div>`;
  el.querySelector('#nb-legend').innerHTML = legend(m, d);
  detail(m);
  drawMap(m, d);
}
function hist(m, vals, d, cv) {
  if (vals.length < 3) return ''; const N = 28, W = 280, H = 54, lo = d.lo, hi = d.hi, bins = Array(N).fill(0);
  const tx = v => m.log ? (Math.log10(Math.max(v, 1)) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo)) : (v - lo) / (hi - lo);
  for (const [, v] of vals) bins[Math.max(0, Math.min(N - 1, Math.floor(tx(v) * N)))]++;
  const mx = Math.max(...bins), bw = W / N;
  const bars = bins.map((n, i) => { const h = n / mx * (H - 4), c = colour(m, m.log ? 10 ** (Math.log10(lo) + (i + 0.5) / N * (Math.log10(hi) - Math.log10(lo))) : lo + (i + 0.5) / N * (hi - lo), d);
    return `<rect x="${i * bw + 0.5}" y="${H - h}" width="${bw - 1}" height="${h}" rx="1" fill="rgb(${c})"><title>${n} tracts</title></rect>`; }).join('');
  const cx = cv == null ? null : Math.max(0, Math.min(1, tx(cv))) * W;
  return `<svg class="nb-hist" viewBox="0 0 ${W} ${H + 16}" role="img" aria-label="Distribution of tract values">${bars}
    ${cx != null ? `<line x1="${cx}" x2="${cx}" y1="0" y2="${H}" class="cm"/><text x="${Math.min(W - 2, Math.max(2, cx))}" y="${H + 12}" text-anchor="${cx < 40 ? 'start' : cx > W - 40 ? 'end' : 'middle'}">city ${m.t(cv)}</text>` : ''}
    <text x="0" y="${H + 12}" class="ax">${m.t(lo)}${S.scale === 'city' ? '' : ''}</text><text x="${W}" y="${H + 12}" text-anchor="end" class="ax">${m.t(hi)}</text></svg>`;
}
function legend(m, d) {
  const st = Array.from({ length: 12 }, (_, i) => { const t = i / 11, v = m.div ? d.lo + t * (d.hi - d.lo) : m.log ? 10 ** (Math.log10(d.lo) + t * (Math.log10(d.hi) - Math.log10(d.lo))) : d.lo + t * (d.hi - d.lo); return `rgb(${colour(m, v, d)}) ${t * 100}%`; });
  return `<div class="lg-t">${esc(mLabel(m))}</div><div class="lg-bar" style="background:linear-gradient(90deg,${st.join(',')})"></div>
    <div class="lg-ax"><span>${m.div ? '' : '≤ '}${m.t(d.lo)}</span>${m.div ? '<span>0</span>' : ''}<span>${m.div ? '' : '≥ '}${m.t(d.hi)}</span></div>
    <div class="lg-miss"><i></i>No published value</div>`;
}
function detail(m) {
  const box = el.querySelector('#nb-dt'), c = P.areas[S.cma], city = CITIES.find(x => x.id === S.cma);
  if (!S.tract) {
    const vals = TRACTS[S.cma].map(id => [id, value(m, P.areas[id])]).filter(r => r[1] != null).sort((a, b) => b[1] - a[1]);
    const row = ([id, v]) => `<button data-nbt="${id}"><span>Tract ${esc(P.areas[id].name)}</span><b>${m.f(v)}</b></button>`;
    box.innerHTML = `<h3>Click any neighbourhood</h3><p class="hint">Each shape is a census tract: a small, stable area of about 2,500 to 8,000 people. Statistics Canada names tracts by code, not by neighbourhood name.</p>
      ${vals.length ? `<h4>Highest</h4><div class="nb-list">${vals.slice(0, 5).map(row).join('')}</div><h4>Lowest</h4><div class="nb-list">${vals.slice(-5).reverse().map(row).join('')}</div>` : ''}`;
    return;
  }
  const a = P.areas[S.tract]; if (!a) { S.tract = null; return detail(m); }
  const rows = PROFILE_ROWS.map(k => { const mm = MK[k], sub = mm.sub === 'vm' ? 'vm' : null, g = sub ? x => val(x, 'vm') : x => mm.get(x, null);
    const tv = g(a), cv = g(c); const lab = sub ? 'Visible minority' : mm.l;
    return `<tr class="${k === S.m ? 'on' : ''}"><th><button data-nbm="${k}">${lab}</button></th><td>${tv == null ? '<span class="na">—</span>' : mm.f(tv)}</td><td>${cv == null ? '—' : mm.f(cv)}</td></tr>`; }).join('');
  const ph = val(a, 'ph'), pobs = POB.map(k => [k, a.pob?.[k]]).filter(r => r[1] > 0).sort((x, y) => y[1] - x[1]).slice(0, 8);
  const vms = VM_SUB.slice(1).map(([k, n]) => [n, val(a, k)]).filter(r => r[1] > 0).sort((x, y) => y[1] - x[1]).slice(0, 6);
  const bar = (n, v, mx, f) => `<div class="hb"><span>${esc(n)}</span><em style="--w:${v / mx * 100}%"></em><b>${f}</b></div>`;
  const lf = a.tnr?.[1];
  box.innerHTML = `<div class="dt-h"><div><span class="kick">${esc(cityName(city))}</span><h3>Tract ${esc(a.name)}</h3></div><button data-nbclear aria-label="Close">×</button></div>
    <div class="dt-pop"><b>${val(a, 'pop') == null ? '—' : nf(val(a, 'pop'))}</b> people in 2021${val(a, 'area') ? ` · ${nf(val(a, 'area'), 2)} km²` : ''}</div>
    <table class="dt"><thead><tr><th></th><th>Tract</th><th>City</th></tr></thead><tbody>${rows}</tbody></table>
    ${pobs.length && ph ? `<h4>Immigrants by place of birth <small>share of residents</small></h4>${pobs.map(([k, n]) => bar(P.pob_names[k], n, pobs[0][1], pc1(n / ph * 100))).join('')}` : ''}
    ${vms.length ? `<h4>Visible minority groups <small>share of residents</small></h4>${vms.map(([n, v]) => bar(n, v, vms[0][1], pc1(v))).join('')}` : ''}
    <p class="src">Counts are randomly rounded by Statistics Canada, so small shares are approximate.${lf != null ? ` Long-form non-response here: ${nf(lf, 1)}%${lf >= 25 ? ' (high: treat sample-based figures with care)' : ''}.` : ''} Income and many sample-based values are suppressed where response is too low.</p>`;
}

function drawMap(m, d) {
  const fs = FEATS[S.cma] || [], key = [S.cma, S.m, subOf(m), S.scale, PAL.page].join('|');
  const tracts = new GeoJsonLayer({ id: 'tracts', data: fs, pickable: true, stroked: true, filled: true,
    getFillColor: f => { const a = P.areas[f.properties.DGUID]; return [...colour(m, a ? value(m, a) : null, d), 255]; },
    getLineColor: [...PAL.line, 150], lineWidthUnits: 'pixels', getLineWidth: 0.6,
    autoHighlight: true, highlightColor: [...PAL.sel, 90], updateTriggers: { getFillColor: key, getLineColor: key } });
  const selF = S.tract ? fs.filter(f => f.properties.DGUID === S.tract) : [];
  const sel = new GeoJsonLayer({ id: 'sel', data: selF, stroked: true, filled: false, getLineColor: [...PAL.sel, 255], lineWidthUnits: 'pixels', getLineWidth: 2.5, updateTriggers: { getLineColor: key } });
  deckI.setProps({ layers: [tracts, sel] });
  el.querySelector('#nb-map').style.background = PAL.page;
}
function tip({ object, x, y }) {
  const t = el.querySelector('#nb-tip'); if (!object) { t.style.display = 'none'; return; }
  const a = P.areas[object.properties.DGUID], m = MK[S.m], v = a ? value(m, a) : null;
  t.innerHTML = `<b>Tract ${esc(a?.name || object.properties.CTNAME)}</b><span>${esc(mLabel(m))}: ${v == null ? 'no published value' : m.f(v)}</span><span>${a && val(a, 'pop') != null ? nf(val(a, 'pop')) + ' people' : ''}</span>`;
  t.style.display = 'block'; t.style.left = x + 14 + 'px'; t.style.top = y + 14 + 'px';
}

// ---------------------------------------------------------------- open / close / hash
function writeHash() { const m = MK[S.m], s = subOf(m); const h = `#nb=${S.cma.slice(-3)}/${S.m}${s ? '/' + s : ''}${S.tract ? '/t' + P.areas[S.tract].name : ''}`; if (location.hash !== h) history.replaceState(null, '', h); }
function readHash() {
  const h = decodeURIComponent(location.hash); if (!h.startsWith('#nb=')) return; const [c, mk, ...rest] = h.slice(4).split('/');
  const city = CITIES.find(x => x.code === c); if (city) S.cma = city.id; if (MK[mk]) S.m = mk;
  for (const r of rest) { if (r.startsWith('t')) { const id = (TRACTS[S.cma] || []).find(i => P.areas[i].name === r.slice(1)); if (id) S.tract = id; }
    else if (MK[S.m].sub === 'vm' && VM_SUB.some(v => v[0] === r)) S.vm = r; else if (MK[S.m].sub === 'pob' && P.pob_names[r]) S.pob = r; }
}
let prevHash = '';
async function open(opts = {}) {
  if (!el) build();
  if (!location.hash.startsWith('#nb=')) prevHash = location.hash;
  el.hidden = false; document.body.classList.add('nb-on');
  if (!ready) ready = load();
  await ready; el.querySelector('#nb-load').hidden = true;
  readHash();
  if (opts.city) { const c = CITIES.find(x => x.code === opts.city || x.name.toLowerCase().startsWith(String(opts.city).toLowerCase())); if (c) { S.cma = c.id; S.tract = null; } }
  if (opts.m && MK[opts.m]) S.m = opts.m;
  if (opts.sub) { if (MK[S.m].sub === 'vm' && VM_SUB.some(v => v[0] === opts.sub)) S.vm = opts.sub; else if (MK[S.m].sub === 'pob' && P.pob_names[opts.sub]) S.pob = opts.sub; }
  if (!deckI) deckI = new Deck({ parent: el.querySelector('#nb-map'), views: new OrthographicView({ flipY: false }), controller: { doubleClickZoom: true, inertia: true },
    initialViewState: { target: [0, 0, 0], zoom: 0 }, getCursor: ({ isHovering }) => isHovering ? 'pointer' : 'grab',
    onHover: tip, onClick: ({ object }) => { if (!object) return; S.tract = object.properties.DGUID; render(); },
    style: { position: 'absolute', inset: 0 } });
  render(); requestAnimationFrame(fit);
}
function close() { el.hidden = true; document.body.classList.remove('nb-on'); history.replaceState(null, '', prevHash || location.pathname + location.search); dispatchEvent(new Event('nb-close')); }
window.CITIES = { open, close, _render: () => render(), get state() { return S; }, get ready() { return ready; }, MS, VM_SUB, CITY_NAMES: () => CITIES.map(c => [c.code, cityName(c)]) };
if (location.hash.startsWith('#nb=')) open();
