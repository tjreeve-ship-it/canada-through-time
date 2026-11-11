/* Canada Through Time — Explorer v0.1
 * One map, one year, one measure at a time. Every number comes from a registered source and opens its drawer.
 * State lives in the URL hash (#m=pop&y=1986&p=AB) so any view can be shared.
 */
const { Deck, OrbitView, GeoJsonLayer, ColumnLayer, TextLayer, ArcLayer, ScatterplotLayer, LightingEffect, AmbientLight, DirectionalLight, COORDINATE_SYSTEM } = deck;
const CART = COORDINATE_SYSTEM.CARTESIAN;

// ---------------------------------------------------------------- tokens
const css = getComputedStyle(document.body);
const tok = n => css.getPropertyValue('--' + n).trim();
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const C = n => rgb(tok(n));
const cssc = c => `rgb(${c.join(',')})`;
const lerpC = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

// ---------------------------------------------------------------- reference data
const PROV = ['NL', 'PE', 'NS', 'NB', 'QC', 'ON', 'MB', 'SK', 'AB', 'BC', 'YT', 'NT', 'NU'];
const NAMES = { CAN: 'Canada', NL: 'Newfoundland and Labrador', PE: 'Prince Edward Island', NS: 'Nova Scotia', NB: 'New Brunswick', QC: 'Quebec', ON: 'Ontario',
  MB: 'Manitoba', SK: 'Saskatchewan', AB: 'Alberta', BC: 'British Columbia', YT: 'Yukon', NT: 'Northwest Territories', NU: 'Nunavut', 'NT+NU': 'Northwest Territories incl. Nunavut' };
const PARTY = { // election layer only; always shown with names
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
const pct = (p, dp = 0) => { const r = +(p * 100).toFixed(dp); return r === 0 ? '0%' : (r > 0 ? '+' : '−') + Math.abs(r).toFixed(dp) + '%'; };
const signed = (v, dp = 1) => { const r = +v.toFixed(dp); return r === 0 ? '0' : (r > 0 ? '+' : '−') + Math.abs(r).toFixed(dp); };
const fmtDate = d => { const [y, m, dd] = d.split('-').map(Number); return `${MONTHS[m - 1]} ${dd}, ${y}`; };

// ---------------------------------------------------------------- load
const BASE = document.documentElement.dataset.base || '..'; // '.' when the explorer is served from the site root
const J = u => fetch(u.replace(/^\.\.\//, BASE + '/')).then(r => { if (!r.ok) throw new Error(u); return r.json(); });
const toKm = fc => { const c = x => typeof x[0] === 'number' ? [x[0] / 1e3, x[1] / 1e3] : x.map(c);
  fc.features.forEach(f => { f.geometry.coordinates = c(f.geometry.coordinates); if (f.properties.lx != null) { f.properties.lx /= 1e3; f.properties.ly /= 1e3; } }); return fc; };
const [pop, comp, flows, area, politics, evData, provinces, ntnu, countries, lakes, registry] = await Promise.all([
  J('../data/population.json'), J('../data/explorer/components.json'), J('../data/explorer/flows.json'), J('../data/explorer/area.json'),
  J('../data/explorer/politics.json'), J('../data/explorer/events.json'),
  J('../data/provinces.geojson').then(toKm), J('../data/ntnu_combined.geojson').then(toKm), J('../data/context_countries.geojson').then(toKm), J('../data/lakes.geojson').then(toKm),
  J('../data/explorer/registry.json')]);
await Promise.all(['600 16px "IBM Plex Sans"', '400 16px "IBM Plex Sans"', '600 16px "Source Serif 4"', '700 16px "Source Serif 4"'].map(f => document.fonts.load(f)));

const S = pop.series, D = pop.dates;
const YMIN = 1971, YMAX = +D.at(-1).slice(0, 4);
const julIdx = y => D.indexOf(`${y}-07-01`);
const popAt = (g, y) => { const i = julIdx(y); return i < 0 ? null : S[g]?.[i] ?? null; };
const anchor = {};
provinces.features.forEach(f => anchor[f.properties.abbr] = [f.properties.lx, f.properties.ly]);
anchor['NT+NU'] = [ntnu.features[0].properties.lx, ntnu.features[0].properties.ly];
const CALLOUT = { NB: [7520, 1380], NS: [8420, 1080], PE: [8400, 2080] }; // offshore label spots (km, StatCan Lambert)
const featsSplit = provinces.features;
const featsCombined = provinces.features.filter(f => !['NT', 'NU'].includes(f.properties.abbr)).concat(ntnu.features);
const geosFor = split => split ? PROV : PROV.filter(k => k !== 'NT' && k !== 'NU').concat('NT+NU');
const compAt = (g, y) => comp.data[g]?.[String(y - 1)] ?? null; // period ending July 1 of y
const events = evData.events;
const elections = politics.elections;
const electionAt = y => elections.filter(e => e.date <= `${y}-12-31`).at(-1) || null;
const ministryAt = date => politics.ministries.find(m => m.start <= date && (!m.end || m.end >= date));

// ---------------------------------------------------------------- colour scales
const GROW = ['grow-1', 'grow-2', 'grow-3', 'grow-4'].map(C), DECL = ['decline-1', 'decline-2', 'decline-3'].map(C);
const NEU = C('neutral');
const MAG = ['#2F3A2E', '#4E6A4A', '#7FA076', '#BFD6A9', '#EAF2DF'].map(rgb); // sage: magnitude only
function diverging(v, neg, posMax, dead) {
  if (v == null || isNaN(v)) return null;
  if (Math.abs(v) < dead) return NEU;
  const arm = v > 0 ? GROW : DECL, lim = v > 0 ? posMax : neg;
  const t = Math.min(1, (Math.abs(v) - dead) / (lim - dead)) * (arm.length - 1);
  const i = Math.min(arm.length - 2, Math.floor(t));
  return lerpC(arm[i], arm[i + 1], t - i);
}
function magnitude(v, lo, hi, log) {
  if (v == null || isNaN(v)) return null;
  let t = log ? (Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo)) : (v - lo) / (hi - lo);
  t = Math.max(0, Math.min(1, t)) * (MAG.length - 1);
  const i = Math.min(MAG.length - 2, Math.floor(t));
  return lerpC(MAG[i], MAG[i + 1], t - i);
}

// ---------------------------------------------------------------- measures
const per1000 = (g, y, f) => { const c = compAt(g, y), p = popAt(g, y - 1) ?? popAt(g, y); return c && p ? f(c) / p * 1000 : null; };
const MEASURES = [
  { id: 'pop', group: 'Population', label: 'People', desc: 'Total population; spike height = people', kind: 'spike', src: ['statcan_17100009'], tag: 'Official statistic',
    years: [1971, YMAX], split: y => y >= 1991, value: (g, y) => popAt(g, y), fmt: v => sig3(v), unit: 'people',
    colorBy: (g, y) => { const b = popAt(g, g === 'NT' || g === 'NU' ? 1991 : 1971) ; const v = popAt(g, y); return b && v ? v / b - 1 : null; },
    color: v => diverging(v, 0.3, 2, 0.02), legend: { kind: 'div', title: 'Colour: change since 1971 (NT, NU since 1991)', ticks: [[-0.1, '−10%'], [0, '±2%'], [0.5, '+50%'], [1, '+100%'], [2, '+200%']], neg: 0.3, pos: 2, dead: 0.02 },
    when: y => `Statistics Canada estimate, July 1, ${y}` },
  { id: 'chg', group: 'Population', label: 'Change since 1971', desc: 'Percentage change from July 1971', kind: 'fill', src: ['statcan_17100009'], tag: 'Derived',
    years: [1972, YMAX], split: y => y >= 1991, value: (g, y) => { const b = popAt(g, g === 'NT' || g === 'NU' ? 1991 : 1971); const v = popAt(g, y); return b && v ? v / b - 1 : null; },
    fmt: v => pct(v), unit: '%', color: v => diverging(v, 0.3, 2, 0.02),
    legend: { kind: 'div', title: 'Change since July 1971 (NT, NU since July 1991)', ticks: [[-0.1, '−10%'], [0, '±2%'], [0.5, '+50%'], [1, '+100%'], [2, '+200%']], neg: 0.3, pos: 2, dead: 0.02 },
    when: y => `July 1971 → July 1, ${y}` },
  { id: 'rate', group: 'Population', label: 'Growth in the past year', desc: 'July-to-July change, %', kind: 'fill', src: ['statcan_17100009'], tag: 'Derived',
    years: [1972, YMAX], split: y => y >= 1992, value: (g, y) => { const a = popAt(g, y - 1), b = popAt(g, y); return a && b ? b / a - 1 : null; },
    fmt: v => pct(v, 1), unit: '% per year', color: v => diverging(v, 0.02, 0.04, 0.001),
    legend: { kind: 'div', title: 'Population change over the year to July 1', ticks: [[-0.01, '−1%'], [0, '±0.1%'], [0.01, '+1%'], [0.02, '+2%'], [0.04, '+4%']], neg: 0.02, pos: 0.04, dead: 0.001 },
    when: y => `July 1, ${y - 1} → July 1, ${y}` },
  { id: 'dens', group: 'Population', label: 'People per km²', desc: 'Population ÷ 2021 land area', kind: 'fill', src: ['statcan_17100009', 'statcan_98100001'], tag: 'Derived',
    years: [1971, YMAX], split: y => y >= 1991, value: (g, y) => { const a = g === 'NT+NU' ? area.data.NT + area.data.NU : area.data[g]; const p = popAt(g, y); return a && p ? p / a : null; },
    fmt: v => v < 1 ? v.toFixed(2) : v.toFixed(1), unit: 'people per km²', color: v => magnitude(v, 0.02, 40, true),
    legend: { kind: 'mag', title: 'People per km² (log scale; 2021 land area)', ticks: ['0.02', '0.3', '3', '40'] }, when: y => `July 1, ${y}` },
  { id: 'share', group: 'Population', label: 'Share of Canadians', desc: 'Percent of Canada living here', kind: 'spike', src: ['statcan_17100009'], tag: 'Derived',
    years: [1971, YMAX], split: y => y >= 1991, value: (g, y) => { const p = popAt(g, y), c = popAt('CAN', y); return p && c ? p / c : null; }, height: (g, y) => popAt(g, y),
    fmt: v => (v * 100).toFixed(v < 0.01 ? 2 : 1) + '%', unit: '% of Canada',
    colorBy: (g, y) => { const p = popAt(g, y) / popAt('CAN', y), b = popAt(g, g === 'NT' || g === 'NU' ? 1991 : 1971) / popAt('CAN', g === 'NT' || g === 'NU' ? 1991 : 1971); return p / b - 1; },
    color: v => diverging(v, 0.4, 0.6, 0.02), legend: { kind: 'div', title: 'Colour: change in share since 1971', ticks: [[-0.3, '−30%'], [0, '±2%'], [0.3, '+30%'], [0.6, '+60%']], neg: 0.4, pos: 0.6, dead: 0.02 },
    when: y => `July 1, ${y}` },

  { id: 'nat', group: 'Where growth came from', label: 'Natural increase', desc: 'Births minus deaths per 1,000 people', kind: 'fill', src: ['statcan_17100008'], tag: 'Derived',
    years: [1972, YMAX], split: y => y >= 1992, value: (g, y) => per1000(g, y, c => c.births - c.deaths), fmt: v => signed(v), unit: 'per 1,000 people',
    color: v => diverging(v, 5, 25, 0.5), legend: { kind: 'div', title: 'Births − deaths per 1,000 people', ticks: [[-4, '−4'], [0, '0'], [10, '+10'], [25, '+25']], neg: 5, pos: 25, dead: 0.5 }, comp: true },
  { id: 'imm', group: 'Where growth came from', label: 'Immigrants', desc: 'New permanent residents per 1,000 people', kind: 'fill', src: ['statcan_17100008'], tag: 'Derived',
    years: [1972, YMAX], split: y => y >= 1992, value: (g, y) => per1000(g, y, c => c.immigrants), fmt: v => v.toFixed(1), unit: 'per 1,000 people',
    color: v => magnitude(v, 0, 16, false), legend: { kind: 'mag', title: 'Immigrants per 1,000 people', ticks: ['0', '4', '8', '12', '16+'] }, comp: true },
  { id: 'npr', group: 'Where growth came from', label: 'Non-permanent residents (net)', desc: 'Permit holders and asylum claimants, net change per 1,000', kind: 'fill', src: ['statcan_17100008'], tag: 'Derived',
    years: [1972, YMAX], split: y => y >= 1992, value: (g, y) => per1000(g, y, c => c.net_npr ?? 0), fmt: v => signed(v), unit: 'per 1,000 people',
    color: v => diverging(v, 10, 25, 0.5), legend: { kind: 'div', title: 'Net non-permanent residents per 1,000 people', ticks: [[-5, '−5'], [0, '0'], [10, '+10'], [25, '+25']], neg: 10, pos: 25, dead: 0.5 }, comp: true },
  { id: 'emi', group: 'Where growth came from', label: 'Emigration (net)', desc: 'Net emigration per 1,000 people (people leaving Canada)', kind: 'fill', src: ['statcan_17100008'], tag: 'Derived',
    years: [1972, YMAX], split: y => y >= 1992, value: (g, y) => per1000(g, y, c => c.net_emigration), fmt: v => v.toFixed(1), unit: 'per 1,000 people',
    color: v => magnitude(v, 0, 4, false), legend: { kind: 'mag', title: 'Net emigrants per 1,000 people', ticks: ['0', '1', '2', '3', '4+'] }, comp: true },
  { id: 'ipm', group: 'Where growth came from', label: 'Moves between provinces (net)', desc: 'Net interprovincial migration per 1,000 people', kind: 'fill', src: ['statcan_17100008'], tag: 'Derived',
    years: [1972, YMAX], split: y => y >= 1992, value: (g, y) => per1000(g, y, c => c.net_interprovincial ?? 0), fmt: v => signed(v), unit: 'per 1,000 people',
    color: v => diverging(v, 25, 25, 0.5), legend: { kind: 'div', title: 'Net arrivals from other provinces per 1,000 people', ticks: [[-20, '−20'], [-10, '−10'], [0, '0'], [10, '+10'], [20, '+20']], neg: 25, pos: 25, dead: 0.5 }, comp: true },
  { id: 'flow', group: 'Where growth came from', label: 'Migration flows', desc: 'Moves between provinces; pick a province to see its flows', kind: 'arcs', src: ['statcan_17100045'], tag: 'Official statistic',
    years: [1972, Math.max(...flows.complete_periods) + 1], split: y => y >= 1992, value: (g, y) => per1000(g, y, c => c.net_interprovincial ?? 0), fmt: v => signed(v), unit: 'net per 1,000 people',
    color: v => diverging(v, 25, 25, 0.5), legend: { kind: 'flow', title: 'Arc width = people moving (July–June). Bright end = destination.' } },

  { id: 'fed', group: 'Politics', label: 'Federal election seats', desc: 'Party with the most seats in each province', kind: 'party', src: ['parlinfo_elected'], tag: 'Official statistic',
    years: [1972, YMAX], split: y => y >= 1997, value: (g, y) => { const e = electionAt(y); const s = e?.seats_by_province[g === 'NT+NU' ? 'NT' : g]; return s ? Object.entries(s)[0] : null; },
    fmt: v => v ? `${partyShort(v[0])} ${v[1]}` : '—', unit: 'seats', legend: { kind: 'party' },
    when: y => { const e = electionAt(y); return e ? `General election of ${fmtDate(e.date)} · most recent on or before ${y}` : 'No general election yet in range'; } },
];
const M = Object.fromEntries(MEASURES.map(m => [m.id, m]));
const compWhen = y => `July 1, ${y - 1} → June 30, ${y} · Statistics Canada estimates`;

// ---------------------------------------------------------------- state
const state = { m: 'pop', y: YMAX, p: null, playing: false, speed: 0.8 };
(() => { const h = new URLSearchParams(location.hash.slice(1)); if (M[h.get('m')]) state.m = h.get('m'); const y = +h.get('y'); if (y >= YMIN && y <= YMAX) state.y = y; if (NAMES[h.get('p')]) state.p = h.get('p'); })();
const writeHash = () => history.replaceState(null, '', `#m=${state.m}&y=${state.y}${state.p ? '&p=' + state.p : ''}`);
const clampYear = (m, y) => Math.max(m.years[0], Math.min(m.years[1], y));

// ---------------------------------------------------------------- deck
const fitView = () => {
  const w = innerWidth, h = innerHeight, mobile = w < 860;
  const zoom = Math.log2(Math.min((mobile ? w : w - 740) / 6000, (mobile ? h * 0.45 : h - 220) / 4400));
  return { target: [mobile ? 6300 : 6420, mobile ? 2050 : 2200, 0], zoom, rotationX: 38, rotationOrbit: 0, minZoom: zoom - 1.5, maxZoom: zoom + 4 };
};
let view = fitView();
const theDeck = new Deck({
  parent: document.getElementById('map'), views: new OrbitView({ orbitAxis: 'Z', fovy: 30 }),
  controller: { dragMode: 'pan', inertia: true, scrollZoom: { smooth: true, speed: 0.02 } },
  viewState: view, onViewStateChange: ({ viewState }) => { view = { ...viewState, rotationX: Math.max(0, Math.min(70, viewState.rotationX)) }; theDeck.setProps({ viewState: view }); },
  effects: [new LightingEffect({ a: new AmbientLight({ color: [255, 255, 255], intensity: 0.9 }), k: new DirectionalLight({ color: [255, 248, 236], intensity: 0.9, direction: [-2, -5, -8] }) })],
  parameters: { clearColor: [...C('ground').map(c => c / 255), 1] },
  getCursor: ({ isHovering, isDragging }) => isDragging ? 'grabbing' : isHovering ? 'pointer' : 'grab',
  onHover: info => tooltip(info), onClick: info => click(info),
});

const tt = document.getElementById('tooltip');
function tooltip(info) {
  const o = info.object; if (!o) { tt.style.display = 'none'; return; }
  let html = '';
  if (o.properties?.abbr || o.k) { const g = o.properties?.abbr || o.k; const m = M[state.m]; const v = m.value(g, state.y);
    html = `<b>${NAMES[g]}</b><div class="m">${m.label}: ${v == null ? 'no data' : m.fmt(v)}</div>`; }
  else if (o.o) html = `<b>${NAMES[o.o]} → ${NAMES[o.d]}</b><div class="m">${fmtInt(o.v)} moves, July ${state.y - 1}–June ${state.y}</div>`;
  else if (o.title) html = o.count > 1 ? `<b>${o.label}</b><div class="m">Click to list them in the panel</div>` : `<span class="etag">${o.tag.replace(/_/g, ' ')}</span><br><b>${o.title}</b><div class="m">${fmtDate(o.date)} · ${o.where}</div>`;
  tt.innerHTML = html; tt.style.display = 'block';
  tt.style.left = Math.min(info.x + 14, innerWidth - 290) + 'px'; tt.style.top = (info.y + 14) + 'px';
}
function click(info) {
  const o = info.object;
  if (!o) { return; }
  if (o.title) { if (o.count > 1) { state.p = null; update(); document.querySelector('#panel .ev')?.scrollIntoView({ behavior: 'smooth' }); } else openEvent(o); return; }
  const g = o.properties?.abbr || o.k; if (!g) return;
  state.p = state.p === g ? null : g; update();
}

// ---------------------------------------------------------------- layers
const base = [
  new GeoJsonLayer({ id: 'nb', data: countries, coordinateSystem: CART, filled: true, stroked: true, getFillColor: C('land-neighbour'), getLineColor: C('coast'), lineWidthMinPixels: 1 }),
  new GeoJsonLayer({ id: 'lakes', data: lakes, coordinateSystem: CART, filled: true, stroked: false, getFillColor: C('water') }),
];
const KMPM = 70;
function layers() {
  const m = M[state.m], y = state.y, split = m.split(y);
  const feats = split ? featsSplit : featsCombined, geos = geosFor(split);
  const val = Object.fromEntries(geos.map(g => [g, m.value(g, y)]));
  const sel = state.p && (geos.includes(state.p) ? state.p : (state.p === 'NT' || state.p === 'NU') && !split ? 'NT+NU' : state.p);
  const fillColor = f => {
    const g = f.properties.abbr, v = val[g];
    if (m.kind === 'fill') return v == null ? C('land') : m.color(v);
    if (m.kind === 'party') return v ? partyCol(v[0]) : C('land');
    if (m.kind === 'arcs') return state.p ? (g === sel ? C('land') : lerpC(C('land'), C('ground'), 0.35)) : C('land');
    return C('land');
  };
  const L = [...base,
    new GeoJsonLayer({ id: 'land', data: feats, coordinateSystem: CART, filled: true, stroked: true, pickable: true,
      getFillColor: fillColor, getLineColor: f => f.properties.abbr === sel ? C('accent') : C('boundary'),
      getLineWidth: f => f.properties.abbr === sel ? 3 : 1, lineWidthUnits: 'pixels',
      updateTriggers: { getFillColor: [state.m, y, state.p], getLineColor: [sel], getLineWidth: [sel] }, transitions: { getFillColor: 400 } })];
  const pts = geos.map(g => ({ k: g, p: anchor[g] }));
  if (m.kind === 'spike') {
    const h = g => ((m.height ? m.height(g, y) : val[g]) || 0) / 1e6 * KMPM;
    L.push(new ColumnLayer({ id: 'spikes', data: pts, coordinateSystem: CART, diskResolution: 24, radius: 52, extruded: true, pickable: true,
      getPosition: d => [d.p[0], d.p[1], 0], getElevation: d => h(d.k), getFillColor: d => m.color(m.colorBy(d.k, y)) || NEU,
      material: { ambient: 0.55, diffuse: 0.5, shininess: 16, specularColor: [40, 40, 40] },
      updateTriggers: { getElevation: [state.m, y], getFillColor: [state.m, y] }, transitions: { getElevation: 500, getFillColor: 400 } }));
    L.push(...labels(pts, d => [d.p[0], d.p[1], h(d.k)], val, m, sel));
  } else if (m.kind === 'arcs') {
    L.push(...arcs(y, sel));
    L.push(...labels(pts, d => [d.p[0], d.p[1], 0], val, m, sel));
  } else {
    L.push(...labels(pts, d => [d.p[0], d.p[1], 0], val, m, sel));
  }
  L.push(...eventPins(y));
  return L;
}
function labels(pts, pos, val, m, sel) {
  const ink = C('ink-1'), halo = [...C('ground'), 255];
  const call = pts.filter(d => CALLOUT[d.k]);
  const at = d => CALLOUT[d.k] ? [...CALLOUT[d.k], 0] : pos(d);
  return [new deck.LineLayer({ id: 'leaders', data: call, coordinateSystem: CART, parameters: { depthTest: false },
      getSourcePosition: pos, getTargetPosition: d => [...CALLOUT[d.k], 0], getColor: C('ink-3'), getWidth: 1.2, widthUnits: 'pixels',
      updateTriggers: { getSourcePosition: [state.m, state.y] } }),
    new TextLayer({ id: 'labels', data: pts, coordinateSystem: CART, parameters: { depthTest: false },
    getPosition: at, getText: d => `${d.k === 'NT+NU' ? 'NT+NU' : d.k}\n${val[d.k] == null ? '—' : m.fmt(val[d.k])}`,
    getSize: d => d.k === sel ? 16 : 13, getPixelOffset: d => CALLOUT[d.k] ? [0, 0] : [0, -18], fontFamily: 'IBM Plex Sans', fontWeight: 600, lineHeight: 1.15,
    getColor: d => d.k === sel ? C('accent') : ink, outlineWidth: 6, outlineColor: halo, characterSet: 'auto', fontSettings: { sdf: true, fontSize: 64, buffer: 8 },
    updateTriggers: { getPosition: [state.m, state.y], getText: [state.m, state.y], getSize: [sel], getColor: [sel] }, transitions: { getPosition: 500 } })];
}
function arcs(y, sel) {
  const rows = flows.data[String(y - 1)] || [];
  let data = rows.map(([o, d, v]) => ({ o, d, v }));
  if (sel) data = data.filter(r => r.o === sel || r.d === sel);
  else data = data.sort((a, b) => b.v - a.v).slice(0, 40);
  const max = Math.max(1, ...data.map(r => r.v));
  const dim = lerpC(C('grow-1'), C('ground'), 0.3), bright = C('grow-4'), out = C('decline-3');
  return [new ArcLayer({ id: 'arcs', data, coordinateSystem: CART, pickable: true, greatCircle: false,
    getSourcePosition: r => [...anchor[r.o], 0], getTargetPosition: r => [...anchor[r.d], 0], getHeight: 0.35, getTilt: 0,
    getWidth: r => 1 + 18 * Math.sqrt(r.v / max), widthUnits: 'pixels',
    getSourceColor: r => [...(sel && r.o === sel ? out : dim), 200], getTargetColor: r => [...(sel && r.o === sel ? out : bright), 235],
    updateTriggers: { getWidth: [y, sel], getSourceColor: [sel], getTargetColor: [sel] } })];
}
function eventPins(y) {
  const evs = events.filter(e => +e.date.slice(0, 4) === y);
  const groups = {}; evs.forEach(e => (groups[e.xy.join(',')] ||= []).push(e));
  const data = Object.values(groups).map(g => ({ ...g[0], count: g.length, label: g.length > 1 ? `${g.length} events in ${y} · ${g[0].where}` : g[0].title }));
  return [
    new ScatterplotLayer({ id: 'pins', data, coordinateSystem: CART, pickable: true, getPosition: e => [...e.xy, 2], radiusUnits: 'pixels', getRadius: 7,
      stroked: true, filled: true, getFillColor: [...C('ground'), 255], getLineColor: C('accent'), lineWidthUnits: 'pixels', getLineWidth: 3, parameters: { depthTest: false } }),
    new TextLayer({ id: 'pin-labels', data, coordinateSystem: CART, pickable: true, parameters: { depthTest: false }, getPosition: e => [...e.xy, 2],
      getText: e => e.label.length > 46 ? e.label.slice(0, 44) + '…' : e.label, getPixelOffset: [-14, 0], getTextAnchor: 'end', getAlignmentBaseline: 'center',
      getSize: 12.5, fontFamily: 'IBM Plex Sans', fontWeight: 600, getColor: C('accent'), outlineWidth: 6, outlineColor: [...C('ground'), 255],
      characterSet: 'auto', fontSettings: { sdf: true, fontSize: 64, buffer: 8 } }),
  ];
}

// ---------------------------------------------------------------- UI: layers menu
const lb = document.getElementById('layers-body');
{ let g = ''; lb.innerHTML = MEASURES.map(m => { const head = m.group !== g ? `<div class="grp">${(g = m.group)}</div>` : '';
  return head + `<button class="opt" data-m="${m.id}">${m.label}<span class="tag">${m.tag === 'Derived' ? '▲' : '■'}</span><small>${m.desc}</small></button>`; }).join(''); }
lb.addEventListener('click', e => { const b = e.target.closest('.opt'); if (!b) return; state.m = b.dataset.m; state.y = clampYear(M[state.m], state.y);
  document.getElementById('layers').classList.remove('open'); update(); });
document.getElementById('layers-toggle').onclick = () => document.getElementById('layers').classList.toggle('open');
['layers', 'panel', 'timeline', 'legend'].forEach(id => document.getElementById(id).classList.add('glass'));

// ---------------------------------------------------------------- UI: timeline
const yr = document.getElementById('year');
const span = YMAX - YMIN;
const xPct = date => { const [y, m] = date.split('-').map(Number); return Math.max(0, Math.min(100, (y + (m - 1) / 12 - YMIN) / span * 100)); };
document.getElementById('tl-gov').innerHTML = politics.ministries.filter(m => !m.end || m.end >= '1971-01-01').map(m => {
  const a = xPct(m.start < '1971-01-01' ? '1971-01-01' : m.start), b = xPct(m.end || `${YMAX}-12-31`);
  return `<span title="${m.pm} · ${partyShort(m.party)} · ${m.start} to ${m.end || 'present'}" style="width:${b - a}%;background:${cssc(partyCol(m.party))}">${m.pm.split(' ').at(-1)}</span>`; }).join('');
document.getElementById('tl-marks').innerHTML = events.map(e => `<i class="${e.kind === 'election' ? 'el' : ''}" style="left:${xPct(e.date)}%" title="${e.title}"></i>`).join('');
document.getElementById('tl-ticks').innerHTML = [1971, 1980, 1990, 2000, 2010, 2020, YMAX].map(y => `<span style="left:${(y - YMIN) / span * 100}%">${y}</span>`).join('');
yr.min = YMIN; yr.max = YMAX;
yr.oninput = () => { state.y = clampYear(M[state.m], +yr.value); stop(); update(); };
let timer = null;
const playBtn = document.getElementById('play');
const stop = () => { state.playing = false; clearTimeout(timer); playBtn.textContent = '▶'; playBtn.setAttribute('aria-label', 'Play'); };
const step = () => { const m = M[state.m]; if (state.y >= m.years[1]) { stop(); return; } state.y++; update(); timer = setTimeout(step, state.speed * 1000); };
playBtn.onclick = () => { if (state.playing) return stop(); const m = M[state.m]; if (state.y >= m.years[1]) state.y = m.years[0];
  state.playing = true; playBtn.textContent = '❚❚'; playBtn.setAttribute('aria-label', 'Pause'); update(); timer = setTimeout(step, state.speed * 1000); };
document.getElementById('tl-speed').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; state.speed = +b.dataset.s;
  document.querySelectorAll('#tl-speed button').forEach(x => x.classList.toggle('on', x === b)); });

// ---------------------------------------------------------------- UI: map controls
document.getElementById('mapctl').addEventListener('click', e => { const a = e.target.closest('button')?.dataset.act; if (!a) return;
  const v = { ...view };
  if (a === 'zin') v.zoom += 0.5; if (a === 'zout') v.zoom -= 0.5; if (a === 'rotl') v.rotationOrbit -= 20; if (a === 'rotr') v.rotationOrbit += 20;
  if (a === 'tilt') v.rotationX = v.rotationX > 10 ? 0 : 45; if (a === 'reset') Object.assign(v, fitView());
  view = { ...v, transitionDuration: 500, transitionInterpolator: new deck.LinearInterpolator(['target', 'zoom', 'rotationX', 'rotationOrbit']) };
  theDeck.setProps({ viewState: view }); });
addEventListener('resize', () => { view = { ...view, ...(({ minZoom, maxZoom }) => ({ minZoom, maxZoom }))(fitView()) }; theDeck.setProps({ viewState: view }); });
addEventListener('keydown', e => { if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
  if (e.key === 'ArrowRight') { state.y = clampYear(M[state.m], state.y + 1); stop(); update(); }
  if (e.key === 'ArrowLeft') { state.y = clampYear(M[state.m], state.y - 1); stop(); update(); }
  if (e.key === ' ' && e.target === document.body) { e.preventDefault(); playBtn.click(); }
  if (e.key === 'Escape') { state.p = null; update(); } });

// ---------------------------------------------------------------- legend + headline
function legend(m) {
  const L = m.legend, el = document.getElementById('legend');
  if (L.kind === 'div') {
    const sym = L.neg === L.pos, cut = sym ? 0.5 : 0.3; // share of the bar given to the decline arm
    const pos = v => v < 0 ? cut * (1 + v / L.neg) : cut + (1 - cut) * (v / L.pos);
    const inv = t => t < cut ? -L.neg * (1 - t / cut) : L.pos * (t - cut) / (1 - cut);
    const n = 30, xs = Array.from({ length: n }, (_, i) => inv((i + 0.5) / n));
    el.innerHTML = `<div class="lt">${L.title}</div><div class="ramp">${xs.map(x => `<span style="background:${cssc(diverging(x, L.neg, L.pos, L.dead))}"></span>`).join('')}</div>` +
      `<div class="ticks" style="position:relative;height:14px">${L.ticks.map(([v, t]) => `<span style="position:absolute;left:${pos(v) * 100}%;transform:translateX(-50%);white-space:nowrap">${t}</span>`).join('')}</div>` +
      (sym ? '' : `<div style="font-size:11px;color:var(--ink-3)">Scale is not to proportion: decline and growth arms are drawn at different widths.</div>`) +
      (m.kind === 'spike' ? `<div style="margin-top:6px">Spike height = people. Spikes sit inside each province, not at its population centre.</div>` : '');
  } else if (L.kind === 'mag') {
    el.innerHTML = `<div class="lt">${L.title}</div><div class="ramp">${MAG.map(c => `<span style="background:${cssc(c)}"></span>`).join('')}</div><div class="ticks">${L.ticks.map(t => `<span>${t}</span>`).join('')}</div>`;
  } else if (L.kind === 'flow') {
    el.innerHTML = `<div class="lt">Migration flows</div><div>${L.title}</div><div style="margin-top:4px">${state.p ? `<span class="sw"><i style="background:${cssc(C('decline-3'))}"></i>leaving ${state.p}</span><span class="sw"><i style="background:${cssc(C('grow-4'))}"></i>arriving in ${state.p}</span>` : 'Showing the 40 largest flows. Select a province to see all of its flows.'}</div>`;
  } else if (L.kind === 'party') {
    const e = electionAt(state.y); const ps = e ? Object.keys(e.seats_total) : [];
    el.innerHTML = `<div class="lt">Party with the most federal seats in each province</div>${ps.slice(0, 7).map(p => `<span class="sw"><i style="background:${cssc(partyCol(p))}"></i>${partyShort(p)} ${e.seats_total[p]}</span>`).join('')}` +
      `<div style="margin-top:4px;color:var(--ink-3)">Party colours are used only on this layer. Seats ≠ votes.</div>`;
  }
}
function headline(m) {
  document.getElementById('h-measure').textContent = m.label;
  const when = m.comp || m.kind === 'arcs' ? compWhen(state.y) : m.when(state.y);
  document.getElementById('h-year').textContent = when;
  const notes = [];
  if (!m.split(state.y)) notes.push('Northwest Territories and Nunavut are combined: no separate figures exist for this date.');
  if (m.kind === 'arcs' && state.y <= 1976) notes.push('Before July 1976, moves are estimated from Family Allowance records (different method).');
  if (m.id === 'fed' && electionAt(state.y)?.date === '2025-04-28') notes.push('ParlInfo records 341 of 343 seats for 2025.');
  document.getElementById('h-note').textContent = notes.join(' ');
  const mi = ministryAt(`${state.y}-07-01`);
  document.getElementById('tl-now').textContent = mi ? `Prime Minister on July 1, ${state.y}: ${mi.pm} (${partyShort(mi.party)})` : '';
}

// ---------------------------------------------------------------- panel
const panel = document.getElementById('panel-body');
function chartSVG(g, m) {
  const ys = []; for (let y = m.years[0]; y <= m.years[1]; y++) { let gg = g; if (!m.split(y) && (g === 'NT' || g === 'NU')) gg = 'NT+NU'; if (m.split(y) && g === 'NT+NU') continue;
    const v = m.kind === 'party' ? null : m.value(gg, y); if (v != null && isFinite(v)) ys.push([y, v, gg]); }
  if (ys.length < 2) return '';
  const W = 320, H = 150, l = 44, r = 8, t = 10, b = 22;
  const lo = Math.min(0, ...ys.map(d => d[1])), hi = Math.max(...ys.map(d => d[1]));
  const X = y => l + (y - m.years[0]) / (m.years[1] - m.years[0]) * (W - l - r), Y = v => t + (1 - (v - lo) / (hi - lo || 1)) * (H - t - b);
  const path = ys.map((d, i) => `${i ? 'L' : 'M'}${X(d[0]).toFixed(1)},${Y(d[1]).toFixed(1)}`).join('');
  const cur = ys.find(d => d[0] === state.y);
  const brk = ys.findIndex((d, i) => i && d[2] !== ys[i - 1][2]);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${m.label} over time for ${NAMES[g]}">
    <line x1="${l}" x2="${W - r}" y1="${Y(lo)}" y2="${Y(lo)}" stroke="var(--hairline)"/>${lo < 0 ? `<line x1="${l}" x2="${W - r}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--ink-3)" stroke-dasharray="2 3"/>` : ''}
    <text x="${l - 6}" y="${Y(hi) + 4}" text-anchor="end" font-size="10.5" fill="var(--ink-3)">${m.fmt(hi)}</text>
    <text x="${l - 6}" y="${Y(lo) + 4}" text-anchor="end" font-size="10.5" fill="var(--ink-3)">${m.fmt(lo)}</text>
    <text x="${l}" y="${H - 6}" font-size="10.5" fill="var(--ink-3)">${m.years[0]}</text><text x="${W - r}" y="${H - 6}" text-anchor="end" font-size="10.5" fill="var(--ink-3)">${m.years[1]}</text>
    ${brk > 0 ? `<line x1="${X(ys[brk][0])}" x2="${X(ys[brk][0])}" y1="${t}" y2="${H - b}" stroke="var(--ink-3)" stroke-dasharray="3 3"/><text x="${X(ys[brk][0]) + 3}" y="${t + 9}" font-size="10" fill="var(--ink-3)">series break</text>` : ''}
    <path d="${path}" fill="none" stroke="var(--ink-1)" stroke-width="1.8"/>
    ${cur ? `<line x1="${X(cur[0])}" x2="${X(cur[0])}" y1="${t}" y2="${H - b}" stroke="var(--accent)"/><circle cx="${X(cur[0])}" cy="${Y(cur[1])}" r="4" fill="var(--accent)"/>` : ''}
    <rect x="${l}" y="${t}" width="${W - l - r}" height="${H - t - b}" fill="transparent" data-chart="${m.years[0]},${m.years[1]},${l},${W - r},${W}" style="cursor:crosshair"/></svg>`;
}
function glance(g, y) {
  const rows = ['pop', 'chg', 'rate', 'dens', 'share', 'nat', 'imm', 'npr', 'emi', 'ipm'].map(id => { const m = M[id]; let gg = g;
    if (gg === 'NT' || gg === 'NU') { if (!m.split(y)) gg = 'NT+NU'; }
    const v = y >= m.years[0] && y <= m.years[1] ? m.value(gg, y) : null;
    return `<tr class="click ${id === state.m ? 'cur' : ''}" data-m="${id}"><td>${m.label}</td><td>${v == null ? '—' : m.fmt(v)}</td></tr>`; }).join('');
  return `<table>${rows}</table>`;
}
function seatsBlock(g, y) {
  const e = electionAt(y); if (!e) return '';
  const s = g === 'CAN' ? e.seats_total : e.seats_by_province[g === 'NT+NU' ? 'NT' : g];
  if (!s) return `<div class="sec"><h3>Federal seats</h3><div class="sub">No seats recorded here for the ${e.date.slice(0, 4)} election.</div></div>`;
  const tot = Object.values(s).reduce((a, b) => a + b, 0);
  return `<div class="sec"><h3>Federal seats · election of ${fmtDate(e.date)}</h3><div class="seats">${Object.entries(s).map(([p, n]) => `<span title="${partyShort(p)} ${n}" style="flex:${n};background:${cssc(partyCol(p))}"></span>`).join('')}</div>
    <table>${Object.entries(s).map(([p, n]) => `<tr><td>${partyShort(p)}</td><td>${n} of ${tot}</td></tr>`).join('')}</table>
    <div class="src">Seats won on election night (ParlInfo). Not vote share.</div></div>`;
}
function eventsBlock(g, y) {
  const evs = events.filter(e => +e.date.slice(0, 4) === y && (g === 'CAN' || !e.places?.length || e.places.includes(g)));
  if (!evs.length) return '';
  return `<div class="sec"><h3>In ${y}</h3>${evs.map(e => `<div class="ev"><span class="etag">${e.tag.replace(/_/g, ' ')}</span><b>${e.title}</b><span>${fmtDate(e.date)} · ${e.where}. ${e.body}</span>
    <div class="src">${e.source_url ? `<a href="${e.source_url}" target="_blank" rel="noopener">${e.source}</a>` : e.source}</div></div>`).join('')}</div>`;
}
function renderPanel() {
  const m = M[state.m], y = state.y;
  let g = state.p || 'CAN';
  if ((g === 'NT' || g === 'NU') && !m.split(y)) g = 'NT+NU';
  const v = m.kind === 'party' ? null : m.value(g, y);
  let big = '', bigsub = '';
  if (m.kind === 'party') { const e = electionAt(y); const s = e && (g === 'CAN' ? e.seats_total : e.seats_by_province[g === 'NT+NU' ? 'NT' : g]);
    const top = s ? Object.entries(s)[0] : null; big = top ? partyShort(top[0]) : '—'; bigsub = top ? `${top[1]} seats · most in ${g === 'CAN' ? 'the House' : 'this province'}` : ''; }
  else if (v != null) {
    big = m.fmt(v); bigsub = m.unit;
    if (g !== 'CAN' && m.kind !== 'arcs') { const geos = geosFor(m.split(y)).filter(k => k !== 'CAN'); const ranked = geos.map(k => [k, m.value(k, y)]).filter(d => d[1] != null).sort((a, b) => b[1] - a[1]);
      const r = ranked.findIndex(d => d[0] === g) + 1; if (r) bigsub += ` · ${r} of ${ranked.length}`; }
  } else { big = '—'; bigsub = 'No data for this place and year'; }
  const mi = ministryAt(`${y}-07-01`);
  panel.innerHTML = `${state.p ? '<button class="back" data-act="canada">← Canada</button>' : ''}
    <h2>${NAMES[g]}</h2><div class="sub">${m.comp || m.kind === 'arcs' ? compWhen(y) : m.when ? m.when(y) : y}</div>
    <div class="big">${big}</div><div class="bigsub">${m.label} · ${bigsub}</div>
    ${m.kind === 'party' ? '' : chartSVG(g, m)}
    <button class="srcbtn" data-act="src">Source and method: ${m.src.map(s => registry[s].table_id || registry[s].publisher).join(', ')} · <span class="etag" style="margin:0">${m.tag}</span></button>
    ${m.kind === 'arcs' && g !== 'CAN' ? flowsBlock(g, y) : ''}
    ${seatsBlock(g, y)}
    <div class="sec"><h3>At a glance, ${y}</h3>${glance(g, y)}<div class="src">Tap a row to map it. — = not available for this place or year.</div></div>
    ${eventsBlock(g, y)}
    <div class="sec"><h3>Federal government</h3><div class="sub" style="color:var(--ink-2)">${mi ? `${mi.pm}, ${partyShort(mi.party)} (${mi.ministry}th Ministry, from ${fmtDate(mi.start)})` : ''}</div>
    <div class="src">Shown for context only. This explorer does not attribute outcomes to governments.</div></div>`;
}
function flowsBlock(g, y) {
  const rows = (flows.data[String(y - 1)] || []);
  const out = rows.filter(r => r[0] === g).sort((a, b) => b[2] - a[2]), inn = rows.filter(r => r[1] === g).sort((a, b) => b[2] - a[2]);
  const so = out.reduce((a, r) => a + r[2], 0), si = inn.reduce((a, r) => a + r[2], 0);
  return `<div class="sec"><h3>Moves, July ${y - 1}–June ${y}</h3><table><tr><td>Arrived from other provinces</td><td>${fmtInt(si)}</td></tr><tr><td>Left for other provinces</td><td>${fmtInt(so)}</td></tr>
    <tr><td><b>Net</b></td><td><b>${signed(si - so, 0)}</b></td></tr></table>
    <h3 style="margin-top:12px">Top destinations</h3><table>${out.slice(0, 4).map(r => `<tr><td>${NAMES[r[1]]}</td><td>${fmtInt(r[2])}</td></tr>`).join('')}</table>
    <h3 style="margin-top:12px">Top origins</h3><table>${inn.slice(0, 4).map(r => `<tr><td>${NAMES[r[0]]}</td><td>${fmtInt(r[2])}</td></tr>`).join('')}</table>
    <div class="src">Sums of four quarterly estimates; people who move twice are counted twice.</div></div>`;
}
panel.addEventListener('click', e => {
  const t = e.target.closest('[data-act],[data-m],[data-chart]'); if (!t) return;
  if (t.dataset.act === 'canada') { state.p = null; update(); }
  else if (t.dataset.act === 'src') openSource(M[state.m]);
  else if (t.dataset.m) { state.m = t.dataset.m; state.y = clampYear(M[state.m], state.y); update(); }
  else if (t.dataset.chart) { const [y0, y1, l, r, W] = t.dataset.chart.split(',').map(Number); const box = t.ownerSVGElement.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width * W; state.y = clampYear(M[state.m], Math.round(y0 + (x - l) / (r - l) * (y1 - y0))); stop(); update(); }
});
document.getElementById('panel-grip').onclick = () => document.getElementById('panel').classList.toggle('tall');

// ---------------------------------------------------------------- source drawer
const drawer = document.getElementById('drawer');
function openSource(m) {
  document.getElementById('drawer-body').innerHTML = `<span class="etag">${m.tag}</span><h2>${m.label}</h2><div style="color:var(--ink-2)">${m.desc}${m.unit ? ` · unit: ${m.unit}` : ''}</div>` +
    m.src.map(id => { const s = registry[id]; return `<dl><dt>Publisher</dt><dd>${s.publisher}</dd><dt>Dataset</dt><dd>${s.title}${s.table_id ? ` (Table ${s.table_id})` : ''}</dd>
      <dt>Link</dt><dd><a href="${s.landing_url}" target="_blank" rel="noopener">${s.landing_url}</a>${s.doi ? `<br><a href="${s.doi}" target="_blank" rel="noopener">${s.doi}</a>` : ''}</dd>
      <dt>Period</dt><dd>${s.reporting_period || ''}</dd><dt>Retrieved</dt><dd>${s.retrieved}</dd><dt>Licence</dt><dd>${s.licence}</dd><dt>File SHA-256</dt><dd style="font-family:var(--font-mono);font-size:11.5px;word-break:break-all">${s.sha256 || ''}</dd></dl>
      ${(s.methodology_notes || []).length ? `<b>Method notes</b><ul>${s.methodology_notes.map(n => `<li>${n}</li>`).join('')}</ul>` : ''}
      ${(s.limitations || []).length ? `<b>Limitations</b><ul>${s.limitations.map(n => `<li>${n}</li>`).join('')}</ul>` : ''}`; }).join('<hr style="border-color:var(--hairline)">') +
    (m.tag === 'Derived' ? `<p style="color:var(--ink-2);font-size:13.5px">Derived: calculated by this platform from the official figures above. Formula: ${derivation(m)}.</p>` : '');
  drawer.showModal();
}
const derivation = m => ({ chg: 'population(July 1, year) ÷ population(July 1, 1971) − 1', rate: 'population(July 1, year) ÷ population(July 1, year − 1) − 1',
  dens: 'population(July 1, year) ÷ land area (2021 Census)', share: 'population ÷ Canada population, same date',
  nat: '(births − deaths, July–June) ÷ population at the start of the period × 1,000', imm: 'immigrants ÷ population at the start of the period × 1,000',
  npr: 'net non-permanent residents ÷ population at the start of the period × 1,000', emi: 'net emigration ÷ population at the start of the period × 1,000',
  ipm: 'net interprovincial migration ÷ population at the start of the period × 1,000' })[m.id] || '';
function openEvent(e) {
  document.getElementById('drawer-body').innerHTML = `<span class="etag">${e.tag.replace(/_/g, ' ')}</span><h2>${e.title}</h2><div style="color:var(--ink-2)">${fmtDate(e.date)} · ${e.where}</div>
    <p>${e.body}</p><p style="font-size:13.5px">Source: ${e.source_url ? `<a href="${e.source_url}" target="_blank" rel="noopener">${e.source}</a>` : e.source}</p>`;
  drawer.showModal();
}

// ---------------------------------------------------------------- update
function update() {
  const m = M[state.m];
  state.y = clampYear(m, state.y);
  yr.value = state.y; document.getElementById('tl-year').textContent = state.y;
  document.querySelectorAll('#layers .opt').forEach(b => b.classList.toggle('on', b.dataset.m === state.m));
  document.getElementById('layers-toggle').textContent = `Layer: ${m.label} ▾`;
  theDeck.setProps({ layers: layers() });
  legend(m); headline(m); renderPanel(); writeHash();
}
update();
window.CTX = { state, update, M };
