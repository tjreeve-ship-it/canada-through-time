/* Canada Through Time — Explorer v0.2, "Aurora" design (?dir=b keeps the Lamplight comparison until the design is approved).
 * Same data, measures and evidence rules as web/explore; this file explores layout, type, colour and map treatment.
 * State lives in the URL hash (#chg-2026-ab) so any view can be shared.
 */
const { Deck, OrbitView, GeoJsonLayer, ColumnLayer, TextLayer, ArcLayer, PathLayer, ScatterplotLayer, LineLayer, LightingEffect, AmbientLight, DirectionalLight, COORDINATE_SYSTEM } = deck;
const CART = COORDINATE_SYSTEM.CARTESIAN;
const Q = new URLSearchParams(location.search);
const DIR = Q.get('dir') === 'b' ? 'b' : 'a';
document.body.classList.add('dir-' + DIR);

// ---------------------------------------------------------------- tokens
const css = getComputedStyle(document.body);
const tok = n => css.getPropertyValue('--' + n).trim();
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const C = n => rgb(tok(n));
const cssc = (c, a) => a == null ? `rgb(${c.join(',')})` : `rgba(${c.join(',')},${a})`;
const lerpC = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const UI_FONT = DIR === 'a' ? 'Public Sans' : 'IBM Plex Sans';

// ---------------------------------------------------------------- reference data
const PROV = ['NL', 'PE', 'NS', 'NB', 'QC', 'ON', 'MB', 'SK', 'AB', 'BC', 'YT', 'NT', 'NU'];
const NAMES = { CAN: 'Canada', NL: 'Newfoundland and Labrador', PE: 'Prince Edward Island', NS: 'Nova Scotia', NB: 'New Brunswick', QC: 'Quebec', ON: 'Ontario',
  MB: 'Manitoba', SK: 'Saskatchewan', AB: 'Alberta', BC: 'British Columbia', YT: 'Yukon', NT: 'Northwest Territories', NU: 'Nunavut', 'NT+NU': 'Northwest Territories incl. Nunavut' };
const PARTY = { // election layer only; always named in text
  'Liberal Party of Canada': ['Liberal', '#D71B1E'], 'Conservative Party of Canada': ['Conservative', '#1A4782'],
  'Progressive Conservative Party': ['Progressive Conservative', '#5A7FC6'], 'New Democratic Party': ['NDP', '#F58220'],
  'Bloc Québécois': ['Bloc Québécois', '#33B2CC'], 'Reform Party of Canada': ['Reform', '#3C9B48'],
  'Canadian Reform Conservative Alliance': ['Canadian Alliance', '#2E8B7A'], 'Social Credit Party of Canada': ['Social Credit', '#9DBB3A'],
  'Green Party of Canada': ['Green', '#3D9B35'], 'Independent': ['Independent', '#9A9A9A'], 'No affiliation to a recognised party': ['No affiliation', '#9A9A9A'],
};
const partyShort = p => (PARTY[p] || [p])[0];
const partyCol = p => rgb((PARTY[p] || [0, '#888888'])[1]);

// ---------------------------------------------------------------- formatting
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const fmtInt = n => Math.round(n).toLocaleString('en-CA');
const sig3 = n => { const a = Math.abs(n); const [d, s] = a >= 1e6 ? [1e6, 'M'] : a >= 1e3 ? [1e3, 'K'] : [1, '']; const v = n / d, av = Math.abs(v);
  return (av >= 100 || s === '' ? v.toFixed(0) : av >= 10 ? v.toFixed(1) : v.toFixed(2)) + s; };
const big3 = n => { const a = Math.abs(n); if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 1 : 2) + ' million'; return fmtInt(n); };
const pct = (p, dp = 0) => { const r = +(p * 100).toFixed(dp); return r === 0 ? '0%' : (r > 0 ? '+' : '−') + Math.abs(r).toFixed(dp) + '%'; };
const signed = (v, dp = 1) => { const r = +v.toFixed(dp); return r === 0 ? '0' : (r > 0 ? '+' : '−') + Math.abs(r).toFixed(dp); };
const fmtDate = d => { const [y, m, dd] = d.split('-').map(Number); return `${MONTHS[m - 1]} ${dd}, ${y}`; };
const ord = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');

// ---------------------------------------------------------------- load
const BASE = document.documentElement.dataset.base || '..'; // '.' when served from the site root (publish bundle)
const J = u => fetch(u.replace(/^\.\.\//, BASE + '/')).then(r => { if (!r.ok) throw new Error(u); return r.json(); });
const toKm = fc => { const c = x => typeof x[0] === 'number' ? [x[0] / 1e3, x[1] / 1e3] : x.map(c);
  fc.features.forEach(f => { f.geometry.coordinates = c(f.geometry.coordinates); if (f.properties.lx != null) { f.properties.lx /= 1e3; f.properties.ly /= 1e3; } }); return fc; };
const [pop, comp, flows, area, politics, evData, provinces, ntnu, countries, lakes, registry] = await Promise.all([
  J('../data/population.json'), J('../data/explorer/components.json'), J('../data/explorer/flows.json'), J('../data/explorer/area.json'),
  J('../data/explorer/politics.json'), J('../data/explorer/events.json'),
  J('../data/provinces.geojson').then(toKm), J('../data/ntnu_combined.geojson').then(toKm), J('../data/context_countries.geojson').then(toKm), J('../data/lakes.geojson').then(toKm),
  J('../data/explorer/registry.json')]);
await Promise.all([`600 16px "${UI_FONT}"`, `400 16px "${UI_FONT}"`, `500 16px "${UI_FONT}"`].map(f => document.fonts.load(f)));

const S = pop.series, D = pop.dates;
const PRELIM = { pop: (() => { const n = (pop.notes || []).find(x => /preliminary postcensal from/i.test(x)); const m = n && n.match(/preliminary postcensal from ([A-Z][a-z]+) (\d+), (\d{4})/i);
  return m ? `${m[3]}-${String(MONTHS.indexOf(m[1]) + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}` : null; })(), compPeriodStart: 2025 };
const isPrelim = (m, y) => (m.comp || m.kind === 'arcs') ? y - 1 >= PRELIM.compPeriodStart : m.kind === 'party' ? false : !!PRELIM.pop && `${y}-07-01` >= PRELIM.pop;
const YMIN = 1971, YMAX = +D.at(-1).slice(0, 4);
const julIdx = y => D.indexOf(`${y}-07-01`);
const popAt = (g, y) => { const i = julIdx(y); return i < 0 ? null : S[g]?.[i] ?? null; };
const anchor = {};
provinces.features.forEach(f => anchor[f.properties.abbr] = [f.properties.lx, f.properties.ly]);
anchor['NT+NU'] = [ntnu.features[0].properties.lx, ntnu.features[0].properties.ly];
const CALLOUT = { NB: [7380, 1330], NS: [8460, 1060], PE: [8330, 2120] }; // offshore label spots (km, StatCan Lambert)
const featsSplit = provinces.features;
const featsCombined = provinces.features.filter(f => !['NT', 'NU'].includes(f.properties.abbr)).concat(ntnu.features);
const geosFor = split => split ? PROV : PROV.filter(k => k !== 'NT' && k !== 'NU').concat('NT+NU');
const compAt = (g, y) => comp.data[g]?.[String(y - 1)] ?? null;
const events = evData.events;
const elections = politics.elections;
const electionAt = y => elections.filter(e => e.date <= `${y}-12-31`).at(-1) || null;
const ministryAt = date => politics.ministries.find(m => m.start <= date && (!m.end || m.end >= date));
const evKind = e => e.kind === 'election' ? 'elec' : e.kind === 'ministry' ? null : e.tag === 'data_note' ? 'note' : 'hist';

// outline paths (province boundaries drawn on top of the land plate)
const rings = f => f.geometry.type === 'Polygon' ? f.geometry.coordinates : f.geometry.coordinates.flat();
const outlines = feats => feats.flatMap(f => rings(f).map(r => ({ abbr: f.properties.abbr, path: r })));
const OUT_SPLIT = outlines(featsSplit), OUT_COMB = outlines(featsCombined);

// ---------------------------------------------------------------- colour scales
const SEQ = [1, 2, 3, 4, 5].map(i => C('seq-' + i)), DEC = [1, 2, 3].map(i => C('dec-' + i)), NEU = C('neutral');
const ramp = (stops, t) => { t = Math.max(0, Math.min(1, t)) * (stops.length - 1); const i = Math.min(stops.length - 2, Math.floor(t)); return lerpC(stops[i], stops[i + 1], t - i); };
function diverging(v, neg, posMax, dead) {
  if (v == null || isNaN(v)) return null;
  if (Math.abs(v) < dead) return NEU;
  return v > 0 ? ramp(SEQ, (v - dead) / (posMax - dead)) : ramp(DEC, (-v - dead) / (neg - dead));
}
function magnitude(v, lo, hi, log) {
  if (v == null || isNaN(v)) return null;
  return ramp(SEQ, log ? (Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo)) : (v - lo) / (hi - lo));
}

// ---------------------------------------------------------------- measures
const per1000 = (g, y, f) => { const c = compAt(g, y), p = popAt(g, y - 1) ?? popAt(g, y); return c && p ? f(c) / p * 1000 : null; };
const base71 = g => popAt(g, g === 'NT' || g === 'NU' ? 1991 : 1971);
const MEASURES = [
  { id: 'pop', group: 'Population', label: 'People', q: 'How many people live in each province and territory.', kind: 'spike', src: ['statcan_17100009'], tag: 'Official statistic',
    years: [1971, YMAX], split: y => y >= 1991, value: (g, y) => popAt(g, y), fmt: v => sig3(v), unit: 'people', legend: { kind: 'spike' },
    when: y => `July 1, ${y}` },
  { id: 'chg', group: 'Population', label: 'Change since 1971', q: 'How much each population has grown or shrunk since July 1971.', kind: 'fill', src: ['statcan_17100009'], tag: 'Derived',
    years: [1972, YMAX], split: y => y >= 1991, value: (g, y) => { const b = base71(g), v = popAt(g, y); return b && v ? v / b - 1 : null; },
    fmt: v => pct(v), unit: 'change in population', color: v => diverging(v, 0.15, 2, 0.02),
    legend: { kind: 'div', neg: 0.15, pos: 2, dead: 0.02, decl: [[-0.15, '−15%'], [-0.05, '−5%']], grow: [[0.5, '+50%'], [1, '+100%'], [2, '+200%']], deadLabel: 'within ±2%', deadTick: '±2%' },
    when: y => `July 1971 → July 1, ${y}` },
  { id: 'rate', group: 'Population', label: 'Growth in the past year', q: 'How fast each population changed over the twelve months to July 1.', kind: 'fill', src: ['statcan_17100009'], tag: 'Derived',
    years: [1972, YMAX], split: y => y >= 1992, value: (g, y) => { const a = popAt(g, y - 1), b = popAt(g, y); return a && b ? b / a - 1 : null; },
    fmt: v => pct(v, 1), unit: 'change over one year', color: v => diverging(v, 0.02, 0.04, 0.001),
    legend: { kind: 'div', neg: 0.02, pos: 0.04, dead: 0.001, decl: [[-0.02, '−2%'], [-0.01, '−1%']], grow: [[0.01, '+1%'], [0.02, '+2%'], [0.04, '+4%']], deadLabel: 'within ±0.1%', deadTick: '±0.1%' },
    when: y => `July 1, ${y - 1} → July 1, ${y}` },
  { id: 'dens', group: 'Population', label: 'People per km²', q: 'How many people there are for each square kilometre of land (log scale).', kind: 'fill', src: ['statcan_17100009', 'statcan_98100001'], tag: 'Derived',
    years: [1971, YMAX], split: y => y >= 1991, value: (g, y) => { const a = g === 'NT+NU' ? area.data.NT + area.data.NU : area.data[g]; const p = popAt(g, y); return a && p ? p / a : null; },
    fmt: v => v < 1 ? v.toFixed(2) : v.toFixed(1), unit: 'people per km²', color: v => magnitude(v, 0.02, 40, true),
    legend: { kind: 'mag', ticks: [[0, '0.02'], [0.36, '0.3'], [0.68, '3'], [1, '40']], cap: 'People per km² · log scale · 2021 land area' }, when: y => `July 1, ${y}` },
  { id: 'share', group: 'Population', label: 'Share of Canadians', q: 'What share of everyone in Canada lives in each province and territory.', kind: 'spike', src: ['statcan_17100009'], tag: 'Derived',
    years: [1971, YMAX], split: y => y >= 1991, value: (g, y) => { const p = popAt(g, y), c = popAt('CAN', y); return p && c ? p / c : null; }, height: (g, y) => popAt(g, y),
    fmt: v => (v * 100).toFixed(v < 0.01 ? 2 : 1) + '%', unit: 'of Canada’s population',
    colorBy: (g, y) => { const b0 = g === 'NT' || g === 'NU' ? 1991 : 1971; return (popAt(g, y) / popAt('CAN', y)) / (popAt(g, b0) / popAt('CAN', b0)) - 1; },
    color: v => diverging(v, 0.4, 0.6, 0.02), legend: { kind: 'spike', div: { neg: 0.4, pos: 0.6, dead: 0.02, decl: [[-0.4, '−40%'], [-0.2, '−20%']], grow: [[0.3, '+30%'], [0.6, '+60%']], deadLabel: 'within ±2%', deadTick: '±2%', cap: 'Colour: change in share since 1971' } },
    when: y => `July 1, ${y}` },
  { id: 'nat', group: 'Where growth came from', label: 'Natural increase', q: 'Births minus deaths over the year, for every 1,000 residents.', kind: 'fill', src: ['statcan_17100008'], tag: 'Derived',
    years: [1972, YMAX], split: y => y >= 1992, value: (g, y) => per1000(g, y, c => c.births - c.deaths), fmt: v => signed(v), unit: 'per 1,000 people',
    color: v => diverging(v, 5, 25, 0.5), legend: { kind: 'div', neg: 5, pos: 25, dead: 0.5, decl: [[-5, '−5'], [-2.5, '−2.5']], grow: [[10, '+10'], [25, '+25']], deadLabel: 'within ±0.5', deadTick: '±0.5' }, comp: true },
  { id: 'imm', group: 'Where growth came from', label: 'Immigrants', q: 'New permanent residents who settled here, for every 1,000 residents.', kind: 'fill', src: ['statcan_17100008'], tag: 'Derived',
    years: [1972, YMAX], split: y => y >= 1992, value: (g, y) => per1000(g, y, c => c.immigrants), fmt: v => v.toFixed(1), unit: 'per 1,000 people',
    color: v => magnitude(v, 0, 16, false), legend: { kind: 'mag', ticks: [[0, '0'], [0.25, '4'], [0.5, '8'], [0.75, '12'], [1, '16+']], cap: 'Immigrants per 1,000 people' }, comp: true },
  { id: 'npr', group: 'Where growth came from', label: 'Temporary residents (net)', q: 'Net change in permit holders and asylum claimants, for every 1,000 residents.', kind: 'fill', src: ['statcan_17100008'], tag: 'Derived',
    years: [1972, YMAX], split: y => y >= 1992, value: (g, y) => per1000(g, y, c => c.net_npr ?? 0), fmt: v => signed(v), unit: 'per 1,000 people',
    color: v => diverging(v, 10, 25, 0.5), legend: { kind: 'div', neg: 10, pos: 25, dead: 0.5, decl: [[-10, '−10'], [-5, '−5']], grow: [[10, '+10'], [25, '+25']], deadLabel: 'within ±0.5', deadTick: '±0.5' }, comp: true },
  { id: 'emi', group: 'Where growth came from', label: 'Emigration (net)', q: 'People leaving Canada, net of those returning, for every 1,000 residents.', kind: 'fill', src: ['statcan_17100008'], tag: 'Derived',
    years: [1972, YMAX], split: y => y >= 1992, value: (g, y) => per1000(g, y, c => c.net_emigration), fmt: v => v.toFixed(1), unit: 'per 1,000 people',
    color: v => magnitude(v, 0, 4, false), legend: { kind: 'mag', ticks: [[0, '0'], [0.25, '1'], [0.5, '2'], [0.75, '3'], [1, '4+']], cap: 'Net emigrants per 1,000 people' }, comp: true },
  { id: 'ipm', group: 'Where growth came from', label: 'Moves between provinces', q: 'Net arrivals from the rest of Canada, for every 1,000 residents.', kind: 'fill', src: ['statcan_17100008'], tag: 'Derived',
    years: [1972, YMAX], split: y => y >= 1992, value: (g, y) => per1000(g, y, c => c.net_interprovincial ?? 0), fmt: v => signed(v), unit: 'per 1,000 people',
    color: v => diverging(v, 25, 25, 0.5), legend: { kind: 'div', neg: 25, pos: 25, dead: 0.5, decl: [[-20, '−20'], [-10, '−10']], grow: [[10, '+10'], [20, '+20']], deadLabel: 'within ±0.5', deadTick: '±0.5' }, comp: true },
  { id: 'flow', group: 'Where growth came from', label: 'Migration flows', q: 'Where people moved between provinces. Choose a province to see all of its flows.', kind: 'arcs', src: ['statcan_17100045'], tag: 'Official statistic',
    years: [1972, Math.max(...flows.complete_periods) + 1], split: y => y >= 1992, value: (g, y) => per1000(g, y, c => c.net_interprovincial ?? 0), fmt: v => signed(v), unit: 'net arrivals per 1,000 people',
    legend: { kind: 'flow' } },
  { id: 'fed', group: 'Politics', label: 'Federal election seats', q: 'Which party won the most House of Commons seats in each province.', kind: 'party', src: ['parlinfo_elected'], tag: 'Official statistic',
    years: [1972, YMAX], split: y => y >= 1997, value: (g, y) => { const e = electionAt(y); const s = e?.seats_by_province[g === 'NT+NU' ? 'NT' : g]; return s ? Object.entries(s)[0] : null; },
    fmt: v => v ? `${partyShort(v[0])} ${v[1]}` : '—', unit: 'seats', legend: { kind: 'party' },
    when: y => { const e = electionAt(y); return e ? `Election of ${fmtDate(e.date)}` : 'No election yet in range'; } },
];
const M = Object.fromEntries(MEASURES.map(m => [m.id, m]));
const compWhen = y => `July 1, ${y - 1} → June 30, ${y}`;
const whenOf = (m, y) => m.comp || m.kind === 'arcs' ? compWhen(y) : m.when(y);

// ---------------------------------------------------------------- state
const state = { m: 'pop', y: YMAX, p: null, playing: false, speed: 0.8 };
const enc = g => g === 'NT+NU' ? 'ntnu' : g.toLowerCase(), dec = t => t === 'ntnu' ? 'NT+NU' : (t || '').toUpperCase();
function applyHash() { const [m, y, p] = location.hash.slice(1).split('-'); if (M[m]) state.m = m; if (+y >= YMIN && +y <= YMAX) state.y = +y; state.p = NAMES[dec(p)] && dec(p) !== 'CAN' ? dec(p) : null; }
applyHash();
const writeHash = () => { const t = `#${state.m}-${state.y}${state.p ? '-' + enc(state.p) : ''}`; if (location.hash !== t) history.replaceState(null, '', t); };
addEventListener('hashchange', () => { applyHash(); update(); });
const clampYear = (m, y) => Math.max(m.years[0], Math.min(m.years[1], y));
const isPhone = () => innerWidth <= 760;

// ---------------------------------------------------------------- deck
const PEEK = 168;
function fitView() {
  const w = innerWidth, h = innerHeight, phone = isPhone();
  const [x0, x1, y0, y1] = phone ? [0, w, 150, h - Math.min(window.__sheetH || PEEK, h * 0.5)] : [300, w - 410, 300, h - 140];
  const zoom = Math.log2(Math.min((x1 - x0) / (phone ? 5000 : 5600), (y1 - y0) / (phone ? 3400 : 4300)));
  const s = 2 ** zoom, dx = (x0 + x1) / 2 - w / 2, dy = (y0 + y1) / 2 - h / 2;
  return { target: [(phone ? 6250 : 6420) - dx / s, (phone ? +(Q.get('ty') || 1550) : 2200) + dy / s * 1.25, 0], zoom, rotationX: phone ? 34 : 40, rotationOrbit: 0, minZoom: zoom - 1.5, maxZoom: zoom + 4 };
}
let view = fitView();
const theDeck = new Deck({
  parent: document.getElementById('map'), views: new OrbitView({ orbitAxis: 'Z', fovy: 28 }),
  controller: { dragMode: 'pan', inertia: true, scrollZoom: { smooth: true, speed: 0.02 } },
  viewState: view, onViewStateChange: ({ viewState }) => { view = { ...viewState, rotationX: Math.max(0, Math.min(70, viewState.rotationX)) }; theDeck.setProps({ viewState: view }); },
  effects: [new LightingEffect({ a: new AmbientLight({ color: [255, 255, 255], intensity: DIR === 'a' ? 0.82 : 0.95 }),
    k: new DirectionalLight({ color: [255, 244, 228], intensity: DIR === 'a' ? 1.15 : 0.7, direction: [-3, -6, -7] }) })],
  parameters: { clearColor: [0, 0, 0, 0] },
  getCursor: ({ isHovering, isDragging }) => isDragging ? 'grabbing' : isHovering ? 'pointer' : 'grab',
  onHover: info => tooltip(info), onClick: info => click(info),
});
if (DIR === 'b') document.getElementById('map').style.background = 'var(--ocean)'; // engraved contours need a flat sea

const tt = document.getElementById('tooltip');
function tooltip(info) {
  const o = info.object; if (!o || isPhone()) { tt.style.display = 'none'; return; }
  let html = '';
  if (o.properties?.abbr || o.k) { const g = o.properties?.abbr || o.k; const m = M[state.m]; const v = m.value(g, state.y);
    html = `<b>${NAMES[g]}</b><div class="m">${m.label}: ${v == null ? 'no data' : m.fmt(v)}</div>`; }
  else if (o.o) html = `<b>${NAMES[o.o]} → ${NAMES[o.d]}</b><div class="m">${fmtInt(o.v)} moves, July ${state.y - 1}–June ${state.y}</div>`;
  else if (o.title) html = `<b>${o.title}</b><div class="m">${fmtDate(o.date)} · ${o.where}</div>`;
  tt.innerHTML = html; tt.style.display = html ? 'block' : 'none';
  tt.style.left = Math.min(info.x + 14, innerWidth - 290) + 'px'; tt.style.top = (info.y + 14) + 'px';
}
function click(info) {
  const o = info.object; if (!o) return;
  if (o.title) { openEvent(o); return; }
  const g = o.properties?.abbr || o.k; if (!g) return;
  state.p = state.p === g ? null : g; update();
  if (isPhone() && state.p) setSheet(1);
}

// ---------------------------------------------------------------- map layers
const PLATE = DIR === 'a' ? 26 : 0;   // land plate thickness (km): a constant, never data
const KMPM = 70;                      // spike height: 70 km per million people (same as the videos)
const allLand = { type: 'FeatureCollection', features: [...countries.features, ...provinces.features] };
function seaLayers() {
  if (DIR === 'a') { // soft continental-shelf glow: purely atmospheric, drawn under the land
    const sh = C('shelf');
    return [[46, 18], [26, 34], [12, 60], [5, 90]].map(([w, a], i) => new GeoJsonLayer({ id: 'shelf' + i, data: allLand, coordinateSystem: CART, filled: false, stroked: true,
      getLineColor: [...sh, a], lineWidthUnits: 'pixels', getLineWidth: w, lineJointRounded: true, parameters: { depthTest: false } }));
  }
  // engraved depth contours, as on a printed atlas plate
  const ring = C('shelf'), sea = C('ocean');
  return [[34, ring], [32, sea], [18, ring], [16, sea]].map(([w, c], i) => new GeoJsonLayer({ id: 'ring' + i, data: allLand, coordinateSystem: CART, filled: false, stroked: true,
    getLineColor: c, lineWidthUnits: 'pixels', getLineWidth: w, lineJointRounded: true, parameters: { depthTest: false } }));
}
const neighbour = new GeoJsonLayer({ id: 'nb', data: countries, coordinateSystem: CART, filled: true, stroked: true, getFillColor: C('neighbour'),
  getLineColor: [...C('boundary'), 70], lineWidthUnits: 'pixels', getLineWidth: 0.8, parameters: { depthTest: false } });
const liftZ = (fc, z) => ({ ...fc, features: fc.features.map(f => ({ ...f, geometry: { ...f.geometry, coordinates: (function c(x) { return typeof x[0] === 'number' ? [x[0], x[1], z] : x.map(c); })(f.geometry.coordinates) } })) });
const lakeLayer = new GeoJsonLayer({ id: 'lakes', data: liftZ(lakes, PLATE + 0.5), coordinateSystem: CART, filled: true, stroked: true, getFillColor: C('ocean'), getLineColor: [...C('coast'), 90],
  lineWidthUnits: 'pixels', getLineWidth: 0.6, parameters: { depthTest: false } });

function layers() {
  const m = M[state.m], y = state.y, split = m.split(y);
  const feats = split ? featsSplit : featsCombined, geos = geosFor(split);
  const val = Object.fromEntries(geos.map(g => [g, m.value(g, y)]));
  const sel = state.p && (geos.includes(state.p) ? state.p : (state.p === 'NT' || state.p === 'NU') && !split ? 'NT+NU' : state.p);
  const landC = C('land'), dimC = C('land-dim');
  const fillColor = f => {
    const g = f.properties.abbr, v = val[g];
    if (m.kind === 'fill') return v == null ? landC : m.color(v);
    if (m.kind === 'party') return v ? lerpC(partyCol(v[0]), C('ocean'), 0.18) : landC;
    if (m.kind === 'arcs') return state.p && g !== sel ? dimC : landC;
    return landC;
  };
  const z = PLATE;
  const L = [...seaLayers(), neighbour,
    new GeoJsonLayer({ id: 'land', data: feats, coordinateSystem: CART, filled: true, stroked: !PLATE, extruded: !!PLATE, pickable: true,
      getElevation: z, getFillColor: fillColor, getLineColor: C('boundary'), lineWidthUnits: 'pixels', getLineWidth: 1,
      material: { ambient: 0.62, diffuse: 0.55, shininess: 6, specularColor: [30, 30, 30] },
      updateTriggers: { getFillColor: [state.m, y, state.p] }, transitions: { getFillColor: 450 } }),
    lakeLayer,
    new PathLayer({ id: 'bounds', data: split ? OUT_SPLIT : OUT_COMB, coordinateSystem: CART, getPath: d => d.path.map(p => [p[0], p[1], z + 0.6]),
      getColor: [...C('boundary'), DIR === 'a' ? 150 : 190], widthUnits: 'pixels', getWidth: DIR === 'a' ? 0.9 : 1.1, jointRounded: true, parameters: { depthTest: false } }),
  ];
  if (sel) { const sp = (split ? OUT_SPLIT : OUT_COMB).filter(d => d.abbr === sel);
    L.push(new PathLayer({ id: 'sel-halo', data: sp, coordinateSystem: CART, getPath: d => d.path.map(p => [p[0], p[1], z + 0.8]), getColor: [...C('ocean'), 220], widthUnits: 'pixels', getWidth: 6, jointRounded: true, parameters: { depthTest: false } }),
      new PathLayer({ id: 'sel', data: sp, coordinateSystem: CART, getPath: d => d.path.map(p => [p[0], p[1], z + 1]), getColor: C('accent'), widthUnits: 'pixels', getWidth: 2.4, jointRounded: true, parameters: { depthTest: false } })); }
  const pts = geos.map(g => ({ k: g, p: anchor[g] }));
  if (m.kind === 'spike') {
    const h = g => ((m.height ? m.height(g, y) : val[g]) || 0) / 1e6 * KMPM;
    const col = d => m.colorBy ? (m.color(m.colorBy(d.k, y)) || NEU) : C('spike');
    L.push(new ColumnLayer({ id: 'foot', data: pts, coordinateSystem: CART, diskResolution: 32, radius: 95, extruded: false, getPosition: d => [d.p[0], d.p[1], z + 1.2],
        getFillColor: [...C('ocean'), 120], parameters: { depthTest: false } }),
      new ColumnLayer({ id: 'spikes', data: pts, coordinateSystem: CART, diskResolution: 32, radius: 44, extruded: true, pickable: true,
        getPosition: d => [d.p[0], d.p[1], z], getElevation: d => h(d.k), getFillColor: col,
        material: { ambient: 0.5, diffuse: 0.65, shininess: 40, specularColor: [70, 70, 70] },
        updateTriggers: { getElevation: [state.m, y], getFillColor: [state.m, y] }, transitions: { getElevation: 500, getFillColor: 400 } }));
    L.push(...labels(pts, d => [d.p[0], d.p[1], z + h(d.k)], val, m, sel));
  } else {
    if (m.kind === 'arcs') L.push(arcs(y, sel, z));
    L.push(...labels(pts, d => [d.p[0], d.p[1], z], val, m, sel));
  }
  L.push(...eventPins(y, z));
  return L;
}
function labels(pts, pos, val, m, sel) {
  const phone = isPhone(), halo = [...C('ocean'), 235];
  const at = d => CALLOUT[d.k] ? [...CALLOUT[d.k], PLATE + 2] : pos(d);
  const showVal = d => !phone || d.k === sel;
  const valText = d => { const v = val[d.k]; if (m.kind === 'party') return v ? `${partyShort(v[0])} ${v[1]}` : ''; return v == null ? '—' : m.fmt(v); };
  const common = { coordinateSystem: CART, parameters: { depthTest: false }, getPosition: at, fontFamily: UI_FONT, characterSet: 'auto',
    fontSettings: { sdf: true, fontSize: 64, buffer: 10 }, outlineWidth: 5, outlineColor: halo, transitions: { getPosition: 500 } };
  const off = (d, y) => CALLOUT[d.k] ? [0, y + 10] : [0, y - (m.kind === 'spike' ? 10 : 0)];
  return [
    new LineLayer({ id: 'leaders', data: pts.filter(d => CALLOUT[d.k]), coordinateSystem: CART, parameters: { depthTest: false },
      getSourcePosition: pos, getTargetPosition: d => [...CALLOUT[d.k], PLATE + 2], getColor: [...C('ink-3'), 200], getWidth: 1, widthUnits: 'pixels',
      updateTriggers: { getSourcePosition: [state.m, state.y] } }),
    new TextLayer({ id: 'abbr', data: pts, ...common, getText: d => d.k === 'NT+NU' ? 'NT + NU' : d.k,
      getSize: d => d.k === sel ? 13 : phone ? 10.5 : 11.5, fontWeight: 600, getColor: d => d.k === sel ? C('accent') : [...C('ink-2'), 255],
      getPixelOffset: d => off(d, showVal(d) ? -16 : -2), updateTriggers: { getPosition: [state.m, state.y], getColor: [sel], getSize: [sel, phone], getPixelOffset: [sel, phone, state.m] } }),
    new TextLayer({ id: 'val', data: pts.filter(showVal), ...common, getText: valText,
      getSize: d => d.k === sel ? 17 : 14.5, fontWeight: 600, getColor: C('ink-1'), getPixelOffset: d => off(d, 0),
      updateTriggers: { getPosition: [state.m, state.y], getText: [state.m, state.y], getSize: [sel], getPixelOffset: [state.m] } }),
  ];
}
function arcs(y, sel, z) {
  const rows = flows.data[String(y - 1)] || [];
  let data = rows.map(([o, d, v]) => ({ o, d, v }));
  data = sel ? data.filter(r => r.o === sel || r.d === sel) : data.sort((a, b) => b.v - a.v).slice(0, 40);
  const max = Math.max(1, ...data.map(r => r.v));
  const dim = lerpC(SEQ[1], C('ocean'), 0.2), bright = SEQ[4], out = DEC[2];
  return new ArcLayer({ id: 'arcs', data, coordinateSystem: CART, pickable: true, greatCircle: false,
    getSourcePosition: r => [...anchor[r.o], z], getTargetPosition: r => [...anchor[r.d], z], getHeight: 0.35, getTilt: 0,
    getWidth: r => 1 + 16 * Math.sqrt(r.v / max), widthUnits: 'pixels',
    getSourceColor: r => [...(sel && r.o === sel ? out : dim), 190], getTargetColor: r => [...(sel && r.o === sel ? out : bright), 235],
    updateTriggers: { getWidth: [y, sel], getSourceColor: [sel], getTargetColor: [sel] } });
}
function eventPins(y, z) {
  const evs = events.filter(e => +e.date.slice(0, 4) === y && evKind(e) && evKind(e) !== 'elec');
  return [new ScatterplotLayer({ id: 'pins', data: evs, coordinateSystem: CART, pickable: true, getPosition: e => [...e.xy, z + 3], radiusUnits: 'pixels', getRadius: 6,
    stroked: true, filled: true, getFillColor: C('accent'), getLineColor: [...C('ocean'), 255], lineWidthUnits: 'pixels', getLineWidth: 2.5, parameters: { depthTest: false } })];
}

// ---------------------------------------------------------------- layer menu (rail on desktop, sheet on phone)
const swatch = m => m.kind === 'spike' && !m.colorBy ? `background:${tok('spike')}` : m.kind === 'party' ? 'background:repeating-linear-gradient(90deg,var(--ink-3) 0 4px,transparent 4px 6px)'
  : m.kind === 'arcs' ? `background:linear-gradient(90deg,${cssc(SEQ[1])},${cssc(SEQ[4])})` : m.legend.kind === 'div' || m.legend.div ? `background:linear-gradient(90deg,${cssc(DEC[1])} 0 22%,${cssc(NEU)} 22% 30%,${cssc(SEQ[1])} 30%,${cssc(SEQ[4])})`
  : `background:linear-gradient(90deg,${cssc(SEQ[0])},${cssc(SEQ[4])})`;
const menuHTML = () => { let g = ''; return MEASURES.map(m => { const head = m.group !== g ? `<div class="grp">${(g = m.group)}</div>` : '';
  return head + `<button class="opt" data-m="${m.id}">${m.label}<i class="sw" style="${swatch(m)}"></i></button>`; }).join(''); };
document.getElementById('layers').innerHTML = menuHTML();
document.getElementById('layer-sheet').innerHTML = `<div style="font:500 22px var(--font-display);margin:0 0 6px">Map layers</div>` + menuHTML();
for (const id of ['layers', 'layer-sheet']) document.getElementById(id).addEventListener('click', e => { const b = e.target.closest('.opt'); if (!b) return;
  state.m = b.dataset.m; state.y = clampYear(M[state.m], state.y); document.getElementById('layer-sheet').classList.remove('open'); update(); });
document.getElementById('layer-btn').onclick = () => document.getElementById('layer-sheet').classList.toggle('open');
document.getElementById('start').innerHTML = `New here? Try <a data-go="chg">where Canada grew</a>, <a data-go="imm">where immigrants settled</a> or <a data-go="flow">who moved where</a>.`;
document.getElementById('start').onclick = e => { const g = e.target.dataset.go; if (g) { state.m = g; state.p = null; state.y = clampYear(M[g], YMAX); update(); } };

// ---------------------------------------------------------------- timeline
const yr = document.getElementById('year'), myr = document.getElementById('myear');
const span = YMAX - YMIN;
const xPct = date => { const [y, m] = date.split('-').map(Number); return Math.max(0, Math.min(100, (y + (m - 1) / 12 - YMIN) / span * 100)); };
const ERAS = politics.ministries.filter(m => !m.end || m.end >= '1971-01-01').map(m => ({ ...m, a: xPct(m.start < '1971-01-01' ? '1971-01-01' : m.start), b: xPct(m.end || `${YMAX}-12-31`) }));
function drawEras() {
  const W = document.getElementById('tl-era').offsetWidth;
  document.getElementById('tl-era').innerHTML = ERAS.map((m, i) => { const px = (m.b - m.a) / 100 * W, name = m.pm.split(' ').at(-1);
    const label = px > name.length * 7 + 14 ? name : '';
    return `<span data-i="${i}" title="${m.pm} · ${partyShort(m.party)} · ${fmtDate(m.start)} to ${m.end ? fmtDate(m.end) : 'present'}" style="left:${m.a}%;width:${m.b - m.a}%">${label}</span>`; }).join('');
}
const YEAR_EV = {}; events.forEach(e => { const k = evKind(e); if (!k) return; const y = +e.date.slice(0, 4); (YEAR_EV[y] ||= []).push({ ...e, k }); });
document.getElementById('tl-ev').innerHTML = Object.entries(YEAR_EV).flatMap(([y, es]) => { const kinds = [...new Set(es.map(e => e.k))];
  return kinds.map((k, j) => `<i class="m-${k}" data-y="${y}" title="${es.filter(e => e.k === k).map(e => e.title).join(' · ')}" style="left:calc(${(y - YMIN) / span * 100}% + ${(j - (kinds.length - 1) / 2) * 11}px)"></i>`); }).join('');
document.getElementById('tl-ev').onclick = e => { const y = e.target.dataset.y; if (y) { state.y = clampYear(M[state.m], +y); stop(); update(); } };
document.getElementById('tl-ticks').innerHTML = [1971, 1980, 1990, 2000, 2010, 2020, YMAX].map(y => `<span style="left:${(y - YMIN) / span * 100}%">${y}</span>`).join('');
for (const r of [yr, myr]) { r.min = YMIN; r.max = YMAX; r.oninput = () => { state.y = clampYear(M[state.m], +r.value); stop(); update(); }; }
let timer = null;
const playBtns = [document.getElementById('play'), document.getElementById('mplay')];
const stop = () => { state.playing = false; clearTimeout(timer); playBtns.forEach(b => { b.textContent = '▶'; b.setAttribute('aria-label', 'Play'); }); };
const step = () => { const m = M[state.m]; if (state.y >= m.years[1]) { stop(); return; } state.y++; update(); timer = setTimeout(step, state.speed * 1000); };
const toggle = () => { if (state.playing) return stop(); const m = M[state.m]; if (state.y >= m.years[1]) state.y = m.years[0];
  state.playing = true; playBtns.forEach(b => { b.textContent = '❚❚'; b.setAttribute('aria-label', 'Pause'); }); update(); timer = setTimeout(step, state.speed * 1000); };
playBtns.forEach(b => b.onclick = toggle);
document.getElementById('tl-speed').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; state.speed = +b.dataset.s;
  document.querySelectorAll('#tl-speed button').forEach(x => x.classList.toggle('on', x === b)); });

// ---------------------------------------------------------------- map controls
document.getElementById('mapctl').addEventListener('click', e => { const a = e.target.closest('button')?.dataset.act; if (!a) return;
  const v = { ...view };
  if (a === 'zin') v.zoom += 0.5; if (a === 'zout') v.zoom -= 0.5;
  if (a === 'tilt') v.rotationX = v.rotationX > 10 ? 0 : fitView().rotationX; if (a === 'reset') Object.assign(v, fitView());
  view = { ...v, transitionDuration: 500, transitionInterpolator: new deck.LinearInterpolator(['target', 'zoom', 'rotationX', 'rotationOrbit']) };
  theDeck.setProps({ viewState: view }); });
addEventListener('resize', () => { view = { ...view, ...fitView() }; theDeck.setProps({ viewState: view }); drawEras(); update(); });
addEventListener('keydown', e => { if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
  if (e.key === 'ArrowRight') { state.y = clampYear(M[state.m], state.y + 1); stop(); update(); }
  if (e.key === 'ArrowLeft') { state.y = clampYear(M[state.m], state.y - 1); stop(); update(); }
  if (e.key === ' ' && e.target === document.body) { e.preventDefault(); toggle(); }
  if (e.key === 'Escape') { state.p = null; update(); } });

// ---------------------------------------------------------------- reading block: measure, date, status, legend
function legendHTML(m) {
  const L = m.legend;
  const arms = d => { const tick = (lo, hi) => ([v, t]) => `<span style="left:${(Math.abs(v) - lo) / (hi - lo) * 100}%">${t}</span>`;
    const n = 24, strip = (f) => Array.from({ length: n }, (_, i) => `<span style="background:${cssc(f((i + 0.5) / n))}"></span>`).join('');
    const declW = d.neg === d.pos ? 46 : 26;
    return `${d.cap ? `<div class="cap">${d.cap}</div>` : ''}<div class="row">
      <div class="arm" style="width:${declW}%"><div class="bar" style="flex-direction:row-reverse">${strip(t => ramp(DEC, t))}</div><div class="ticks">${d.decl.map(([v, t]) => `<span style="left:${100 - (Math.abs(v) - d.dead) / (d.neg - d.dead) * 100}%">${t}</span>`).join('')}</div></div>
      <div class="arm" style="width:9%"><div class="bar"><span style="background:${cssc(NEU)}"></span></div><div class="ticks"><span style="left:50%">${d.deadTick}</span></div></div>
      <div class="arm" style="flex:1"><div class="bar">${strip(t => ramp(SEQ, t))}</div><div class="ticks">${d.grow.map(([v, t]) => `<span style="left:${(v - d.dead) / (d.pos - d.dead) * 100}%">${t}</span>`).join('')}</div></div></div>
      <div class="note">Shrank on the left, grew on the right; middle swatch = ${d.deadLabel}. Each side has its own scale.</div>`; };
  if (L.kind === 'div') return arms(L);
  if (L.kind === 'mag') return `<div class="cap">${L.cap}</div><div class="bar">${Array.from({ length: 24 }, (_, i) => `<span style="background:${cssc(ramp(SEQ, (i + 0.5) / 24))}"></span>`).join('')}</div><div class="ticks">${L.ticks.map(([p, t]) => `<span style="left:${p * 100}%">${t}</span>`).join('')}</div>`;
  if (L.kind === 'spike') return `<div class="spike"><i></i><i></i><i></i><div><b style="font-weight:500;color:var(--ink-1)">Spike height = number of people</b><div class="note" style="margin-top:2px">70 km of height per million people. Spikes stand inside each province, not at its population centre.</div></div></div>` + (L.div ? `<div style="margin-top:12px">${arms(L.div)}</div>` : '');
  if (L.kind === 'flow') return `<div>Arc width = people moving, July–June.</div><div class="note">${state.p ? `<span class="sw"><b style="background:${cssc(DEC[2])}"></b>leaving ${state.p}</span><span class="sw"><b style="background:${cssc(SEQ[4])}"></b>arriving in ${state.p}</span>` : 'Bright end = destination. Showing the 40 largest flows.'}</div>`;
  if (L.kind === 'party') { const e = electionAt(state.y); const ps = e ? Object.keys(e.seats_total) : [];
    return `<div>${ps.slice(0, 6).map(p => `<span class="sw"><b style="background:${cssc(partyCol(p))}"></b>${partyShort(p)} ${e.seats_total[p]}</span>`).join('')}</div><div class="note">Seats won, not votes. Party colours appear only on this layer.</div>`; }
  return '';
}
function reading(m) {
  document.getElementById('r-group').textContent = m.group;
  document.getElementById('r-title').textContent = m.label;
  document.getElementById('r-q').textContent = m.q;
  const chips = [];
  if (isPrelim(m, state.y)) chips.push(`<button class="chip prelim" data-why="prelim"><i></i>Preliminary</button>`);
  if (!m.split(state.y)) chips.push(`<button class="chip" data-why="ntnu">N.W.T. and Nunavut combined</button>`);
  if (m.id === 'fed' && electionAt(state.y)?.date === '2025-04-28') chips.push(`<button class="chip" data-why="seats">341 of 343 seats recorded</button>`);
  chips.push(`<button class="chip src" data-why="src">${m.tag === 'Derived' ? 'Derived · ' : ''}${m.src.map(s => registry[s].table_id ? 'StatCan ' + registry[s].table_id : registry[s].publisher.split(',')[0]).join(' + ')}</button>`);
  document.getElementById('r-meta').innerHTML = `<span>${whenOf(m, state.y)}</span>` + chips.join('');
  document.getElementById('legend').innerHTML = legendHTML(m);
  document.getElementById('layer-btn').textContent = 'Layers';
}
document.getElementById('r-meta').addEventListener('click', e => { const w = e.target.closest('[data-why]')?.dataset.why; if (w) openSource(M[state.m], w); });

// ---------------------------------------------------------------- place sheet
const body = document.getElementById('sheet-body');
function chartSVG(g, m) {
  const ys = []; for (let y = m.years[0]; y <= m.years[1]; y++) { let gg = g; if (!m.split(y) && (g === 'NT' || g === 'NU')) gg = 'NT+NU'; if (m.split(y) && g === 'NT+NU') continue;
    const v = m.kind === 'party' ? null : m.value(gg, y); if (v != null && isFinite(v)) ys.push([y, v, gg]); }
  if (ys.length < 2) return '';
  const W = 330, H = 176, l = 4, r = 4, t = 24, b = 24;
  const lo = Math.min(0, ...ys.map(d => d[1])), hi = Math.max(...ys.map(d => d[1]));
  const X = y => l + (y - m.years[0]) / (m.years[1] - m.years[0]) * (W - l - r), Y = v => t + (1 - (v - lo) / (hi - lo || 1)) * (H - t - b);
  const path = ys.map((d, i) => `${i ? 'L' : 'M'}${X(d[0]).toFixed(1)},${Y(d[1]).toFixed(1)}`).join('');
  const areaP = path + `L${X(ys.at(-1)[0])},${Y(lo)}L${X(ys[0][0])},${Y(lo)}Z`;
  const cur = ys.find(d => d[0] === state.y);
  const brk = ys.findIndex((d, i) => i && d[2] !== ys[i - 1][2]);
  const pre = ys.findIndex(d => isPrelim(m, d[0]));
  const id = 'g' + Math.random().toString(36).slice(2, 7);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${m.label} over time for ${NAMES[g]}">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--ink-1)" stop-opacity=".16"/><stop offset="1" stop-color="var(--ink-1)" stop-opacity="0"/></linearGradient></defs>
    <path d="${areaP}" fill="url(#${id})"/>
    ${lo < 0 ? `<line x1="${l}" x2="${W - r}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--ink-3)" stroke-dasharray="2 3"/>` : ''}
    <line x1="${l}" x2="${W - r}" y1="${Y(lo)}" y2="${Y(lo)}" stroke="var(--hairline)"/>
    <text x="${l}" y="12" font-size="12" fill="var(--ink-3)">${m.fmt(hi)}</text>
    <text x="${l}" y="${H - 6}" font-size="12" fill="var(--ink-3)">${m.years[0]}</text><text x="${W - r}" y="${H - 6}" text-anchor="end" font-size="12" fill="var(--ink-3)">${m.years[1]}</text>
    ${brk > 0 ? `<line x1="${X(ys[brk][0])}" x2="${X(ys[brk][0])}" y1="${t}" y2="${H - b}" stroke="var(--ink-3)" stroke-dasharray="3 3"/><text x="${X(ys[brk][0]) + 4}" y="${t + 10}" font-size="11" fill="var(--ink-3)">series begins</text>` : ''}
    <path d="${path}" fill="none" stroke="var(--ink-1)" stroke-width="2" stroke-linejoin="round"/>
    ${pre > 0 ? `<path d="M${X(ys[pre - 1][0])},${Y(ys[pre - 1][1])}L${X(ys[pre][0])},${Y(ys[pre][1])}" stroke="var(--panel)" stroke-width="2.4" /><path d="M${X(ys[pre - 1][0])},${Y(ys[pre - 1][1])}L${X(ys[pre][0])},${Y(ys[pre][1])}" stroke="var(--ink-1)" stroke-width="2" stroke-dasharray="3 3"/>` : ''}
    ${cur ? `<line x1="${X(cur[0])}" x2="${X(cur[0])}" y1="${t - 6}" y2="${H - b}" stroke="var(--accent)" stroke-opacity=".7"/><circle cx="${X(cur[0])}" cy="${Y(cur[1])}" r="5" fill="var(--accent)" stroke="var(--panel)" stroke-width="2"/>` : ''}
    <rect x="${l}" y="${t}" width="${W - l - r}" height="${H - t - b}" fill="transparent" data-chart="${m.years[0]},${m.years[1]},${l},${W - r},${W}" style="cursor:crosshair"/></svg>`;
}
function glance(g, y) {
  return `<table>${['pop', 'chg', 'rate', 'dens', 'share', 'nat', 'imm', 'npr', 'emi', 'ipm'].map(id => { const m = M[id]; let gg = g;
    if ((gg === 'NT' || gg === 'NU') && !m.split(y)) gg = 'NT+NU';
    const v = y >= m.years[0] && y <= m.years[1] ? m.value(gg, y) : null;
    return `<tr class="click ${id === state.m ? 'cur' : ''}" data-m="${id}"><td>${m.label}</td><td>${v == null ? '—' : m.fmt(v)}${isPrelim(m, y) && v != null ? ' <span style="color:var(--ink-3)">p</span>' : ''}</td></tr>`; }).join('')}</table>
    <div class="fine">Choose a row to map it. p = preliminary. — = not available.</div>`;
}
function renderPanel() {
  const m = M[state.m], y = state.y;
  let g = state.p || 'CAN';
  if ((g === 'NT' || g === 'NU') && !m.split(y)) g = 'NT+NU';
  const v = m.kind === 'party' ? null : m.value(g, y);
  let big = '—', sub = 'No data for this place and year';
  if (m.kind === 'party') { const e = electionAt(y); const s = e && (g === 'CAN' ? e.seats_total : e.seats_by_province[g === 'NT+NU' ? 'NT' : g]);
    const top = s ? Object.entries(s)[0] : null; if (top) { big = partyShort(top[0]); sub = `won the most seats: <b>${top[1]}</b> of ${Object.values(s).reduce((a, b) => a + b, 0)}`; } }
  else if (g === 'CAN' && (m.id === 'ipm' || m.id === 'flow')) { big = '—'; sub = 'Moves between provinces cancel out for Canada as a whole. Choose a province to see its net arrivals.'; }
  else if (v != null) {
    big = m.fmt(v); sub = m.unit;
    if (g !== 'CAN') { const ranked = geosFor(m.split(y)).map(k => [k, m.value(k, y)]).filter(d => d[1] != null).sort((a, b) => b[1] - a[1]);
      const r = ranked.findIndex(d => d[0] === g) + 1; if (r) sub += ` · ranks <b>${ord(r)}</b> of ${ranked.length}`; }
  }
  const pre = isPrelim(m, y) && v != null;
  let fromto = '';
  if (['pop', 'chg', 'share'].includes(m.id) && popAt(g, y) != null) { const b0 = g === 'NT' || g === 'NU' ? 1991 : 1971;
    if (y > b0) fromto = `<div class="fromto"><div><small>July 1, ${b0}</small><span>${big3(popAt(g, b0))}</span></div><div class="arr">→</div><div><small>July 1, ${y}${pre ? ' · prelim.' : ''}</small><span>${big3(popAt(g, y))}</span></div></div>`; }
  const e = electionAt(y), seats = e && (g === 'CAN' ? e.seats_total : e.seats_by_province[g === 'NT+NU' ? 'NT' : g]);
  const evs = (YEAR_EV[y] || []).filter(x => g === 'CAN' || !x.places?.length || x.places.includes(g));
  const mi = ministryAt(`${y}-07-01`);
  const src = m.src.map(s => registry[s].table_id ? 'StatCan ' + registry[s].table_id : registry[s].publisher.split(',')[0]).join(' + ');
  const peek = `<div class="peek"><div>${state.p ? '<button class="back" data-act="canada">← All of Canada</button>' : ''}<h2 class="place">${NAMES[g]}</h2></div>${isPhone() ? `<div class="peekv">${big}</div>` : ''}</div>`;
  body.innerHTML = `${peek}
    <div class="when">${m.label} · ${whenOf(m, y)}</div>
    <div class="hero"><div class="v">${big}</div>${pre ? '<button class="chip prelim" data-why="prelim"><i></i>Preliminary</button>' : ''}</div>
    <div class="hero-sub">${sub}</div>
    ${fromto}
    ${m.kind === 'party' || (g === 'CAN' && ['ipm', 'flow', 'share'].includes(m.id)) ? '' : chartSVG(g, m)}
    <button class="srcrow" data-why="src"><span>Source &amp; method</span><small>${src} · ${m.tag} →</small></button>
    ${evs.length ? `<details ${isPhone() ? '' : 'open'}><summary>In ${y}<span class="hint">${evs[0].title}</span></summary><div class="in">${evs.map(x => `<div class="ev"><span class="tag"><i class="m-${x.k}"></i>${{ elec: 'Election result', hist: 'Historical fact', note: 'Data note' }[x.k]}</span><b>${x.title}</b>${fmtDate(x.date)} · ${x.where}.
      <div class="fine">${x.source_url ? `<a href="${x.source_url}" target="_blank" rel="noopener">${x.source}</a>` : x.source}</div></div>`).join('')}</div></details>` : ''}
    <details><summary>Other measures, ${y}<span class="hint">10 measures</span></summary><div class="in">${glance(g, y)}</div></details>
    ${seats ? `<details><summary>Federal seats<span class="hint">${partyShort(Object.keys(seats)[0])} ${Object.values(seats)[0]} · ${e.date.slice(0, 4)}</span></summary><div class="in">
      <div class="seats">${Object.entries(seats).map(([p, n]) => `<span title="${partyShort(p)} ${n}" style="flex:${n};background:${cssc(partyCol(p))}"></span>`).join('')}</div>
      <table>${Object.entries(seats).map(([p, n]) => `<tr><td>${partyShort(p)}</td><td>${n}</td></tr>`).join('')}</table>
      <div class="fine">Seats won in the election of ${fmtDate(e.date)} (ParlInfo). Seats, not vote share.</div></div></details>` : ''}
    ${mi ? `<details><summary>Federal government<span class="hint">${mi.pm}</span></summary><div class="in">${mi.pm}, ${partyShort(mi.party)}. Prime Minister from ${fmtDate(mi.start)}.
      <div class="fine">Shown for historical context only. This atlas does not attribute outcomes to governments.</div></div></details>` : ''}`;
}
body.addEventListener('click', e => {
  const t = e.target.closest('[data-act],[data-m],[data-chart],[data-why]'); if (!t) return;
  if (t.dataset.act === 'canada') { state.p = null; update(); }
  else if (t.dataset.why) openSource(M[state.m], t.dataset.why);
  else if (t.dataset.m) { state.m = t.dataset.m; state.y = clampYear(M[state.m], state.y); update(); }
  else if (t.dataset.chart) { const [y0, y1, l, r, W] = t.dataset.chart.split(',').map(Number); const box = t.ownerSVGElement.getBoundingClientRect();
    state.y = clampYear(M[state.m], Math.round(y0 + ((e.clientX - box.left) / box.width * W - l) / (r - l) * (y1 - y0))); stop(); update(); }
});

// phone sheet: collapsed (year + place), middle, expanded; drag or tap the grip
const sheet = document.getElementById('sheet');
const SNAP = () => [PEEK, Math.round(innerHeight * 0.45), Math.round(innerHeight * 0.88)];
var sheetState = 0;
function sheetH() { return SNAP()[sheetState]; }
function setSheet(i) { const was = sheetState; sheetState = i; sheet.dataset.state = i; window.__sheetH = SNAP()[i];
  if (isPhone() && was !== i && window.READY) { view = { ...view, ...fitView(), transitionDuration: 350, transitionInterpolator: new deck.LinearInterpolator(['target', 'zoom']) }; theDeck.setProps({ viewState: view }); } sheet.style.setProperty('--sheet-h', SNAP()[i] + 'px'); placeCtl(); }
function placeCtl() { document.getElementById('mapctl').style.visibility = isPhone() && sheetState === 2 ? 'hidden' : ''; }
{ let y0 = null, h0 = 0;
  const grip = document.getElementById('grip');
  const down = e => { if (!isPhone()) return; y0 = e.clientY; h0 = sheet.offsetHeight; sheet.classList.add('dragging'); e.target.setPointerCapture?.(e.pointerId); };
  const move = e => { if (y0 == null) return; sheet.style.setProperty('--sheet-h', Math.max(PEEK, Math.min(innerHeight * 0.92, h0 + y0 - e.clientY)) + 'px'); };
  const up = e => { if (y0 == null) return; sheet.classList.remove('dragging'); const h = sheet.offsetHeight, moved = Math.abs(e.clientY - y0) > 6; y0 = null;
    if (!moved) return setSheet((sheetState + 1) % 3);
    const s = SNAP(); setSheet(s.reduce((bi, v, i) => Math.abs(v - h) < Math.abs(s[bi] - h) ? i : bi, 0)); };
  grip.addEventListener('pointerdown', down); addEventListener('pointermove', move); addEventListener('pointerup', up); }

// ---------------------------------------------------------------- source / caveat drawer
const drawer = document.getElementById('drawer');
const WHY = {
  prelim: ['Preliminary estimate', 'Statistics Canada publishes a first estimate and revises it as census, immigration and vital-statistics data arrive. Population estimates from July 1, 2026 and components of change for July 2025 to June 2026 are preliminary; they can move noticeably.'],
  ntnu: ['Northwest Territories and Nunavut combined', 'Before July 1991, Statistics Canada reports one figure for the Northwest Territories including what is now Nunavut. The map shows them as one region for those dates. Changes for each territory are measured from July 1991.'],
  seats: ['Seat count note', 'ParlInfo records 341 of 343 seats for the 2025 general election. The two missing seats are being reconciled with Elections Canada before this layer is used in a story.'],
};
function openSource(m, why = 'src') {
  const w = WHY[why];
  document.getElementById('drawer-body').innerHTML = (w ? `<div style="color:var(--ink-3);font-size:13px">About this view</div><h2>${w[0]}</h2><p style="color:var(--ink-2);line-height:1.55">${w[1]}</p><hr style="border:0;border-top:1px solid var(--hairline);margin:20px 0">` : '') +
    `<div style="color:var(--ink-3);font-size:13px">${m.tag}</div><h2>${m.label}</h2><p style="color:var(--ink-2);line-height:1.5;margin:0">${m.q}</p>` +
    m.src.map(id => { const s = registry[id]; return `<dl><dt>Publisher</dt><dd>${s.publisher}</dd><dt>Dataset</dt><dd>${s.title}${s.table_id ? ` (Table ${s.table_id})` : ''}</dd>
      <dt>Link</dt><dd><a href="${s.landing_url}" target="_blank" rel="noopener">${s.landing_url}</a></dd>
      <dt>Retrieved</dt><dd>${s.retrieved}</dd><dt>Licence</dt><dd>${s.licence}</dd></dl>
      ${(s.methodology_notes || []).length ? `<details><summary>Method notes<span class="hint">${s.methodology_notes.length}</span></summary><ul>${s.methodology_notes.map(n => `<li>${n}</li>`).join('')}</ul></details>` : ''}
      ${(s.limitations || []).length ? `<details><summary>Limitations<span class="hint">${s.limitations.length}</span></summary><ul>${s.limitations.map(n => `<li>${n}</li>`).join('')}</ul></details>` : ''}
      <details><summary>File fingerprint<span class="hint">SHA-256</span></summary><div class="in" style="font-family:var(--font-mono);font-size:12px;word-break:break-all">${s.sha256 || '—'}</div></details>`; }).join('');
  drawer.showModal();
}
function openEvent(e) {
  document.getElementById('drawer-body').innerHTML = `<div style="color:var(--ink-3);font-size:13px">${e.tag.replace(/_/g, ' ')}</div><h2>${e.title}</h2><div style="color:var(--ink-2)">${fmtDate(e.date)} · ${e.where}</div>
    <p style="line-height:1.55">${e.body}</p><p style="font-size:14px">Source: ${e.source_url ? `<a href="${e.source_url}" target="_blank" rel="noopener">${e.source}</a>` : e.source}</p>`;
  drawer.showModal();
}

// ---------------------------------------------------------------- update
function timelineCtx(y) {
  const mi = ministryAt(`${y}-07-01`), evs = YEAR_EV[y] || [];
  const ev = evs.length ? `<div class="evl"><i class="m-${evs[0].k}"></i>${evs[0].title}${evs.length > 1 ? ` <span style="color:var(--ink-3)">+${evs.length - 1} more</span>` : ''}</div>` : '';
  document.getElementById('tl-ctx').innerHTML = `${ev}<div>Prime Minister on July 1, ${y}: <b>${mi ? `${mi.pm}` : '—'}</b>${mi ? ` (${partyShort(mi.party)})` : ''}</div>`;
  document.getElementById('mev').innerHTML = evs.length ? `<span class="evl"><i class="m-${evs[0].k}" style="display:inline-block;width:7px;height:7px;margin-right:6px"></i>${evs[0].title}</span>` : (mi ? `Prime Minister: ${mi.pm} (${partyShort(mi.party)})` : '');
  document.querySelectorAll('#tl-era span').forEach(s => { const m = ERAS[+s.dataset.i]; s.classList.toggle('now', m === mi); });
  document.querySelectorAll('#tl-ev i').forEach(i => i.classList.toggle('off', +i.dataset.y > y));
}
function update() {
  const m = M[state.m];
  state.y = clampYear(m, state.y);
  const p = ((state.y - YMIN) / span * 100) + '%';
  for (const r of [yr, myr]) { r.value = state.y; r.style.setProperty('--p', p); }
  document.getElementById('tl-year').textContent = state.y; document.getElementById('myear-l').textContent = state.y;
  document.querySelectorAll('.opt').forEach(b => b.classList.toggle('on', b.dataset.m === state.m));
  theDeck.setProps({ layers: layers() });
  reading(m); renderPanel(); timelineCtx(state.y); writeHash(); placeCtl();
}
drawEras();
setSheet(Q.get('sheet') ? +Q.get('sheet') : 0);
view = { ...view, ...fitView() }; theDeck.setProps({ viewState: view });
update();
window.CTX = { state, update, M, setSheet };
window.READY = true;
