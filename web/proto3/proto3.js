/* Canada Through Time — Explorer v0.2, "Aurora" design (?dir=b keeps the Lamplight comparison until the design is approved).
 * Same data, measures and evidence rules as web/explore; this file explores layout, type, colour and map treatment.
 * State lives in the URL hash (#chg-2026-ab) so any view can be shared.
 */
const { Deck, OrbitView, GeoJsonLayer, ColumnLayer, TextLayer, ArcLayer, PathLayer, ScatterplotLayer, LineLayer, LightingEffect, AmbientLight, DirectionalLight, COORDINATE_SYSTEM } = deck;
const CART = COORDINATE_SYSTEM.CARTESIAN;
const Q = new URLSearchParams(location.search);
const V = 's';                                 // composition: Night Lanterns
const PAL = ['vintage', 'beach', 'tuscan'].includes(Q.get('p')) ? Q.get('p') : 'vintage';
document.body.classList.add('v-s', 'pal-' + PAL);

// ---------------------------------------------------------------- tokens
const css = getComputedStyle(document.body);
const tok = n => css.getPropertyValue('--' + n).trim();
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const C = n => rgb(tok(n));
const cssc = (c, a) => a == null ? `rgb(${c.join(',')})` : `rgba(${c.join(',')},${a})`;
const lerpC = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const UI_FONT = V === 's' ? 'Schibsted Grotesk' : 'Instrument Sans';

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
const [HC, HH, HCPI, HINC, HCITY, HREG] = await Promise.all(['construction', 'households', 'cpi', 'income', 'cities', 'registry'].map(n => J(`../data/housing/${n}.json`)));
Object.assign(registry, HREG);
await Promise.all([`600 16px "${UI_FONT}"`, `400 16px "${UI_FONT}"`, `500 16px "${UI_FONT}"`].map(f => document.fonts.load(f)));

const S = pop.series, D = pop.dates;
const PRELIM = { pop: (() => { const n = (pop.notes || []).find(x => /preliminary postcensal from/i.test(x)); const m = n && n.match(/preliminary postcensal from ([A-Z][a-z]+) (\d+), (\d{4})/i);
  return m ? `${m[3]}-${String(MONTHS.indexOf(m[1]) + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}` : null; })(), compPeriodStart: 2025 };
const isPrelim = (m, y) => m.prelim ? m.prelim(y) : (m.comp || m.kind === 'arcs') ? y - 1 >= PRELIM.compPeriodStart : m.kind === 'party' ? false : !!PRELIM.pop && `${y}-07-01` >= PRELIM.pop;
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
// ---------------------------------------------------------------- housing and cost of living
const hc = (g, key, y) => HC.data[g]?.[key]?.[y] ?? null;
const hh = (g, y) => HH.data[g]?.[y] ?? null;
const cpi = (g, p, y) => HCPI.data[g]?.[p]?.[y] ?? null;
const inc = (g, y) => HINC.data[g]?.[y] ?? null;
const PROV10 = ['NL', 'PE', 'NS', 'NB', 'QC', 'ON', 'MB', 'SK', 'AB', 'BC'];
const CITIES = HCITY.cities;
const BIG = new Set(['Toronto', 'Montréal', 'Vancouver', 'Calgary', 'Edmonton', 'Ottawa-Gatineau', 'Winnipeg', 'Québec', 'Halifax', 'Saskatoon', 'Regina', "St. John's"]);
const LEFT = new Set(['Ottawa-Gatineau', 'Toronto']);   // label to the left of the point to avoid neighbours
MEASURES.push(
  { id: 'starts', group: 'Housing and cost of living', label: 'Housing starts', q: 'New homes started each year, for every 1,000 residents. Provinces only: this CMHC table has no territorial data.', kind: 'fill', src: ['statcan_34100126', 'statcan_17100009'], tag: 'Derived',
    years: [1972, 2025], split: y => y >= 1991, value: (g, y) => { const s = hc(g, 'starts_total', y), p = popAt(g, y); return s != null && p ? s / p * 1000 : null; },
    fmt: v => v.toFixed(1), unit: 'starts per 1,000 residents', color: v => magnitude(v, 2, 16, false), cover: 'Territories not in this table',
    legend: { kind: 'mag', ticks: [[0, '2'], [0.286, '6'], [0.571, '10'], [1, '16+']], cap: 'Housing starts per 1,000 residents (calendar year)', nodata: true }, when: y => `Calendar year ${y}`, prelim: () => false },
  { id: 'hhg', group: 'Housing and cost of living', label: 'Household growth', q: 'Change in the number of private households since July 2006, when this series begins.', kind: 'fill', src: ['statcan_17100159'], tag: 'Derived',
    years: [2007, 2025], split: () => true, value: (g, y) => { const a = hh(g, 2006), b = hh(g, y); return a && b ? b / a - 1 : null; },
    fmt: v => pct(v), unit: 'change in private households', color: v => diverging(v, 0.1, 0.6, 0.01),
    legend: { kind: 'div', neg: 0.1, pos: 0.6, dead: 0.01, decl: [[-0.1, '−10%'], [-0.05, '−5%']], grow: [[0.2, '+20%'], [0.4, '+40%'], [0.6, '+60%']], deadLabel: 'within ±1%', deadTick: '±1%', sides: 'Fewer households on the left, more on the right' },
    when: y => `July 1, 2006 → July 1, ${y}`, prelim: y => y >= HH.prelim_from },
  { id: 'vac', group: 'Housing and cost of living', label: 'Rental vacancy', q: 'Share of purpose-built rental apartments sitting empty each October. Low means a tight market. Cities only.', kind: 'points', src: ['statcan_34100127'], tag: 'Official statistic',
    years: [1972, 2025], split: y => y >= 1991, cityValue: (c, y) => c.vacancy[y] ?? null, value: (g, y) => g === 'CAN' ? HCITY.cma_average_vacancy[y] ?? null : null,
    fmt: v => v.toFixed(1) + '%', unit: 'of rental apartments vacant', color: v => magnitude(v, 0, 8, false), cover: `${CITIES.length} of ${CITIES.length + HCITY.unplaced.length} cities mapped`,
    legend: { kind: 'mag', ticks: [[0, '0%'], [0.25, '2%'], [0.5, '4%'], [0.75, '6%'], [1, '8%+']], cap: 'Vacancy rate, apartments of 6+ units, October', points: true }, when: y => `October ${y}`, prelim: () => false },
  { id: 'rent', group: 'Housing and cost of living', label: 'Average rent, 2-bedroom', q: 'Average monthly rent for a two-bedroom in purpose-built rental buildings, in current dollars. Cities only.', kind: 'points', src: ['statcan_34100133'], tag: 'Official statistic',
    years: [1987, 2025], split: y => y >= 1991, cityValue: (c, y) => c.rent2br[y] ?? null, value: () => null,
    fmt: v => '$' + fmtInt(v), unit: 'per month (current dollars)', color: v => magnitude(v, 400, 2400, false), cover: 'Current dollars · cities only',
    legend: { kind: 'mag', ticks: [[0, '$400'], [0.3, '$1,000'], [0.6, '$1,600'], [1, '$2,400+']], cap: 'Average rent, two-bedroom, current dollars, October', points: true }, when: y => `October ${y}`, prelim: () => false },
  { id: 'rentrel', group: 'Housing and cost of living', label: 'Rent prices vs all prices', q: 'How much the CPI rent index rose compared with all consumer prices since 2019, when Statistics Canada adopted its current rent method. Zero means rent kept pace.', kind: 'fill', src: ['statcan_18100005'], tag: 'Derived',
    years: [2020, 2025], split: y => y >= 1991, value: (g, y) => { const r0 = cpi(g, 'rent', 2019), r = cpi(g, 'rent', y), a0 = cpi(g, 'all', 2019), a = cpi(g, 'all', y); return r0 && r && a0 && a ? (r / r0) / (a / a0) - 1 : null; },
    fmt: v => pct(v, 1), unit: 'rent index relative to all-items CPI', color: v => diverging(v, 0.15, 0.15, 0.01), cover: 'Since 2019 method change · provinces only',
    legend: { kind: 'div', neg: 0.15, pos: 0.15, dead: 0.01, decl: [[-0.15, '−15%'], [-0.075, '−7.5%']], grow: [[0.075, '+7.5%'], [0.15, '+15%']], deadLabel: 'rent kept pace (±1%)', deadTick: '±1%', nodata: true, sides: 'Rent rose less than other prices on the left, more on the right' },
    when: y => `2019 → ${y}, annual averages`, prelim: () => false },
  { id: 'inc', group: 'Housing and cost of living', label: 'Median after-tax income', q: 'Median after-tax income of all family units, adjusted for inflation to 2024 dollars. Owners and renters together.', kind: 'fill', src: ['statcan_11100190'], tag: 'Official statistic',
    years: [1976, 2024], split: y => y >= 1991, value: (g, y) => inc(g, y), fmt: v => '$' + fmtInt(v), unit: '2024 dollars', color: v => magnitude(v, 40000, 90000, false),
    cover: 'Territories from 2018 only', legend: { kind: 'mag', ticks: [[0, '$40K'], [0.4, '$60K'], [0.8, '$80K'], [1, '$90K+']], cap: 'Median after-tax income, 2024 dollars', nodata: true }, when: y => `Calendar year ${y}`, prelim: () => false },
);
const M = Object.fromEntries(MEASURES.map(m => [m.id, m]));
const compWhen = y => `July 1, ${y - 1} → June 30, ${y}`;
const whenOf = (m, y) => m.comp || m.kind === 'arcs' ? compWhen(y) : m.when(y);

// ---------------------------------------------------------------- state
const state = { m: 'pop', y: YMAX, p: null, city: Q.get('city') || null, playing: false, speed: 0.8 };
const enc = g => g === 'NT+NU' ? 'ntnu' : g.toLowerCase(), dec = t => t === 'ntnu' ? 'NT+NU' : (t || '').toUpperCase();
function applyHash() { const [m, y, p] = location.hash.slice(1).split('-'); if (M[m]) state.m = m; if (+y >= YMIN && +y <= YMAX) state.y = +y; state.p = NAMES[dec(p)] && dec(p) !== 'CAN' ? dec(p) : null; }
applyHash();
const writeHash = () => { const t = `#${state.m}-${state.y}${state.p ? '-' + enc(state.p) : ''}`; if (location.hash !== t) history.replaceState(null, '', t); };
addEventListener('hashchange', () => { applyHash(); update(); });
const clampYear = (m, y) => Math.max(m.years[0], Math.min(m.years[1], y));
const isPhone = () => innerWidth <= 760;

// ---------------------------------------------------------------- deck
const PEEK = 168;
const mapEl = document.getElementById('map');
function fitView() {
  const w = mapEl.clientWidth || innerWidth, h = mapEl.clientHeight || innerHeight, phone = isPhone();
  // region of the map container the country should fill, per composition
  let r;
  if (V === 's') r = phone ? [0, w, 290, h - Math.min(window.__sheetH || PEEK, h * 0.5)] : [420, w - 410, 230, h - 120];
  else r = phone ? [6, w - 6, 10, h - 20] : [10, w - 300, 20, h - 10];
  const [x0, x1, y0, y1] = r;
  const tilt = V === 's' ? (phone ? 46 : 54) : (phone ? 24 : 30);
  const zoom = Math.log2(Math.min((x1 - x0) / (V === 's' ? (phone ? 5600 : 5300) : (phone ? 5000 : 5500)), (y1 - y0) / (V === 's' ? (phone ? 3000 : 3300) : 4000)));
  const sc = 2 ** zoom, dx = (x0 + x1) / 2 - w / 2, dy = (y0 + y1) / 2 - h / 2;
  const ty = V === 's' ? 2350 : (phone ? 2800 : 2500);
  return { target: [(V === 's' && phone ? 6150 : 6380) - dx / sc, ty + dy / sc * (V === 's' ? 1.6 : 1.15), 0], zoom, rotationX: tilt, rotationOrbit: V === 's' && !phone ? -6 : 0, minZoom: zoom - 1.5, maxZoom: zoom + 4 };
}
let view = fitView();
const theDeck = new Deck({
  parent: mapEl, views: new OrbitView({ orbitAxis: 'Z', fovy: V === 's' ? 38 : 22 }),
  controller: { dragMode: 'pan', inertia: true, scrollZoom: { smooth: true, speed: 0.02 } },
  viewState: view, onViewStateChange: ({ viewState }) => { view = { ...viewState, rotationX: Math.max(0, Math.min(70, viewState.rotationX)) }; theDeck.setProps({ viewState: view }); },
  effects: [new LightingEffect(V === 's'
    ? (PAL === 'beach' ? { a: new AmbientLight({ color: [255, 255, 255], intensity: 0.92 }), k: new DirectionalLight({ color: [255, 248, 230], intensity: 0.55, direction: [4, -7, -5] }) }
       : { a: new AmbientLight({ color: [225, 225, 245], intensity: 0.62 }), k: new DirectionalLight({ color: [255, 230, 196], intensity: 1.35, direction: [4, -7, -5] }) })
    : { a: new AmbientLight({ color: [255, 255, 255], intensity: 1.0 }), k: new DirectionalLight({ color: [255, 255, 255], intensity: 0.25, direction: [-3, -6, -7] }) })],
  parameters: { clearColor: [0, 0, 0, 0] },
  getCursor: ({ isHovering, isDragging }) => isDragging ? 'grabbing' : isHovering ? 'pointer' : 'grab',
  onHover: info => tooltip(info), onClick: info => click(info),
});

const tt = document.getElementById('tooltip');
function tooltip(info) {
  const o = info.object; if (!o || isPhone()) { tt.style.display = 'none'; return; }
  let html = '';
  if (o.geo && o.xy) { const m = M[state.m]; const v = m.cityValue ? m.cityValue(o, state.y) : null;
    html = `<b>${o.geo}</b><div class="m">${m.label}: ${v == null ? (o.rent2br_status?.[state.y] === 'F' ? 'too unreliable to publish' : 'not surveyed') : m.fmt(v)}</div>`; }
  else if (o.properties?.abbr || o.k) { const g = o.properties?.abbr || o.k; const m = M[state.m]; const v = m.value(g, state.y);
    html = `<b>${NAMES[g]}</b><div class="m">${m.label}: ${v == null ? 'no data' : m.fmt(v)}</div>`; }
  else if (o.o) html = `<b>${NAMES[o.o]} → ${NAMES[o.d]}</b><div class="m">${fmtInt(o.v)} moves, July ${state.y - 1}–June ${state.y}</div>`;
  else if (o.title) html = `<b>${o.title}</b><div class="m">${fmtDate(o.date)} · ${o.where}</div>`;
  tt.innerHTML = html; tt.style.display = html ? 'block' : 'none';
  tt.style.left = Math.min(info.x + 14, innerWidth - 290) + 'px'; tt.style.top = (info.y + 14) + 'px';
}
function click(info) {
  const o = info.object; if (!o) return;
  if (o.title) { openEvent(o); return; }
  if (o.geo && o.xy) { state.city = state.city === o.name ? null : o.name; update(); if (isPhone() && state.city) setSheet(1); return; }
  const g = o.properties?.abbr || o.k; if (!g) return;
  state.p = state.p === g ? null : g; update();
  if (isPhone() && state.p) setSheet(1);
}

// ---------------------------------------------------------------- map layers
const PLATE = V === 's' ? 70 : 0;    // land plate thickness (km): a constant, never data
const KMPM = 70;                      // spike height: 70 km per million people (same as the videos)
var allLand = { type: 'FeatureCollection', features: [...countries.features, ...provinces.features] };
// Lambert Conformal Conic (Statistics Canada, EPSG:3347) → km, for the graticule. Same maths as pipeline/build_explorer_data.py.
const LCC = (() => { const a = 6378137, f = 1 / 298.257222101, e = Math.sqrt(2 * f - f * f), rad = Math.PI / 180;
  const [p1, p2, p0, l0] = [49, 77, 63.390675, -91.86666666666666].map(x => x * rad);
  const m = p => Math.cos(p) / Math.sqrt(1 - (e * Math.sin(p)) ** 2), t = p => Math.tan(Math.PI / 4 - p / 2) / ((1 - e * Math.sin(p)) / (1 + e * Math.sin(p))) ** (e / 2);
  const n = (Math.log(m(p1)) - Math.log(m(p2))) / (Math.log(t(p1)) - Math.log(t(p2))), F = m(p1) / (n * t(p1) ** n), r = p => a * F * t(p) ** n;
  return (lon, lat) => { const th = n * (lon * rad - l0); return [(6200000 + r(lat * rad) * Math.sin(th)) / 1000, (3000000 + r(p0) - r(lat * rad) * Math.cos(th)) / 1000]; }; })();
const GRAT = [];
for (let lat = 40; lat <= 85; lat += 5) { const path = []; for (let lon = -150; lon <= -40; lon += 1) path.push(LCC(lon, lat)); GRAT.push({ path, major: lat % 10 === 0, lab: lat % 10 === 0 ? `${lat}°N` : '', at: LCC(-146, lat) }); }
for (let lon = -140; lon <= -50; lon += 10) { const path = []; for (let lat = 40; lat <= 85; lat += 0.5) path.push(LCC(lon, lat)); GRAT.push({ path, major: true, lab: lon % 40 === 20 ? `${-lon}°W` : '', at: LCC(lon, 81) }); }
function seaLayers() {
  if (V === 's') return [];
  // Survey plate: graticule plus water-lining (thin lines echoing the coast, as on engraved atlases). Neither carries data.
  const ln = C('grat'), sea = C('ocean');
  const water = [[26, ln], [25, sea], [16, ln], [15, sea], [8, ln], [7, sea]].map(([w, c], i) => new GeoJsonLayer({ id: 'wl' + i, data: allLand, coordinateSystem: CART, filled: false, stroked: true,
    getLineColor: [...c, i % 2 ? 255 : 210], lineWidthUnits: 'pixels', getLineWidth: w, lineJointRounded: true, parameters: { depthTest: false } }));
  return [new PathLayer({ id: 'grat', data: GRAT, coordinateSystem: CART, getPath: d => d.path, getColor: d => [...ln, d.major ? 200 : 110], widthUnits: 'pixels', getWidth: d => d.major ? 1 : 0.7, parameters: { depthTest: false } }),
    ...water,
    new TextLayer({ id: 'grat-lab', data: GRAT.filter(d => d.lab), coordinateSystem: CART, getPosition: d => [...d.at, 0], getText: d => d.lab, getSize: 11, fontFamily: UI_FONT, fontWeight: 500,
      getColor: [...C('ink-3'), 230], characterSet: 'auto', fontSettings: { sdf: true, fontSize: 48, buffer: 6 }, outlineWidth: 4, outlineColor: [...sea, 255], parameters: { depthTest: false } })];
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
    if (m.kind === 'fill') return v == null ? dimC : m.color(v);   // no data: the dimmed plate, named in the legend
    if (m.kind === 'party') return v ? lerpC(partyCol(v[0]), C('ocean'), 0.18) : landC;
    if (m.kind === 'arcs') return state.p && g !== sel ? dimC : landC;
    return landC;
  };
  const z = PLATE;
  const L = [...seaLayers(), neighbour,
    new GeoJsonLayer({ id: 'land', data: feats, coordinateSystem: CART, filled: true, stroked: !PLATE, extruded: !!PLATE, pickable: true,
      getElevation: z, getFillColor: fillColor, getLineColor: C('boundary'), lineWidthUnits: 'pixels', getLineWidth: 1,
      material: V === 's' ? { ambient: 0.5, diffuse: 0.75, shininess: 12, specularColor: [40, 34, 28] } : { ambient: 1, diffuse: 0.15, shininess: 0, specularColor: [0, 0, 0] },
      updateTriggers: { getFillColor: [state.m, y, state.p] }, transitions: { getFillColor: 450 } }),
    lakeLayer,
    new PathLayer({ id: 'bounds', data: split ? OUT_SPLIT : OUT_COMB, coordinateSystem: CART, getPath: d => d.path.map(p => [p[0], p[1], z + 0.6]),
      getColor: [...C('boundary'), 200], widthUnits: 'pixels', getWidth: V === 's' ? 1 : 0.9, jointRounded: true, parameters: { depthTest: false } }),
  ];
  if (sel) { const sp = (split ? OUT_SPLIT : OUT_COMB).filter(d => d.abbr === sel);
    L.push(new PathLayer({ id: 'sel-halo', data: sp, coordinateSystem: CART, getPath: d => d.path.map(p => [p[0], p[1], z + 0.8]), getColor: [...C('halo'), 230], widthUnits: 'pixels', getWidth: 6, jointRounded: true, parameters: { depthTest: false } }),
      new PathLayer({ id: 'sel', data: sp, coordinateSystem: CART, getPath: d => d.path.map(p => [p[0], p[1], z + 1]), getColor: C('select'), widthUnits: 'pixels', getWidth: 2.6, jointRounded: true, parameters: { depthTest: false } })); }
  const pts = geos.map(g => ({ k: g, p: anchor[g] }));
  if (m.kind === 'spike') {
    const h = g => ((m.height ? m.height(g, y) : val[g]) || 0) / 1e6 * KMPM;
    const col = d => m.colorBy ? (m.color(m.colorBy(d.k, y)) || NEU) : C('spike');
    const R0 = V === 's' ? 40 : 24;
    L.push(new ColumnLayer({ id: 'foot', data: pts, coordinateSystem: CART, diskResolution: 40, radius: V === 's' ? 120 : 60, extruded: false, getPosition: d => [d.p[0], d.p[1], z + 1.2],
        getFillColor: V === 's' ? [...C('spike'), 46] : [...C('ink-1'), 40], parameters: { depthTest: false } }),
      new ColumnLayer({ id: 'spikes', data: pts, coordinateSystem: CART, diskResolution: 32, radius: R0, extruded: true, pickable: true,
        getPosition: d => [d.p[0], d.p[1], z], getElevation: d => h(d.k), getFillColor: col,
        material: V === 's' ? { ambient: 1.0, diffuse: 0.25, shininess: 80, specularColor: [255, 230, 190] } : { ambient: 0.75, diffuse: 0.4, shininess: 0, specularColor: [0, 0, 0] },
        updateTriggers: { getElevation: [state.m, y], getFillColor: [state.m, y] }, transitions: { getElevation: 500, getFillColor: 400 } }));
    if (V === 's') L.push(new ColumnLayer({ id: 'cap', data: pts, coordinateSystem: CART, diskResolution: 32, radius: R0 * 1.9, extruded: false, getPosition: d => [d.p[0], d.p[1], z + h(d.k) + 0.5],
        getFillColor: [...C('spike'), 110], parameters: { depthTest: false }, updateTriggers: { getPosition: [state.m, y] }, transitions: { getPosition: 500 } }));
    L.push(...labels(pts, d => [d.p[0], d.p[1], z + h(d.k)], val, m, sel));
  } else if (m.kind === 'points') {
    L.push(...cityLayers(m, y, z));
    L.push(...labels(pts, d => [d.p[0], d.p[1], z], {}, { ...m, fmt: () => '' }, sel, true));
  } else {
    if (m.kind === 'arcs') L.push(arcs(y, sel, z));
    L.push(...labels(pts, d => [d.p[0], d.p[1], z], val, m, sel));
  }
  L.push(...eventPins(y, z));
  return L;
}
function cityLayers(m, y, z) {
  const data = CITIES.map(c => ({ ...c, v: m.cityValue(c, y) }));
  const sc = state.city, halo = [...C('halo'), 240], phone = isPhone();
  const shown = data.filter(d => d.v != null);
  const labelled = shown.filter(d => d.name === sc || (!phone && BIG.has(d.name)));
  const common = { coordinateSystem: CART, parameters: { depthTest: false }, fontFamily: UI_FONT, characterSet: 'auto', fontSettings: { sdf: true, fontSize: 64, buffer: 10 }, outlineWidth: 5, outlineColor: halo };
  return [
    new ScatterplotLayer({ id: 'cities', data, coordinateSystem: CART, pickable: true, getPosition: d => [...d.xy, z + 2], radiusUnits: 'pixels',
      getRadius: d => d.name === sc ? 10 : 7.5, stroked: true, filled: true, lineWidthUnits: 'pixels', getLineWidth: d => d.name === sc ? 3 : 1.6,
      getFillColor: d => d.v == null ? [0, 0, 0, 0] : [...m.color(d.v), 255], getLineColor: d => d.name === sc ? C('select') : d.v == null ? [...C('ink-3'), 160] : [...C('halo'), 255],
      parameters: { depthTest: false }, updateTriggers: { getFillColor: [state.m, y], getRadius: [sc], getLineColor: [sc, state.m, y], getLineWidth: [sc] } }),
    new TextLayer({ id: 'city-lab', data: labelled, ...common, getPosition: d => [...d.xy, z + 2], getText: d => `${d.name.replace('-Gatineau', '')}  ${m.fmt(d.v)}`,
      getSize: d => d.name === sc ? 14 : 12, fontWeight: 600, getColor: d => d.name === sc ? C('accent-ink') : C('ink-1'), getTextAnchor: d => LEFT.has(d.name) ? 'end' : 'start', getAlignmentBaseline: 'center', getPixelOffset: d => [LEFT.has(d.name) ? -11 : 11, 0],
      updateTriggers: { getText: [state.m, y], getColor: [sc], getSize: [sc] } }),
  ];
}
function labels(pts, pos, val, m, sel, abbrOnly = false) {
  const phone = isPhone(), halo = [...C('halo'), 240];
  const at = d => CALLOUT[d.k] ? [...CALLOUT[d.k], PLATE + 2] : pos(d);
  const showVal = d => !abbrOnly && (!phone || d.k === sel);
  const valText = d => { const v = val[d.k]; if (m.kind === 'party') return v ? `${partyShort(v[0])} ${v[1]}` : ''; return v == null ? '—' : m.fmt(v); };
  const common = { coordinateSystem: CART, parameters: { depthTest: false }, getPosition: at, fontFamily: UI_FONT, characterSet: 'auto',
    fontSettings: { sdf: true, fontSize: 64, buffer: 10 }, outlineWidth: 5, outlineColor: halo, transitions: { getPosition: 500 } };
  const off = (d, y) => CALLOUT[d.k] ? [0, y + 10] : [0, y - (m.kind === 'spike' ? 10 : 0)];
  return [
    new LineLayer({ id: 'leaders', data: pts.filter(d => CALLOUT[d.k]), coordinateSystem: CART, parameters: { depthTest: false },
      getSourcePosition: pos, getTargetPosition: d => [...CALLOUT[d.k], PLATE + 2], getColor: [...C('ink-3'), 200], getWidth: 1, widthUnits: 'pixels',
      updateTriggers: { getSourcePosition: [state.m, state.y] } }),
    new TextLayer({ id: 'abbr', data: pts, ...common, getText: d => d.k === 'NT+NU' ? 'NT + NU' : d.k,
      getSize: d => d.k === sel ? 13 : phone ? 10.5 : 11.5, fontWeight: 600, getColor: d => d.k === sel ? C('select') : [...C(abbrOnly ? 'ink-3' : 'ink-2'), 255],
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
const menuHTML = () => [...new Set(MEASURES.map(m => m.group))].map(g => `<div class="g"><div class="grp">${g}</div>${MEASURES.filter(m => m.group === g)
  .map(m => `<button class="opt" data-m="${m.id}">${m.label}<i class="sw" style="${swatch(m)}"></i></button>`).join('')}</div>`).join('');
const GROUPS = [...new Set(MEASURES.map(m => m.group))];
function drawNav() { const cur = M[state.m].group;
  document.getElementById('layers').innerHTML = `<div class="tabs">${GROUPS.map(g => `<button class="tab ${g === cur ? 'on' : ''}" data-g="${g}">${g}</button>`).join('')}</div>
    <div class="plates">${MEASURES.filter(m => m.group === cur).map(m => `<button class="opt ${m.id === state.m ? 'on' : ''}" data-m="${m.id}">${m.label}</button>`).join('')}</div>`; }
document.getElementById('layers').addEventListener('click', e => { const t = e.target.closest('.tab'); if (!t) return; const m = MEASURES.find(x => x.group === t.dataset.g);
  state.m = m.id; state.y = clampYear(m, state.y); update(); });
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
      <div class="note">${d.sides || 'Shrank on the left, grew on the right'}; middle swatch = ${d.deadLabel}. Each side has its own scale.${d.nodata ? ` <span class="nd"></span> no data` : ''}</div>`; };
  if (L.kind === 'div') return arms(L);
  if (L.kind === 'mag') return `<div class="cap">${L.points ? '<span class="dot"></span>' : ''}${L.cap}</div><div class="bar">${Array.from({ length: 24 }, (_, i) => `<span style="background:${cssc(ramp(SEQ, (i + 0.5) / 24))}"></span>`).join('')}</div><div class="ticks">${L.ticks.map(([p, t]) => `<span style="left:${p * 100}%">${t}</span>`).join('')}</div>${L.points ? '<div class="note">Each circle is a census metropolitan area, placed at its core city. Hollow = not surveyed that year.</div>' : ''}${L.nodata ? '<div class="note"><span class="nd"></span> no data in this table</div>' : ''}`;
  if (L.kind === 'spike') return `<div class="spike"><i></i><i></i><i></i><div><b style="font-weight:500;color:var(--ink-1)">Spike height = number of people</b><div class="note" style="margin-top:2px">70 km of height per million people. Spikes stand inside each province, not at its population centre.</div></div></div>` + (L.div ? `<div style="margin-top:12px">${arms(L.div)}</div>` : '');
  if (L.kind === 'flow') return `<div>Arc width = people moving, July–June.</div><div class="note">${state.p ? `<span class="sw"><b style="background:${cssc(DEC[2])}"></b>leaving ${state.p}</span><span class="sw"><b style="background:${cssc(SEQ[4])}"></b>arriving in ${state.p}</span>` : 'Bright end = destination. Showing the 40 largest flows.'}</div>`;
  if (L.kind === 'party') { const e = electionAt(state.y); const ps = e ? Object.keys(e.seats_total) : [];
    return `<div>${ps.slice(0, 6).map(p => `<span class="sw"><b style="background:${cssc(partyCol(p))}"></b>${partyShort(p)} ${e.seats_total[p]}</span>`).join('')}</div><div class="note">Seats won, not votes. Party colours appear only on this layer.</div>`; }
  return '';
}
function finding(m, g, y) {
  if ((g === 'NT' || g === 'NU') && !m.split(y)) g = 'NT+NU';
  const name = NAMES[g], v = m.kind === 'party' ? null : m.value(g, y), p = isPrelim(m, y) ? '<sup class="pm" title="Preliminary">p</sup>' : '';
  const b0 = g === 'NT' || g === 'NU' ? 1991 : 1971;
  const rank = (w = 'highest') => { if (g === 'CAN') return ''; const r = geosFor(m.split(y)).map(k => [k, m.value(k, y)]).filter(d => d[1] != null).sort((a, b) => b[1] - a[1]);
    const i = r.findIndex(d => d[0] === g) + 1; return i ? `, the ${i === 1 ? w : ord(i) + ' ' + w} of ${r.length} ${r.length === 10 ? 'provinces' : 'provinces and territories'}` : ''; };
  if (m.id === 'pop' && v != null) { const d = v - popAt(g, b0);
    return `<em>${fmtInt(v)}</em>${p} people lived in ${name} on July 1, ${y}${y > b0 ? `, ${d >= 0 ? 'up' : 'down'} ${big3(Math.abs(d))} since ${b0}` : ''}.`; }
  if (m.id === 'chg' && v != null) return `${name}${g === 'CAN' ? '’s' : '’s'} population ${v >= 0 ? 'grew' : 'shrank'} <em>${pct(Math.abs(v)).replace('+', '')}</em>${p} between July ${b0} and July ${y}${rank('fastest')}.`;
  if (m.kind === 'party') { const e = electionAt(y), sts = e && (g === 'CAN' ? e.seats_total : e.seats_by_province[g === 'NT+NU' ? 'NT' : g]); const top = sts && Object.entries(sts)[0];
    return top ? `In the election of ${fmtDate(e.date)}, the <em>${partyShort(top[0])}</em> party won the most seats in ${name}: ${top[1]} of ${Object.values(sts).reduce((a, b) => a + b, 0)}.` : `No seats recorded for ${name}.`; }
  if (m.kind === 'points') { const c = CITIES.find(x => x.name === state.city), cv = c && m.cityValue(c, y);
    if (c) return cv == null ? `No published value for ${c.name} in ${y}.` : `${c.name}: <em>${m.fmt(cv)}</em> ${m.unit}, ${whenOf(m, y)}.`;
    if (m.id === 'vac' && v != null) return `Across Canada's metropolitan areas, <em>${m.fmt(v)}</em> of purpose-built rental apartments were vacant in October ${y}.`;
    return `Published for cities, not for Canada as a whole. Choose a city on the map.`; }
  if (g === 'CAN' && (m.id === 'ipm' || m.id === 'flow')) return 'Moves between provinces cancel out for Canada as a whole. Choose a province.';
  return v == null ? `No data for ${name} in ${y}.` : `${name}: <em>${m.fmt(v)}</em>${p} ${m.unit}, ${whenOf(m, y)}${rank()}.`;
}
function reading(m) {
  document.getElementById('r-group').textContent = m.group;
  document.getElementById('r-title').textContent = m.label;
  document.getElementById('r-q').textContent = m.q;
  const chips = [];
  if (isPrelim(m, state.y)) chips.push(`<button class="chip prelim" data-why="prelim"><i></i>Preliminary</button>`);
  if (!m.split(state.y) && m.kind !== 'points') chips.push(`<button class="chip" data-why="ntnu">N.W.T. and Nunavut combined</button>`);
  if (m.cover) chips.push(`<button class="chip cover" data-why="cover">${m.cover}</button>`);
  if (m.id === 'fed' && electionAt(state.y)?.date === '2025-04-28') chips.push(`<button class="chip" data-why="seats">341 of 343 seats recorded</button>`);
  chips.push(`<button class="chip src" data-why="src">${m.tag === 'Derived' ? 'Derived · ' : ''}${m.src.map(s => registry[s].table_id ? 'StatCan ' + registry[s].table_id : registry[s].publisher.split(',')[0]).join(' + ')}</button>`);
  document.getElementById('r-meta').innerHTML = `<span>${whenOf(m, state.y)}</span>` + chips.join('');
  // editorial layer: big year, one computed finding sentence, numbered notes (survey plate)
  document.getElementById('yearhero').textContent = state.y;
  document.getElementById('finding').innerHTML = finding(m, state.p || 'CAN', state.y);
  const notes = [];
  if (isPrelim(m, state.y)) notes.push(['prelim', 'Preliminary. Statistics Canada will revise these estimates.']);
  if (!m.split(state.y)) notes.push(['ntnu', 'Northwest Territories and Nunavut reported as one region before July 1991.']);
  if (m.id === 'fed' && electionAt(state.y)?.date === '2025-04-28') notes.push(['seats', 'ParlInfo records 341 of 343 seats for 2025.']);
  notes.push(['src', `${m.tag}. ${m.src.map(s => registry[s].table_id ? 'Statistics Canada Table ' + registry[s].table_id : registry[s].publisher).join('; ')}. Source and method →`]);
  document.getElementById('notes').innerHTML = notes.map(([k, t]) => `<li><button data-why="${k}">${t}</button></li>`).join('');
  document.getElementById('folio-r').textContent = `${m.group} · ${m.label} · ${state.y}`;
  document.getElementById('plate-cap').innerHTML = `<b>${m.label}</b>, ${whenOf(m, state.y)}${isPrelim(m, state.y) ? '<sup>1</sup>' : ''} · Lambert conformal conic projection · generalized boundaries`;
  document.getElementById('legend').innerHTML = legendHTML(m);
  document.getElementById('layer-btn').textContent = 'Layers';
}
document.getElementById('notes').addEventListener('click', e => { const w = e.target.closest('[data-why]')?.dataset.why; if (w) openSource(M[state.m], w); });
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
  return `<table>${['pop', 'chg', 'rate', 'dens', 'share', 'nat', 'imm', 'npr', 'emi', 'ipm', 'starts', 'hhg', 'rentrel', 'inc'].map(id => { const m = M[id]; let gg = g;
    if ((gg === 'NT' || gg === 'NU') && !m.split(y)) gg = 'NT+NU';
    const v = y >= m.years[0] && y <= m.years[1] ? m.value(gg, y) : null;
    return `<tr class="click ${id === state.m ? 'cur' : ''}" data-m="${id}"><td>${m.label}</td><td>${v == null ? '—' : m.fmt(v)}${isPrelim(m, y) && v != null ? ' <span style="color:var(--ink-3)">p</span>' : ''}</td></tr>`; }).join('')}</table>
    <div class="fine">Choose a row to map it. p = preliminary. — = not available.</div>`;
}
// ---- small multi-series chart: colour plus a distinct dash and an end label for each line (never colour alone)
function multiChart(series, { y0, y1, cur, unit = '', zero = false, h = 150, bars, brk } = {}) {
  const W = 330, H = h, l = 4, r = 8, t = 14, b = 22;
  const vals = series.flatMap(s => Object.values(s.d)).concat(bars ? Object.values(bars.d) : []).filter(v => v != null);
  if (!vals.length) return '';
  let lo = Math.min(...vals), hi = Math.max(...vals); if (zero) lo = Math.min(0, lo);
  const X = y => l + (y - y0) / (y1 - y0) * (W - l - r), Y = v => t + (1 - (v - lo) / (hi - lo || 1)) * (H - t - b);
  const bw = Math.max(2, (W - l - r) / (y1 - y0 + 1) * 0.6);
  const barSvg = bars ? Object.entries(bars.d).filter(([, v]) => v != null).map(([yy, v]) => `<rect x="${X(+yy) - bw / 2}" y="${Math.min(Y(v), Y(0))}" width="${bw}" height="${Math.abs(Y(v) - Y(0))}" fill="${bars.c}" opacity=".55"/>`).join('') : '';
  const lines = series.map(s => { const pts = Object.entries(s.d).filter(([yy, v]) => v != null && +yy >= y0 && +yy <= y1).sort((a, b) => a[0] - b[0]);
    if (!pts.length) return ''; const path = pts.map(([yy, v], i) => `${i ? 'L' : 'M'}${X(+yy).toFixed(1)},${Y(v).toFixed(1)}`).join(''); const [ly, lv] = pts.at(-1);
    return `<path d="${path}" fill="none" stroke="${s.c}" stroke-width="2" stroke-dasharray="${s.dash || ''}" stroke-linejoin="round"/><circle cx="${X(+ly)}" cy="${Y(lv)}" r="2.6" fill="${s.c}"/>
      `; }).join('');
  const key = [...(bars ? [`<span><i class="kb" style="background:${bars.c}"></i>${bars.label}</span>`] : []), ...series.map(s => `<span><i class="kl${s.dash ? ' dash' : ''}" style="border-color:${s.c}"></i>${s.label}${s.endNote ? ` <em>${s.endNote}</em>` : ''}</span>`)].join('');
  return `<div class="ckey">${key}</div><svg class="chart" viewBox="0 0 ${W} ${H}" style="height:${H}px">
    ${lo < 0 ? `<line x1="${l}" x2="${W - r}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--ink-3)" stroke-dasharray="2 3"/>` : ''}
    <line x1="${l}" x2="${W - r}" y1="${H - b}" y2="${H - b}" stroke="var(--hairline)"/>
    <text x="${l}" y="10" font-size="11" fill="var(--ink-3)">${unit} · top of scale ${hi >= 1000 ? sig3(hi) : Math.round(hi)}</text>
    <text x="${l}" y="${H - 6}" font-size="11" fill="var(--ink-3)">${y0}</text><text x="${W - r}" y="${H - 6}" text-anchor="end" font-size="11" fill="var(--ink-3)">${y1}</text>
    ${brk ? `<line x1="${X(brk[0])}" x2="${X(brk[0])}" y1="${t}" y2="${H - b}" stroke="var(--ink-3)" stroke-dasharray="3 3"/><text x="${X(brk[0]) - 4}" y="${t + 8}" text-anchor="end" font-size="10.5" fill="var(--ink-3)">${brk[1]}</text>` : ''}
    ${barSvg}${lines}${cur >= y0 && cur <= y1 ? `<line x1="${X(cur)}" x2="${X(cur)}" y1="${t}" y2="${H - b}" stroke="var(--accent)" stroke-opacity=".6"/>` : ''}</svg>`;
}
const seq = (y0, y1, f) => { const o = {}; for (let y = y0; y <= y1; y++) o[y] = f(y); return o; };
function housingPath(g, y) {
  if (g === 'NT+NU') return '';
  const isProv = g === 'CAN' || PROV10.includes(g);
  const hhAdd = seq(2007, 2025, yy => hh(g, yy) != null && hh(g, yy - 1) != null ? hh(g, yy) - hh(g, yy - 1) : null);
  const a = multiChart([
      ...(isProv ? [{ label: 'Starts', c: 'var(--seq-4)', d: seq(2007, 2025, yy => hc(g, 'starts_total', yy)) },
        { label: 'Completions', endNote: '(ends 2022)', c: 'var(--ink-1)', dash: '4 3', d: seq(2007, 2022, yy => hc(g, 'completions_total', yy)) }] : [])],
    { y0: 2007, y1: 2025, cur: y, unit: 'per year', zero: true, bars: { c: 'var(--ink-3)', label: 'Households added', d: hhAdd } });
  const rel = seq(1979, 2025, yy => { const r0 = cpi(g, 'rent', 1979), a0 = cpi(g, 'all', 1979); return r0 && a0 && cpi(g, 'rent', yy) ? 100 * (cpi(g, 'rent', yy) / r0) / (cpi(g, 'all', yy) / a0) : null; });
  const ri = seq(1979, 2024, yy => inc(g, 1979) && inc(g, yy) ? 100 * inc(g, yy) / inc(g, 1979) : null);
  const b = isProv ? multiChart([{ label: 'Rent vs prices', c: 'var(--seq-4)', d: rel }, { label: 'Real income', c: 'var(--ink-1)', dash: '4 3', d: ri }], { y0: 1979, y1: 2025, cur: y, unit: 'index, 1979 = 100', brk: [2019, 'CPI rent method change'] }) : '';
  return `<details class="path" ${M[state.m].group === 'Housing and cost of living' ? 'open' : ''}><summary>Housing path<span class="hint">people → homes → rents → income</span></summary><div class="in">
    <p class="step"><b>1 · Households and homes.</b> Bars: private households added each year (July to July). Lines: homes started and completed (calendar years).</p>${a}
    ${isProv ? '' : '<p class="fine">Starts and completions are not published for the territories in this table.</p>'}
    <p class="fine">Observed side by side, not a measure of shortage: completions are not net additions (demolitions aren't subtracted), households exclude collective dwellings, and the periods differ by six months.</p>
    ${b ? `<p class="step"><b>2 · Rents and incomes.</b> The rent price index relative to all prices, and median after-tax income adjusted for inflation, both set to 100 in 1979.</p>${b}
    <p class="fine">Different universes: the CPI rent index covers all tenants, including renewals, and changed method in 2019 (dashed line); income covers all family units, owners and renters. Not an affordability ratio. For market rents, see the city layers.</p>` : ''}
    <p class="step"><b>3 · Cities.</b> <button class="linkish" data-m="vac">Vacancy</button> and <button class="linkish" data-m="rent">two-bedroom rents</button> are published for census metropolitan areas only.</p>
  </div></details>`;
}
function cityPanel(m, y) {
  const c = CITIES.find(x => x.name === state.city); if (!c) return null;
  const v = m.cityValue(c, y), st = c.rent2br_status?.[y];
  const vs = Object.fromEntries(Object.entries(c.vacancy).map(([k, v]) => [+k, v])), rs = Object.fromEntries(Object.entries(c.rent2br).map(([k, v]) => [+k, v]));
  return `<div class="peek"><div><button class="back" data-act="nocity">← All cities</button><h2 class="place">${c.name}</h2></div>${isPhone() ? `<div class="peekv">${v == null ? '—' : m.fmt(v)}</div>` : ''}</div>
    <div class="when">${m.label} · ${whenOf(m, y)} · census metropolitan area</div>
    <div class="hero"><div class="v">${v == null ? '—' : m.fmt(v)}</div></div>
    <div class="hero-sub">${v == null ? (st === 'F' ? 'Too unreliable to publish for this year (CMHC quality flag F).' : 'Not surveyed or not available for this year.') : m.unit}</div>
    <p class="step"><b>Vacancy rate</b>, apartments of 6+ units, October</p>${multiChart([{ label: 'Vacancy %', c: 'var(--seq-4)', d: vs }], { y0: 1971, y1: 2025, cur: y, unit: '%', zero: true, h: 120 })}
    <p class="step"><b>Average rent, two-bedroom</b>, current dollars</p>${multiChart([{ label: 'Rent $', c: 'var(--ink-1)', d: rs }], { y0: 1987, y1: 2025, cur: y, unit: '$ per month', h: 120 })}
    <p class="fine">Point placed at ${c.place} (Natural Earth); the survey covers the whole metropolitan area. Rents are not adjusted for inflation.</p>
    <button class="srcrow" data-why="src"><span>Source &amp; method</span><small>CMHC Rental Market Survey via StatCan 34-10-0127, 34-10-0133 →</small></button>`;
}
function renderPanel() {
  const m = M[state.m], y = state.y;
  if (m.kind === 'points' && state.city) { const html = cityPanel(m, y); if (html) { body.innerHTML = html; return; } }
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
    <div class="hero" ${big === '—' && m.kind === 'points' ? 'hidden' : ''}><div class="v">${big}</div>${pre ? '<button class="chip prelim" data-why="prelim"><i></i>Preliminary</button>' : ''}</div>
    <div class="hero-sub">${sub}</div>
    ${fromto}
    ${m.kind === 'party' || m.kind === 'points' || (g === 'CAN' && ['ipm', 'flow', 'share'].includes(m.id)) ? '' : chartSVG(g, m)}
    ${m.kind === 'points' ? `<p class="fine" style="margin-top:14px">${m.id === 'vac' ? 'Canada figure: CMHC average across census metropolitan areas.' : 'No national or provincial average is published in this table.'} Choose a city on the map.</p>` : ''}
    <button class="srcrow" data-why="src"><span>Source &amp; method</span><small>${src} · ${m.tag} →</small></button>
    ${evs.length ? `<details ${isPhone() || m.group === 'Housing and cost of living' ? '' : 'open'}><summary>In ${y}<span class="hint">${evs[0].title}</span></summary><div class="in">${evs.map(x => `<div class="ev"><span class="tag"><i class="m-${x.k}"></i>${{ elec: 'Election result', hist: 'Historical fact', note: 'Data note' }[x.k]}</span><b>${x.title}</b>${fmtDate(x.date)} · ${x.where}.
      <div class="fine">${x.source_url ? `<a href="${x.source_url}" target="_blank" rel="noopener">${x.source}</a>` : x.source}</div></div>`).join('')}</div></details>` : ''}
    ${housingPath(g, y)}
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
  else if (t.dataset.act === 'nocity') { state.city = null; update(); }
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
  cover: ['Coverage', ''],
};
const COVER = {
  starts: 'CMHC table 34-10-0126 covers Canada and the ten provinces only. The territories are shown dimmed as “no data”, not as zero. Completions in this table end in 2022; starts continue to 2025.',
  vac: `CMHC publishes vacancy for census metropolitan areas, not provinces. ${CITIES.length} areas are mapped at their core city; ${HCITY.unplaced.map(x => x.split(',')[0]).join(', ')} are not in the place file used for positions and are listed but not drawn. Each area enters the series in a different year.`,
  rent: `CMHC average rents are published for centres of 10,000+, not provinces. Two-bedroom units in row and apartment structures of 3+ units, current dollars. Values flagged “too unreliable to publish” (F) are left blank. ${CITIES.length} metropolitan areas are drawn.`,
  rentrel: 'Statistics Canada replaced its rent method in January 2019 (matched units → a hedonic model on Labour Force Survey rents), so this layer starts from 2019. The rent index covers all tenants (new leases, renewals and mid-lease), so it rises more slowly than asking rents for vacant units. Provinces only: the territories have city indexes (Whitehorse, Yellowknife, Iqaluit).',
  inc: 'Median after-tax income is published for the provinces from 1976 and for the territories only from 2018. Earlier territorial years are shown as no data.',
};
function openSource(m, why = 'src') {
  const w = why === 'cover' ? ['Coverage', COVER[m.id] || ''] : WHY[why];
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
  drawNav(); document.querySelectorAll('.opt').forEach(b => b.classList.toggle('on', b.dataset.m === state.m));
  theDeck.setProps({ layers: layers() });
  reading(m); renderPanel(); timelineCtx(state.y); writeHash(); placeCtl();
}
drawEras();
setSheet(Q.get('sheet') ? +Q.get('sheet') : 0);
view = { ...view, ...fitView() }; theDeck.setProps({ viewState: view });
update();
window.CTX = { state, update, M, setSheet };
window.READY = true;
