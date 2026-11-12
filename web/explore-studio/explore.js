/* Canada Through Time — Explorer, review build: Deep Vintage palette (?p=beach|tuscan to compare) with the housing chapter.
 * Not the published version (that is web/explore). Same data contracts, registry and evidence rules.
 * State lives in the URL hash (#chg-2026-ab) so any view can be shared.
 */
const { Deck, OrbitView, GeoJsonLayer, ColumnLayer, TextLayer, ArcLayer, PathLayer, ScatterplotLayer, LineLayer, LightingEffect, AmbientLight, DirectionalLight, COORDINATE_SYSTEM } = deck;
const CART = COORDINATE_SYSTEM.CARTESIAN;
const Q = new URLSearchParams(location.search);
const STUDIO = Q.get('studio');   // Timelapse Studio: a base64 JSON configuration turns the explorer into a frame-exact stage
if (STUDIO) document.body.classList.add('studio');
const V = 's';                                 // composition: Night Lanterns
// Palettes: the visitor picks one (map-control button); the choice is kept in the link (?p=) and remembered on this device.
const RELEASE = 2;   // the first two are the proposed public themes; the rest stay in review builds for comparison
const PALETTES = [['ember', 'Field Paper · Ember', 'light'], ['aurora', 'Aurora Night', 'dark'],
  ['field', 'Field Paper (original)', 'light'], ['lichen', 'Lichen', 'light'], ['heather', 'Heather', 'light'], ['dusk', 'Tuscan Dusk', 'dark'], ['glacier', 'Glacier', 'dark'], ['vintage', 'Deep Vintage', 'dark']];
const PALS = PALETTES.map(p => p[0]).concat('paper');
let savedPal = null; try { savedPal = localStorage.getItem('ctt-palette'); } catch (e) { /* storage unavailable */ }
const PAL = PALS.includes(Q.get('p')) ? Q.get('p') : PALS.includes(savedPal) ? savedPal : 'ember';
const LIGHT = ['ember', 'field', 'lichen', 'heather', 'paper'].includes(PAL);
const TRUE_COL = !['vintage', 'paper', 'glacier'].includes(PAL);   // neutral light so map fills match legend colours
const PAL_SW = {"ember": ["#EFEADB", "#E3D594", "#978B37", "#3A370D", "#9687C4", "#B8472F"], "lichen": ["#ECEFEA", "#B3E0D2", "#3A948D", "#003840", "#C28562", "#B8472F"], "heather": ["#F1ECE6", "#E7CEE4", "#A372A6", "#44234C", "#8BA669", "#B8472F"], "aurora": ["#0B1720", "#184258", "#62B995", "#FEF2C5", "#B07750", "#D99B68"], "field": ["#EFEADB", "#F4EDBF", "#AEA048", "#423F15", "#A295CB", "#8A2B0E"], "dusk": ["#1A1619", "#4C2A49", "#C5857F", "#FFEACA", "#63908A", "#E35336"], "glacier": ["#0E1520", "#1F4A70", "#58A8D0", "#E4F5FB", "#B07B2A", "#F2B84B"], "vintage": ["#10222A", "#4A2E28", "#C25A41", "#FBE9D0", "#6F9796", "#E64833"]};   // page, low, mid, high, "less", accent
let savedTx = null; try { savedTx = localStorage.getItem('ctt-surface'); } catch (e) { /* storage unavailable */ }
const SURFACES = [['none', 'Plain'], ['paper', 'Paper grain'], ['relief', 'Shaded relief']];
const TX = SURFACES.some(x => x[0] === Q.get('tx')) ? Q.get('tx') : SURFACES.some(x => x[0] === savedTx) ? savedTx : 'relief';
document.body.classList.add('tx-' + TX);
const TY = ['news', 'civic', 'grotesk'].includes(Q.get('t')) ? Q.get('t') : 'civic';   // T2: Source Serif 4 + Public Sans
document.body.classList.add('v-s', 'pal-' + PAL, 'ty-' + TY);

// ---------------------------------------------------------------- tokens
const css = getComputedStyle(document.body);
const tok = n => css.getPropertyValue('--' + n).trim();
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const C = n => rgb(tok(n));
const cssc = (c, a) => a == null ? `rgb(${c.join(',')})` : `rgba(${c.join(',')},${a})`;
const lerpC = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const UI_FONT = getComputedStyle(document.body).getPropertyValue('--font-ui').split(',')[0].replace(/"/g, '').trim() || 'IBM Plex Sans';   // map labels use the interface face

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
const topSeats = s => { if (!s) return null; const e = Object.entries(s).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])); if (!e.length) return null;
  const tied = e.filter(x => x[1] === e[0][1]); return tied.length > 1 ? ['TIE', e[0][1], tied.map(x => x[0])] : e[0]; };   // a tie for most seats is never shown as a win
const partyShort = p => (PARTY[p] || [p])[0];
const CODE = { Liberal: 'LPC', Conservative: 'CPC', 'Progressive Conservative': 'PC', NDP: 'NDP', 'Bloc Québécois': 'BQ', Reform: 'Ref.', 'Canadian Alliance': 'CA', 'Social Credit': 'SC', Green: 'GPC', Independent: 'Ind.', 'No affiliation': 'n/a' };
const partyCode = p => CODE[partyShort(p)] || partyShort(p);   // map labels only; the legend spells each code out
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
const J = u => window.__DATA?.[u] ? Promise.resolve(JSON.parse(JSON.stringify(window.__DATA[u])))   // single-file review bundle
  : fetch(u.replace(/^\.\.\//, BASE + '/')).then(r => { if (!r.ok) throw new Error(u); return r.json(); });
const toKm = fc => { const c = x => typeof x[0] === 'number' ? [x[0] / 1e3, x[1] / 1e3] : x.map(c);
  fc.features.forEach(f => { f.geometry.coordinates = c(f.geometry.coordinates); if (f.properties.lx != null) { f.properties.lx /= 1e3; f.properties.ly /= 1e3; } }); return fc; };
const INC_GRADES = (await J('../data/release/income_grades.json')).data;   // StatCan quality grades below B for the income series
const [pop, comp, flows, area, politics, evData, provinces, ntnu, countries, lakes, registry] = await Promise.all([
  J('../data/population.json'), J('../data/explorer/components.json'), J('../data/explorer/flows.json'), J('../data/explorer/area.json'),
  J('../data/release/politics.json'), J('../data/explorer/events.json'),
  J('../data/provinces.geojson').then(toKm), J('../data/ntnu_combined.geojson').then(toKm), J('../data/context_countries.geojson').then(toKm), J('../data/lakes.geojson').then(toKm),
  J('../data/explorer/registry.json')]);
const [HC, HH, HCPI, HINC, HCITY, HCHN] = await Promise.all(['construction', 'households', 'cpi', 'income', 'cities', 'core_need'].map(n => J(`../data/housing/${n}.json`)));
await Promise.all([`600 16px "${UI_FONT}"`, `400 16px "${UI_FONT}"`, `500 16px "${UI_FONT}"`].map(f => document.fonts.load(f)));

const S = pop.series, D = pop.dates;
const PRELIM = { pop: (() => { const n = (pop.notes || []).find(x => /preliminary postcensal from/i.test(x)); const m = n && n.match(/preliminary postcensal from ([A-Z][a-z]+) (\d+), (\d{4})/i);
  return m ? `${m[3]}-${String(MONTHS.indexOf(m[1]) + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}` : null; })(), compPeriodStart: 2025 };
// Postcensal estimates (after the last census base, before the preliminary ones) are final for now but will be revised
// once the next census is processed. The start year is read from the source table's own note.
const POSTCENSAL_FROM = (() => { const n = (pop.notes || []).find(x => /final postcensal/i.test(x)); const m = n && n.match(/final postcensal [A-Z][a-z]+ \d+, (\d{4})/i); return m ? +m[1] : null; })();
const isPostcensal = (m, y) => ['pop', 'chg', 'rate', 'dens', 'share'].includes(m.id) && POSTCENSAL_FROM != null && y >= POSTCENSAL_FROM && !isPrelim(m, y);
const GRADE = { C: 'good', D: 'acceptable', E: 'use with caution' };
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
// Election entries on the timeline are rebuilt from the (reconciled) seat data so every count on screen agrees.
for (const ev of events) { if (ev.kind !== 'election') continue; const e = politics.elections.find(x => x.date === ev.date); if (!e) continue;
  const t = Object.entries(e.seats_total), house = e.seats_recorded;
  ev.title = `Federal election: ${t[0][0]} wins ${t[0][1]} of ${house} seats`;
  ev.body = t.map(([p, n]) => `${p}: ${n}`).join(' · ') + (e.reconciled ? ` (${e.reconciled.additions.length} of ${house} seats added from Elections Canada; see the seat note)` : '');
  if (e.reconciled) ev.source = 'Library of Parliament, ParlInfo — Elections and Elected Candidates; two members reconciled with Elections Canada, Official Voting Results'; }
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
const per1000 = (g, y, f) => { const c = compAt(g, y), p = popAt(g, y - 1) ?? popAt(g, y); const x = c && p ? f(c) : null; return x == null ? null : x / p * 1000; };
const base71 = g => popAt(g, g === 'NT' || g === 'NU' ? 1991 : 1971);
const MEASURES = [
  { id: 'pop', group: 'Population', label: 'People', q: 'How many people live in each province and territory.', kind: 'spike', src: ['statcan_17100009'], tag: 'Official statistic',
    years: [1971, YMAX], split: y => y >= 1991, value: (g, y) => popAt(g, y), fmt: v => sig3(v), unit: 'people', legend: { kind: 'spike' },
    when: y => `July 1, ${y}` },
  { id: 'chg', group: 'Population', label: 'Change since 1971', q: 'How much each population has grown or shrunk since July 1971.', kind: 'fill', src: ['statcan_17100009'], tag: 'Derived',
    years: [1972, YMAX], split: y => y >= 1991, value: (g, y) => { const b = base71(g), v = popAt(g, y); return b && v ? v / b - 1 : null; },
    fmt: v => pct(v), unit: 'change in population', color: v => diverging(v, 0.15, 2, 0.02), rng: [-0.15, 2],
    legend: { kind: 'div', neg: 0.15, pos: 2, dead: 0.02, decl: [[-0.15, '−15%'], [-0.05, '−5%']], grow: [[0.5, '+50%'], [1, '+100%'], [2, '+200%']], deadLabel: 'within ±2%', deadTick: '±2%' },
    when: y => `July 1971 → July 1, ${y}` },
  { id: 'rate', group: 'Population', label: 'Growth in the past year', q: 'How fast each population changed over the twelve months to July 1.', kind: 'fill', src: ['statcan_17100009'], tag: 'Derived',
    years: [1972, YMAX], split: y => y >= 1992, value: (g, y) => { const a = popAt(g, y - 1), b = popAt(g, y); return a && b ? b / a - 1 : null; },
    fmt: v => pct(v, 1), unit: 'change over one year', color: v => diverging(v, 0.02, 0.04, 0.001), rng: [-0.02, 0.04],
    legend: { kind: 'div', neg: 0.02, pos: 0.04, dead: 0.001, decl: [[-0.02, '−2%'], [-0.01, '−1%']], grow: [[0.01, '+1%'], [0.02, '+2%'], [0.04, '+4%']], deadLabel: 'within ±0.1%', deadTick: '±0.1%' },
    when: y => `July 1, ${y - 1} → July 1, ${y}` },
  { id: 'dens', group: 'Population', label: 'People per km²', q: 'How many people there are for each square kilometre of land (log scale).', kind: 'fill', src: ['statcan_17100009', 'statcan_98100001'], tag: 'Derived',
    years: [1971, YMAX], split: y => y >= 1991, value: (g, y) => { const a = g === 'NT+NU' ? area.data.NT + area.data.NU : area.data[g]; const p = popAt(g, y); return a && p ? p / a : null; },
    fmt: v => v < 1 ? v.toFixed(2) : v.toFixed(1), unit: 'people per km²', color: v => magnitude(v, 0.02, 40, true), rng: [0.02, 40],
    legend: { kind: 'mag', ticks: [[0, '0.02'], [0.36, '0.3'], [0.68, '3'], [1, '40']], cap: 'People per km² · log scale · 2021 land area' }, when: y => `July 1, ${y}` },
  { id: 'share', group: 'Population', label: 'Share of Canadians', q: 'What share of everyone in Canada lives in each province and territory.', kind: 'spike', src: ['statcan_17100009'], tag: 'Derived',
    years: [1971, YMAX], split: y => y >= 1991, value: (g, y) => { const p = popAt(g, y), c = popAt('CAN', y); return p && c ? p / c : null; }, height: (g, y) => popAt(g, y),
    fmt: v => (v * 100).toFixed(v < 0.01 ? 2 : 1) + '%', unit: 'of Canada’s population',
    colorBy: (g, y) => { const b0 = g === 'NT' || g === 'NU' ? 1991 : 1971; return (popAt(g, y) / popAt('CAN', y)) / (popAt(g, b0) / popAt('CAN', b0)) - 1; },
    color: v => diverging(v, 0.4, 0.6, 0.02), rng: [-0.4, 0.6], legend: { kind: 'spike', div: { neg: 0.4, pos: 0.6, dead: 0.02, decl: [[-0.4, '−40%'], [-0.2, '−20%']], grow: [[0.3, '+30%'], [0.6, '+60%']], deadLabel: 'within ±2%', deadTick: '±2%', cap: 'Colour: change in share since 1971' } },
    when: y => `July 1, ${y}` },
  { id: 'nat', group: 'Where growth came from', label: 'Natural increase', q: 'Births minus deaths over the year, for every 1,000 residents.', kind: 'fill', src: ['statcan_17100008'], tag: 'Derived',
    years: [1972, YMAX], split: y => y >= 1992, value: (g, y) => per1000(g, y, c => c.births - c.deaths), fmt: v => signed(v), unit: 'per 1,000 people',
    color: v => diverging(v, 5, 25, 0.5), rng: [-5, 25], legend: { kind: 'div', neg: 5, pos: 25, dead: 0.5, decl: [[-5, '−5'], [-2.5, '−2.5']], grow: [[10, '+10'], [25, '+25']], deadLabel: 'within ±0.5', deadTick: '±0.5' }, comp: true },
  { id: 'imm', group: 'Where growth came from', label: 'Immigrants', q: 'New permanent residents who settled here, for every 1,000 residents.', kind: 'fill', src: ['statcan_17100008'], tag: 'Derived',
    years: [1972, YMAX], split: y => y >= 1992, value: (g, y) => per1000(g, y, c => c.immigrants), fmt: v => v.toFixed(1), unit: 'per 1,000 people',
    color: v => magnitude(v, 0, 16, false), rng: [0, 16], legend: { kind: 'mag', ticks: [[0, '0'], [0.25, '4'], [0.5, '8'], [0.75, '12'], [1, '16+']], cap: 'Immigrants per 1,000 people' }, comp: true },
  { id: 'npr', group: 'Where growth came from', label: 'Temporary residents (net)', q: 'Net change in permit holders and asylum claimants, for every 1,000 residents.', kind: 'fill', src: ['statcan_17100008'], tag: 'Derived',
    years: [1972, YMAX], split: y => y >= 1992, value: (g, y) => per1000(g, y, c => c.net_npr ?? null), fmt: v => signed(v), unit: 'per 1,000 people',
    color: v => diverging(v, 10, 25, 0.5), rng: [-10, 25], legend: { kind: 'div', neg: 10, pos: 25, dead: 0.5, decl: [[-10, '−10'], [-5, '−5']], grow: [[10, '+10'], [25, '+25']], deadLabel: 'within ±0.5', deadTick: '±0.5' }, comp: true },
  { id: 'emi', group: 'Where growth came from', label: 'Emigration (net)', q: 'People leaving Canada, net of those returning, for every 1,000 residents.', kind: 'fill', src: ['statcan_17100008'], tag: 'Derived',
    years: [1972, YMAX], split: y => y >= 1992, value: (g, y) => per1000(g, y, c => c.net_emigration), fmt: v => v.toFixed(1), unit: 'per 1,000 people',
    color: v => magnitude(v, 0, 4, false), rng: [0, 4], legend: { kind: 'mag', ticks: [[0, '0'], [0.25, '1'], [0.5, '2'], [0.75, '3'], [1, '4+']], cap: 'Net emigrants per 1,000 people' }, comp: true },
  { id: 'ipm', group: 'Where growth came from', label: 'Moves between provinces', q: 'Net arrivals from the rest of Canada, for every 1,000 residents.', kind: 'fill', src: ['statcan_17100008'], tag: 'Derived',
    years: [1972, YMAX], split: y => y >= 1992, value: (g, y) => per1000(g, y, c => c.net_interprovincial ?? null), fmt: v => signed(v), unit: 'per 1,000 people',
    color: v => diverging(v, 25, 25, 0.5), rng: [-25, 25], legend: { kind: 'div', neg: 25, pos: 25, dead: 0.5, decl: [[-20, '−20'], [-10, '−10']], grow: [[10, '+10'], [20, '+20']], deadLabel: 'within ±0.5', deadTick: '±0.5' }, comp: true },
  { id: 'flow', group: 'Where growth came from', label: 'Migration flows', q: 'Where people moved between provinces. Choose a province to see all of its flows.', kind: 'arcs', src: ['statcan_17100045', 'statcan_17100008'], tag: 'Official statistic',
    years: [1972, Math.max(...flows.complete_periods) + 1], split: y => y >= 1992, value: (g, y) => per1000(g, y, c => c.net_interprovincial ?? null), fmt: v => signed(v), unit: 'net arrivals per 1,000 people',
    legend: { kind: 'flow' } },
  { id: 'fed', group: 'Politics', label: 'Federal election seats', q: 'Which party won the most House of Commons seats in each province.', kind: 'party', src: ['parlinfo_elected'], tag: 'Official statistic',
    years: [1972, YMAX], split: y => y >= 1997, value: (g, y) => { const e = electionAt(y); const s = e?.seats_by_province[g === 'NT+NU' ? 'NT' : g]; return topSeats(s); },
    fmt: v => v ? (v[0] === 'TIE' ? `Tied: ${v[2].map(partyShort).join(' and ')}, ${v[1]} each` : `${partyShort(v[0])} ${v[1]}`) : '—', unit: 'seats', legend: { kind: 'party' },
    when: y => { const e = electionAt(y); return e ? `Election of ${fmtDate(e.date)}` : 'No election yet in range'; } },
];
// ---------------------------------------------------------------- housing and cost of living
const hc = (g, key, y) => HC.data[g]?.[key]?.[y] ?? null;
const hh = (g, y) => HH.data[g]?.[y] ?? null;
const cpi = (g, p, y) => HCPI.data[g]?.[p]?.[y] ?? null;
const inc = (g, y) => HINC.data[g]?.[y] ?? null;
const PROV10 = ['NL', 'PE', 'NS', 'NB', 'QC', 'ON', 'MB', 'SK', 'AB', 'BC'];
const CITIES = HCITY.cities, MAPPED = CITIES.filter(c => c.xy);
const BIG = new Set(['Toronto', 'Montréal', 'Vancouver', 'Calgary', 'Edmonton', 'Ottawa-Gatineau', 'Winnipeg', 'Québec', 'Halifax', 'Saskatoon', 'Regina', "St. John's"]);
const LEFT = new Set(['Ottawa-Gatineau', 'Toronto', "St. John's"]);   // label to the left of the point to avoid neighbours
MEASURES.push(
  { id: 'starts', group: 'Housing and cost of living', label: 'Housing starts', q: 'New homes started each year, for every 1,000 residents. Provinces only: this CMHC table has no territorial data.', kind: 'fill', src: ['statcan_34100126', 'statcan_17100009'], tag: 'Derived',
    years: [1972, 2025], split: y => y >= 1991, value: (g, y) => { const s = hc(g, 'starts_total', y), p = popAt(g, y); return s != null && p ? s / p * 1000 : null; },
    fmt: v => v.toFixed(1), unit: 'starts per 1,000 residents', color: v => magnitude(v, 2, 16, false), rng: [2, 16], cover: 'Territories not in this table',
    legend: { kind: 'mag', ticks: [[0, '2'], [0.286, '6'], [0.571, '10'], [1, '16+']], cap: 'Housing starts per 1,000 residents (calendar year)', nodata: true }, when: y => `Calendar year ${y}`, prelim: () => false },
  { id: 'comp', group: 'Housing and cost of living', label: 'Housing completions', q: 'New homes finished each year, for every 1,000 residents. This table stops in 2022; it is not extended. Provinces only.', kind: 'fill', src: ['statcan_34100126', 'statcan_17100009'], tag: 'Derived',
    years: [1972, 2022], split: y => y >= 1991, value: (g, y) => { const s = hc(g, 'completions_total', y), p = popAt(g, y); return s != null && p ? s / p * 1000 : null; },
    fmt: v => v.toFixed(1), unit: 'completions per 1,000 residents', color: v => magnitude(v, 2, 16, false), rng: [2, 16], cover: 'Ends 2022 · no territories',
    legend: { kind: 'mag', ticks: [[0, '2'], [0.286, '6'], [0.571, '10'], [1, '16+']], cap: 'Housing completions per 1,000 residents (calendar year)', nodata: true }, when: y => `Calendar year ${y}`, prelim: () => false },
  { id: 'hhg', group: 'Housing and cost of living', label: 'Household growth', q: 'Change in the number of private households since July 2006, when this series begins.', kind: 'fill', src: ['statcan_17100159'], tag: 'Derived',
    years: [2007, 2025], split: () => true, value: (g, y) => { const a = hh(g, 2006), b = hh(g, y); return a && b ? b / a - 1 : null; },
    fmt: v => pct(v), unit: 'change in private households', color: v => diverging(v, 0.1, 0.6, 0.01), rng: [-0.1, 0.6],
    legend: { kind: 'div', neg: 0.1, pos: 0.6, dead: 0.01, decl: [[-0.1, '−10%'], [-0.05, '−5%']], grow: [[0.2, '+20%'], [0.4, '+40%'], [0.6, '+60%']], deadLabel: 'within ±1%', deadTick: '±1%', sides: 'Fewer households on the left, more on the right' },
    when: y => `July 1, 2006 → July 1, ${y}`, prelim: y => y >= HH.prelim_from },
  { id: 'vac', group: 'Housing and cost of living', label: 'Rental vacancy', q: 'Share of purpose-built rental apartments sitting empty each October. Low means a tight market. Cities only.', kind: 'points', src: ['statcan_34100127'], tag: 'Official statistic',
    years: [1972, 2025], split: y => y >= 1991, cityValue: (c, y) => c.vacancy[y] ?? null, value: (g, y) => g === 'CAN' ? HCITY.cma_average_vacancy[y] ?? null : null,
    fmt: v => v.toFixed(1) + '%', unit: 'of rental apartments vacant', color: v => magnitude(v, 0, 8, false), rng: [0, 8], cover: `${MAPPED.length} of ${CITIES.length} cities mapped`,
    legend: { kind: 'mag', ticks: [[0, '0%'], [0.25, '2%'], [0.5, '4%'], [0.75, '6%'], [1, '8%+']], cap: 'Vacancy rate, apartments of 6+ units, October', points: true }, when: y => `October ${y}`, prelim: () => false },
  { id: 'rent', group: 'Housing and cost of living', label: 'Average rent, 2-bedroom', q: 'Average monthly rent for a two-bedroom in purpose-built rental buildings, in current dollars. Cities only.', kind: 'points', src: ['statcan_34100133'], tag: 'Official statistic',
    years: [1987, 2025], split: y => y >= 1991, cityValue: (c, y) => c.rent2br[y] ?? null, value: () => null,
    fmt: v => '$' + fmtInt(v), unit: 'per month (current dollars)', color: v => magnitude(v, 400, 2400, false), rng: [400, 2400], cover: 'Current dollars · cities only',
    legend: { kind: 'mag', ticks: [[0, '$400'], [0.3, '$1,000'], [0.6, '$1,600'], [1, '$2,400+']], cap: 'Average rent, two-bedroom, current dollars, October', points: true }, when: y => `October ${y}`, prelim: () => false },
  { id: 'rentrel', group: 'Housing and cost of living', label: 'Rent prices vs all prices', q: 'How much the CPI rent index rose compared with all consumer prices since 2019, when Statistics Canada adopted its current rent method. Zero means rent kept pace.', kind: 'fill', src: ['statcan_18100005'], tag: 'Derived',
    years: [2020, 2025], split: y => y >= 1991, value: (g, y) => { if (y < 2019) return null; const r0 = cpi(g, 'rent', 2019), r = cpi(g, 'rent', y), a0 = cpi(g, 'all', 2019), a = cpi(g, 'all', y); return r0 && r && a0 && a ? (r / r0) / (a / a0) - 1 : null; },
    fmt: v => pct(v, 1), unit: 'rent index relative to all-items CPI', color: v => diverging(v, 0.15, 0.15, 0.01), rng: [-0.15, 0.15], cover: 'Since 2019 method change · provinces only',
    legend: { kind: 'div', neg: 0.15, pos: 0.15, dead: 0.01, decl: [[-0.15, '−15%'], [-0.075, '−7.5%']], grow: [[0.075, '+7.5%'], [0.15, '+15%']], deadLabel: 'rent kept pace (±1%)', deadTick: '±1%', nodata: true, sides: 'Rent rose less than other prices on the left, more on the right' },
    when: y => `2019 → ${y}, annual averages`, prelim: () => false },
  { id: 'chn', group: 'Housing and cost of living', label: 'Core housing need (census)', q: 'Share of people living in a household whose home is unaffordable, overcrowded or needs major repairs, and who could not afford an acceptable local alternative. Census years 2016 and 2021 only.', kind: 'fill', src: ['statcan_39100048'], tag: 'Official statistic',
    years: [2016, 2021], only: [2016, 2021], split: () => true, value: (g, y) => HCHN.data[g]?.[y]?.pct ?? null,
    fmt: v => v.toFixed(1) + '%', unit: 'of people examined', color: v => magnitude(v, 3, 15, false), rng: [3, 15], cover: 'Census years only · 2021 income includes pandemic supports',
    legend: { kind: 'mag', ticks: [[0, '3%'], [0.333, '7%'], [0.667, '11%'], [1, '15%+']], cap: 'Persons in core housing need, % of those examined (census)', nodata: true }, when: y => `${y} Census (income year ${y - 1})`, prelim: () => false },
  { id: 'inc', group: 'Housing and cost of living', label: 'Median after-tax income', q: 'Median after-tax income of all family units, adjusted for inflation to 2024 dollars. Owners and renters together.', kind: 'fill', src: ['statcan_11100190'], tag: 'Official statistic',
    years: [1976, 2024], split: y => y >= 1991, value: (g, y) => inc(g, y), fmt: v => '$' + fmtInt(v), unit: '2024 dollars', color: v => magnitude(v, 40000, 90000, false), rng: [40000, 90000],
    cover: 'Territories from 2018 only', legend: { kind: 'mag', ticks: [[0, '$40K'], [0.4, '$60K'], [0.8, '$80K'], [1, '$90K+']], cap: 'Median after-tax income, 2024 dollars', nodata: true }, when: y => `Calendar year ${y}`, prelim: () => false },
);
const DIFF = { pop: 'level', dens: 'level', inc: 'level', rent: 'level', starts: 'abs', comp: 'abs', nat: 'abs', imm: 'abs', npr: 'abs', emi: 'abs', ipm: 'abs', flow: 'abs',
  chg: 'pp', rate: 'pp', share: 'pp', hhg: 'pp', rentrel: 'pp', vac: 'pp', chn: 'pp', fed: 'none' };
const BREAKS = { inc: [[1993, 'survey change 1993'], [2012, 'survey change 2012']] };
MEASURES.forEach(m => { m.diff = DIFF[m.id]; m.breaks = BREAKS[m.id] || []; });
const M = Object.fromEntries(MEASURES.map(m => [m.id, m]));
// Values beyond the colour scale. The colour stops at the end of the scale, so those places are marked on the map
// (▲ above, ▼ below) and the legend lists their exact values. Nothing is clipped or changed in the data.
const over = (m, v) => !m.rng || v == null || typeof v !== 'number' ? 0 : v > m.rng[1] ? 1 : v < m.rng[0] ? -1 : 0;
const OV = { 1: ' ▲', [-1]: ' ▼', 0: '' };
function overList(m, y) { if (!m.rng || m.colorBy) return [];
  const rows = m.kind === 'points' ? CITIES.map(c => [c.name, m.cityValue(c, y)]) : m.kind === 'fill' ? geosFor(m.split(y)).map(g => [NAMES[g], m.value(g, y)]) : [];
  return rows.filter(r => over(m, r[1])).sort((a, b) => b[1] - a[1]); }
function overNote(m, y) { const L = overList(m, y), hi = L.filter(r => over(m, r[1]) > 0), lo = L.filter(r => over(m, r[1]) < 0).reverse();
  const line = (rows, sym, word, lim) => rows.length ? `<div class="note keep ovn"><b>${sym} ${word} the colour scale</b> (colour stops at ${m.fmt(lim)}; values are exact): ${rows.slice(0, 4).map(r => `${r[0]} ${m.fmt(r[1])}`).join(' · ')}${rows.length > 4 ? ` · and ${rows.length - 4} more, marked ${sym} on the map and in the list` : ''}</div>` : '';
  return { html: line(hi, '▲', 'Above', m.rng?.[1]) + line(lo, '▼', 'Below', m.rng?.[0]), hi: hi.length > 0, lo: lo.length > 0 }; }
const compWhen = y => `July 1, ${y - 1} → June 30, ${y}`;
const whenOf = (m, y) => m.comp || m.kind === 'arcs' ? compWhen(y) : m.when(y);

// ---------------------------------------------------------------- state
const state = { m: 'pop', y: YMAX, p: null, cmp: null, cmpY: null, city: Q.get('city') || null, cmpCity: Q.get('vs') || null, hoverCity: null, q: null, playing: false, speed: 0.8 };
const enc = g => g === 'NT+NU' ? 'ntnu' : g.toLowerCase(), dec = t => t === 'ntnu' ? 'NT+NU' : (t || '').toUpperCase();
function applyHash() { const [h0, then] = location.hash.slice(1).split('@'); state.cmpY = +then || null; const [main, vs] = h0.split('-vs-'); const [m, y, p] = main.split('-'); if (M[m]) state.m = m; if (+y >= YMIN && +y <= YMAX) state.y = +y;
  state.p = NAMES[dec(p)] && dec(p) !== 'CAN' ? dec(p) : null; state.cmp = vs && NAMES[dec(vs)] ? dec(vs) : null; }
applyHash();
const writeHash = () => { const t = `#${state.m}-${state.y}${state.p ? '-' + enc(state.p) : ''}${state.p && state.cmp ? '-vs-' + enc(state.cmp) : ''}${state.cmpY ? '@' + state.cmpY : ''}`; if (location.hash !== t) history.replaceState(null, '', t); };
addEventListener('hashchange', () => { applyHash(); update(); });
const clampYear = (m, y) => { y = Math.max(m.years[0], Math.min(m.years[1], y)); return m.only ? m.only.reduce((b, o) => Math.abs(o - y) < Math.abs(b - y) ? o : b) : y; };
const isPhone = () => innerWidth <= 1100;   // phones and tablets share the bottom-sheet layout

// ---------------------------------------------------------------- deck
const PEEK = 168;
const mapEl = document.getElementById('map');
function fitView() {
  const w = mapEl.clientWidth || innerWidth, h = mapEl.clientHeight || innerHeight, phone = isPhone();
  // region of the map container the country should fill, per composition
  let r;
  const rb = phone ? (document.getElementById('reading')?.getBoundingClientRect().bottom || 290) + 6 : 0;
  if (V === 's') r = phone ? [0, w, Math.min(rb, h * 0.55), h - Math.min(window.__sheetH || PEEK, h * 0.5)] : STUDIO ? [430, w - 44, 64, h - 118] : [420, w - 410, 230, h - 120];
  else r = phone ? [6, w - 6, 10, h - 20] : [10, w - 300, 20, h - 10];
  const [x0, x1, y0, y1] = [r[0], Math.max(r[1], r[0] + 240), r[2], Math.max(r[3], r[2] + 200)];
  // phones open close to top-down (rotationX 90 = straight down here): at 390 px wide a tilted map loses half its height
  // People and flow layers are 3D marks, so phones tilt further for them (columns must be seen from the side to compare heights).
  const standing = ['spike', 'arcs'].includes(M[state.m]?.kind);
  const tilt = V === 's' ? (phone ? (standing ? 50 : 72) : 54) : (phone ? 24 : 30);
  const zoom = Math.log2(Math.min((x1 - x0) / (V === 's' ? (phone ? 5600 : 5300) : (phone ? 5000 : 5500)), (y1 - y0) / (V === 's' ? (phone ? 3000 : 3300) : 4000)));
  const sc = 2 ** zoom, dx = (x0 + x1) / 2 - w / 2, dy = (y0 + y1) / 2 - h / 2;
  const ty = V === 's' ? 2350 : (phone ? 2800 : 2500);
  const est = { target: [(V === 's' && phone ? 6150 : 6380) - dx / sc, ty + dy / sc * (V === 's' ? 1.6 : 1.15), 0], zoom, rotationX: tilt, rotationOrbit: V === 's' && !phone ? -6 : 0 };
  const key = [w, h, x0, x1, y0, y1, tilt].map(Math.round).join(',');
  if (!FIT[key]) FIT[key] = measureFit(est, w, h, [x0, x1, y0, y1], phone);
  const f = FIT[key];
  return { ...f, minZoom: f.zoom - 0.32, maxZoom: f.zoom + 4 };
}
// Measured fit: project Canada's real outline through the camera and solve zoom + centre so the whole country
// (including Newfoundland and the Arctic islands) fills the free region. Cached per screen size and region.
const FIT = {}, FIT_PTS = OUT_COMB.flatMap(d => d.path.filter((_, i) => i % 6 === 0));
// screen point → ground plane (z = 0): intersect the camera ray, since OrbitViewport.unproject ignores targetZ
function ground(vp, x, y) { const p = vp.unproject([x, y, 0.1]), q = vp.unproject([x, y, 0.9]); const t = p[2] / (p[2] - q[2]); return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; }
function measureFit(v, w, h, [x0, x1, y0, y1], topAlign) {
  const ov = new deck.OrbitView({ orbitAxis: 'Z', fovy: V === 's' ? 38 : 22 });
  v = { ...v, target: [...v.target] };
  for (let it = 0; it < 24; it++) {
    let vp; try { vp = ov.makeViewport({ width: w, height: h, viewState: v }); } catch (e) { return v; }
    let bx0 = 1e9, bx1 = -1e9, by0 = 1e9, by1 = -1e9;
    for (const q of FIT_PTS) { const [px, py] = vp.project([q[0], q[1], 0]); bx0 = Math.min(bx0, px); bx1 = Math.max(bx1, px); by0 = Math.min(by0, py); by1 = Math.max(by1, py); }
    const k = Math.min((x1 - x0) / (bx1 - bx0), (y1 - y0) / (by1 - by0)) * 0.97, bh = (by1 - by0) * k;
    const cy = (y0 + y1) / 2;
    const a = ground(vp, (bx0 + bx1) / 2, (by0 + by1) / 2), b = ground(vp, (x0 + x1) / 2, cy);
    v.target = [v.target[0] + (a[0] - b[0]) * 0.8, v.target[1] + (a[1] - b[1]) * 0.8, 0];
    v.zoom += Math.log2(k) * 0.8;
    if (Math.abs(Math.log2(k)) < 0.004 && Math.hypot(a[0] - b[0], a[1] - b[1]) < 3) break;
  }
  return v;
}
// Zoom and pan bounds: the country can never shrink below ~80% of its fitted size, and its centre stays near the frame.
const ZOOM_OUT = 0.32, ZOOM_IN = 4, PAN_KM = [2600, 1800];
function boundView(v) {
  const f = fitView(), zoom = Math.max(f.zoom - ZOOM_OUT, Math.min(f.zoom + ZOOM_IN, v.zoom));
  const slack = 2 ** (zoom - f.zoom);   // allow more panning when zoomed in
  const tx = Math.max(f.target[0] - PAN_KM[0] * slack, Math.min(f.target[0] + PAN_KM[0] * slack, v.target[0]));
  const ty = Math.max(f.target[1] - PAN_KM[1] * slack, Math.min(f.target[1] + PAN_KM[1] * slack, v.target[1]));
  return { ...v, zoom, target: [tx, ty, v.target[2] || 0], minZoom: f.zoom - ZOOM_OUT, maxZoom: f.zoom + ZOOM_IN, rotationX: Math.max(0, Math.min(70, v.rotationX)) };
}
let view = fitView(), userMoved = false, lastLabelView = null, relabel = null;
const theDeck = new Deck({
  parent: mapEl, views: new OrbitView({ orbitAxis: 'Z', fovy: V === 's' ? 38 : 22 }),
  controller: { dragMode: 'pan', inertia: true, scrollZoom: { smooth: true, speed: 0.02 } },
  onAfterRender: () => { if (!STUDIO && view !== lastLabelView) { lastLabelView = view; clearTimeout(relabel); relabel = setTimeout(() => theDeck.setProps({ layers: layers() }), 120); } },
  viewState: view, onViewStateChange: ({ viewState, interactionState }) => { if (interactionState?.isDragging || interactionState?.isZooming || interactionState?.isPanning) userMoved = true; view = interactionState?.inTransition ? viewState : boundView(viewState); if (!interactionState?.inTransition) theDeck.setProps({ viewState: view }); },
  effects: [new LightingEffect(V === 's'
    ? (TRUE_COL ? { a: new AmbientLight({ color: [255, 255, 255], intensity: 1.0 }), k: new DirectionalLight({ color: [255, 255, 255], intensity: 0.6, direction: [4, -7, -5] }) }
       : { a: new AmbientLight({ color: [225, 225, 245], intensity: 0.62 }), k: new DirectionalLight({ color: [255, 230, 196], intensity: 1.35, direction: [4, -7, -5] }) })
    : { a: new AmbientLight({ color: [255, 255, 255], intensity: 1.0 }), k: new DirectionalLight({ color: [255, 255, 255], intensity: 0.25, direction: [-3, -6, -7] }) })],
  parameters: { clearColor: [0, 0, 0, 0] },
  getCursor: ({ isHovering, isDragging }) => isDragging ? 'grabbing' : isHovering ? 'pointer' : 'grab',
  onHover: info => tooltip(info), onClick: info => click(info),
});

const tt = document.getElementById('tooltip');
function tooltip(info) {
  const o = info.object;
  if (!o?.geo && state.hoverCity) { state.hoverCity = null; theDeck.setProps({ layers: layers() }); }
  if (!o || isPhone()) { tt.style.display = 'none'; return; }
  let html = '';
  if (o.geo && o.xy && state.hoverCity !== o.name && !isPhone()) { state.hoverCity = o.name; theDeck.setProps({ layers: layers() }); }
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
// Shaded relief: physical-geography context only (Natural Earth SR 1:50m, public domain). It never encodes the statistic,
// sits under labels, marks and boundaries, and is fainter on layers where the land itself is coloured by data.
const RELIEF = { src: window.__DATA?.['../data/relief/relief_canada_3km.png'] || `${BASE}/data/relief/relief_canada_3km.png`, b: [3660, 630, 9040, 5270] };
if (TX === 'relief') { const im = new Image(); im.onload = () => { RELIEF.img = im; try { theDeck.setProps({ layers: layers() }); } catch (e) { /* deck not ready; first update() will include it */ } }; im.src = RELIEF.src; }
function reliefLayer(m, z) { const [l, b, r, t] = RELIEF.b, zz = z + 0.2, dataFill = m.kind === 'fill' || m.kind === 'party' || !!m.colorBy;
  return new deck.BitmapLayer({ id: 'relief', image: RELIEF.img, coordinateSystem: CART, bounds: [[l, b, zz], [l, t, zz], [r, t, zz], [r, b, zz]],
    opacity: (m.kind === 'spike' || m.kind === 'arcs' ? 0.36 : dataFill ? 0.16 : 0.5) * (LIGHT ? 1 : 0.8), parameters: { depthTest: false }, pickable: false }); }
// "No published value" is stippled on the map exactly as in the legend swatch, so it can't be mistaken for a low value.
// Grid points every 70 km inside each province/territory, computed once (even-odd point-in-polygon).
const STIPPLE = {};
function stippleFor(f) {
  const k = f.properties.abbr; if (STIPPLE[k]) return STIPPLE[k];
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates, out = [];
  const inside = (x, y, poly) => { let c = false; for (const r of poly) for (let a = 0, b = r.length - 1; a < r.length; b = a++) { const [xa, ya] = r[a], [xb, yb] = r[b];
    if ((ya > y) !== (yb > y) && x < (xb - xa) * (y - ya) / (yb - ya) + xa) c = !c; } return c; };
  for (const poly of polys) { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [x, y] of poly[0]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    for (let y = Math.ceil(y0 / 70) * 70, row = 0; y <= y1; y += 70, row++) for (let x = Math.ceil(x0 / 70) * 70 + (row % 2) * 35; x <= x1; x += 70) if (inside(x, y, poly)) out.push([x, y]); }
  return (STIPPLE[k] = out);
}
function hatchLayer(fs, split, z) {
  return new ScatterplotLayer({ id: 'nodata-stipple', data: fs.flatMap(stippleFor), coordinateSystem: CART, getPosition: q => [q[0], q[1], z + 0.4], radiusUnits: 'pixels', getRadius: 1.1,
    getFillColor: [...C('ink-3'), 150], parameters: { depthTest: false }, updateTriggers: { getFillColor: [state.m] } });
}
const liftZ = (fc, z) => ({ ...fc, features: fc.features.map(f => ({ ...f, geometry: { ...f.geometry, coordinates: (function c(x) { return typeof x[0] === 'number' ? [x[0], x[1], z] : x.map(c); })(f.geometry.coordinates) } })) });
const lakeLayer = new GeoJsonLayer({ id: 'lakes', data: liftZ(lakes, PLATE + 0.5), coordinateSystem: CART, filled: true, stroked: true, getFillColor: C('ocean'), getLineColor: [...C('coast'), 90],
  lineWidthUnits: 'pixels', getLineWidth: 0.6, parameters: { depthTest: false } });

function layers() { const L = layers0(); return STUDIO ? L.map(l => l.clone({ transitions: {} })) : L; }   // studio frames are exact: no time-based tweens
function layers0() {
  const m = M[state.m], y = state.y, split = m.split(y);
  const feats = split ? featsSplit : featsCombined, geos = geosFor(split);
  const val = Object.fromEntries(geos.map(g => [g, m.value(g, y)]));
  const sel = state.p && (geos.includes(state.p) ? state.p : (state.p === 'NT' || state.p === 'NU') && !split ? 'NT+NU' : state.p);
  const landC = C('land'), dimC = C('land-dim');
  const fillColor = f => {
    const g = f.properties.abbr, v = val[g];
    if (m.kind === 'fill') return v == null ? dimC : m.color(v);   // no data: the dimmed plate, named in the legend
    if (m.kind === 'party') return v ? (v[0] === 'TIE' ? NEU : lerpC(partyCol(v[0]), C('ocean'), 0.18)) : landC;
    if (m.kind === 'arcs') return state.p && g !== sel ? dimC : landC;
    return landC;
  };
  const z = PLATE;
  const L = [...seaLayers(), neighbour,
    new GeoJsonLayer({ id: 'land', data: feats, coordinateSystem: CART, filled: true, stroked: !PLATE, extruded: !!PLATE, pickable: true,
      getElevation: z, getFillColor: fillColor, getLineColor: C('boundary'), lineWidthUnits: 'pixels', getLineWidth: 1,
      // TRUE_COL: lit top face = ambient 0.91 + diffuse 0.285 × 0.6 × 0.527 ≈ 1.00, so a province matches its legend swatch
      material: TRUE_COL ? { ambient: 0.91, diffuse: 0.285, shininess: 0, specularColor: [0, 0, 0] } : V === 's' ? { ambient: 0.5, diffuse: 0.75, shininess: 12, specularColor: [40, 34, 28] } : { ambient: 1, diffuse: 0.15, shininess: 0, specularColor: [0, 0, 0] },
      updateTriggers: { getFillColor: [state.m, y, state.p] }, transitions: { getFillColor: 450 } }),
    ...(TX === 'relief' && RELIEF.img ? [reliefLayer(m, z)] : []),
    lakeLayer,
    ...(m.kind === 'fill' ? [hatchLayer(feats.filter(f => val[f.properties.abbr] == null), split, z)] : []),
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
    // base ring: marks where the column stands (inside the province, not at a city) without smudging small neighbours
    L.push(new ColumnLayer({ id: 'foot', data: pts, coordinateSystem: CART, diskResolution: 40, radius: 85, extruded: false, getPosition: d => [d.p[0], d.p[1], z + 1.2],
        getFillColor: [...C('spike'), 22], stroked: true, getLineColor: [...C('spike'), 150], lineWidthUnits: 'pixels', getLineWidth: 1, parameters: { depthTest: false } }),
      new ColumnLayer({ id: 'spikes', data: pts, coordinateSystem: CART, diskResolution: 32, radius: R0, extruded: true, pickable: true,
        getPosition: d => [d.p[0], d.p[1], z], getElevation: d => h(d.k), getFillColor: col,
        material: V === 's' ? { ambient: 1.0, diffuse: 0.25, shininess: 80, specularColor: [255, 230, 190] } : { ambient: 0.75, diffuse: 0.4, shininess: 0, specularColor: [0, 0, 0] },
        updateTriggers: { getElevation: [state.m, y], getFillColor: [state.m, y] }, transitions: { getElevation: 500, getFillColor: 400 } }));
    if (V === 's') L.push(new ColumnLayer({ id: 'cap', data: pts, coordinateSystem: CART, diskResolution: 32, radius: R0, extruded: false, getPosition: d => [d.p[0], d.p[1], z + h(d.k) + 0.5],
        getFillColor: [...lerpC(C('spike'), C('land'), 0.4), 255], /* lit top face so the top of each column is easy to find */ parameters: { depthTest: false }, updateTriggers: { getPosition: [state.m, y] }, transitions: { getPosition: 500 } }));
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
  const data = MAPPED.map(c => ({ ...c, v: m.cityValue(c, y) }));
  const sc = state.city, halo = [...C('halo'), 240], phone = isPhone();
  const shown = data.filter(d => d.v != null);
  const vmax = Math.max(1, ...shown.map(d => d.v));   // collision priority must stay within [-1000, 1000]
  const prio = d => d.name === sc ? 1000 : d.name === state.hoverCity ? 950 : (BIG.has(d.name) ? 500 : 0) + Math.round(d.v / vmax * 400);
  // Greedy screen-space label placement: highest priority first. Province abbreviations are obstacles too.
  // Each label tries its preferred side, then the other side; it must stay on screen. A label that fits nowhere is
  // dropped (the city stays in the list, search and tooltip). The selected city always gets a label; if it can only
  // sit on a province abbreviation, that abbreviation is hidden instead.
  let vp = null; try { vp = theDeck.getViewports()[0]; } catch (e) { /* deck not initialised yet */ }
  const placed = [], labelled = [], hit = (a, b) => !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
  const abbrBoxes = vp ? PROV.concat(['NT+NU']).filter(k => anchor[k]).map(k => { const at = CALLOUT[k] ? [...CALLOUT[k], PLATE + 2] : [...anchor[k], z];
    const [x, yy] = vp.project(at), w = (k.length * 8 + 6) / 2; return { k, box: [x - w, yy - 2 - 16, x + w, yy - 2 + 2] }; }) : [];
  state.hideAbbr = new Set();
  const W = phone ? mapEl.clientWidth : Math.min(mapEl.clientWidth, (document.getElementById('sheet')?.getBoundingClientRect().left || mapEl.clientWidth) - 8);
  for (const d of [...(phone ? shown.filter(d => d.name === sc || d.name === state.hoverCity) : shown)].sort((a, b) => prio(b) - prio(a))) {
    if (!vp) { if (d.name === sc) labelled.push(d); continue; }
    const [px, py] = vp.project([...d.xy, z + 2]), w = (d.name.replace('-Gatineau', '').length + m.fmt(d.v).length + 2) * (d.name === sc ? 8.2 : 7.1);
    const boxFor = left => [left ? px - 11 - w : px + 8, py - 9, left ? px - 8 : px + 11 + w, py + 9];
    const pref = LEFT.has(d.name), sides = [pref, !pref].filter(l => { const b = boxFor(l); return b[0] >= 4 && b[2] <= W - 4; });
    if (!sides.length) sides.push(px > W / 2);
    const clear = l => { const b = boxFor(l); return !placed.some(p => hit(b, p)) && !abbrBoxes.some(a => !state.hideAbbr.has(a.k) && hit(b, a.box)); };
    let side = sides.find(clear);
    if (side == null) { if (d.name !== sc) continue; side = sides.find(l => !placed.some(p => hit(boxFor(l), p))) ?? sides[0];
      abbrBoxes.filter(a => hit(boxFor(side), a.box)).forEach(a => state.hideAbbr.add(a.k)); }
    placed.push(boxFor(side)); labelled.push({ ...d, left: side });
  }
  state.cityLabelled = labelled.length;
  const common = { coordinateSystem: CART, parameters: { depthTest: false }, fontFamily: UI_FONT, characterSet: 'auto', fontSettings: { sdf: true, fontSize: 64, buffer: 10 }, outlineWidth: 5, outlineColor: halo };
  return [
    new ScatterplotLayer({ id: 'cities', data, coordinateSystem: CART, pickable: true, getPosition: d => [...d.xy, z + 2], radiusUnits: 'pixels',
      getRadius: d => d.name === sc ? 10 : 7.5, stroked: true, filled: true, lineWidthUnits: 'pixels', getLineWidth: d => d.name === sc ? 3 : 1.6,
      getFillColor: d => d.v == null ? [0, 0, 0, 0] : [...m.color(d.v), 255], getLineColor: d => d.name === sc ? C('select') : d.v == null ? [...C('ink-3'), 220] : [...C('ink-1'), LIGHT ? 235 : 150],
      parameters: { depthTest: false }, updateTriggers: { getFillColor: [state.m, y], getRadius: [sc], getLineColor: [sc, state.m, y], getLineWidth: [sc] } }),
    new TextLayer({ id: 'city-lab', data: labelled, ...common, getPosition: d => [...d.xy, z + 2], getText: d => `${d.name.replace('-Gatineau', '')}  ${m.fmt(d.v)}${OV[over(m, d.v)]}`,
      getSize: d => d.name === sc ? 14 : 12, fontWeight: 600, getColor: d => d.name === sc ? C('select') : C('ink-1'), getTextAnchor: d => d.left ? 'end' : 'start', getAlignmentBaseline: 'center', getPixelOffset: d => [d.left ? -11 : 11, 0],
      updateTriggers: { getText: [state.m, y], getColor: [sc], getSize: [sc], getTextAnchor: [view.zoom, sc], getPixelOffset: [view.zoom, sc] } }),
  ];
}
function labels(pts, pos, val, m, sel, abbrOnly = false) {
  const phone = isPhone(), halo = [...C('halo'), 240], tablet = phone && innerWidth >= 700;
  const at = d => CALLOUT[d.k] ? [...CALLOUT[d.k], PLATE + 2] : pos(d);
  const showVal = d => !abbrOnly && (!phone || tablet || d.k === sel || m.kind === 'spike');   // phones: values on the people layer and the selection; all sizes stagger or drop on collision
  const valText = d => { const v = val[d.k]; if (m.kind === 'party') return v ? (v[0] === 'TIE' ? `Tied ${v[1]}–${v[1]}` : `${partyCode(v[0])} ${v[1]}`) : ''; return v == null ? '—' : m.fmt(v) + OV[over(m, v)]; };
  // Value labels that would touch (narrow provinces, long dollar values) are staggered down or up; if neither fits,
  // the value is dropped and the abbreviation stays (the value remains in the tooltip, panel and ranking).
  let vp = null; try { vp = theDeck.getViewports()[0]; } catch (e) { /* deck not initialised yet */ }
  const dy = {}, hideVal = new Set(), hit = (a, b) => !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
  if (vp && !abbrOnly) { const placed = [];
    for (const d of pts.filter(showVal).sort((a, b) => (b.k === sel) - (a.k === sel) || (a.p[0] - b.p[0]))) { const t = valText(d); if (!t) continue;
      const [x, yy] = vp.project(at(d)), w = t.length * (d.k === sel ? 10 : 8.4) / 2 + 2, base = CALLOUT[d.k] ? 10 : (m.kind === 'spike' ? -10 : 0);
      const box = o => [x - w, yy + base + o - 9, x + w, yy + base + o + 9];
      const o = [0, 17, -17, 34].find(o => !placed.some(q => hit(box(o), q)));
      if (o == null) { if (d.k !== sel) { hideVal.add(d.k); continue; } dy[d.k] = 0; } else dy[d.k] = o;
      placed.push(box(dy[d.k])); } }
  state.valHidden = hideVal.size;
  const common = { coordinateSystem: CART, parameters: { depthTest: false }, getPosition: at, fontFamily: UI_FONT, characterSet: 'auto',
    fontSettings: { sdf: true, fontSize: 64, buffer: 10 }, outlineWidth: 5, outlineColor: halo, transitions: { getPosition: 500 } };
  const off = (d, y) => CALLOUT[d.k] ? [0, y + 10 + (dy[d.k] || 0)] : [0, y - (m.kind === 'spike' ? 10 : 0) + (dy[d.k] || 0)];
  return [
    new LineLayer({ id: 'leaders', data: pts.filter(d => CALLOUT[d.k]), coordinateSystem: CART, parameters: { depthTest: false },
      getSourcePosition: pos, getTargetPosition: d => [...CALLOUT[d.k], PLATE + 2], getColor: [...C('ink-3'), 200], getWidth: 1, widthUnits: 'pixels',
      updateTriggers: { getSourcePosition: [state.m, state.y] } }),
    new TextLayer({ id: 'abbr', data: abbrOnly && state.hideAbbr ? pts.filter(d => !state.hideAbbr.has(d.k)) : pts, ...common, getText: d => (d.k === 'NT+NU' ? 'NT + NU' : d.k) + (!abbrOnly && m.kind === 'fill' && (!showVal(d) || hideVal.has(d.k)) ? OV[over(m, val[d.k])] : ''),
      getSize: d => d.k === sel ? 13 : tablet ? 13 : phone ? 10.5 : 11.5, fontWeight: 600, getColor: d => d.k === sel ? C('select') : [...C(abbrOnly ? 'ink-3' : 'ink-2'), 255],
      getPixelOffset: d => off(d, showVal(d) && !hideVal.has(d.k) ? -16 : -2), updateTriggers: { getPosition: [state.m, state.y], getColor: [sel], getSize: [sel, phone, tablet], getText: [state.m, state.y, hideVal.size, phone], getPixelOffset: [sel, phone, state.m, state.y, JSON.stringify(dy), hideVal.size] } }),
    new TextLayer({ id: 'val', data: pts.filter(d => showVal(d) && !hideVal.has(d.k)), ...common, getText: valText,
      getSize: d => d.k === sel ? 17 : 14.5, fontWeight: 600, getColor: C('ink-1'), getPixelOffset: d => off(d, 0),
      updateTriggers: { getPosition: [state.m, state.y], getText: [state.m, state.y], getSize: [sel], getPixelOffset: [state.m, state.y, JSON.stringify(dy)] } }),
  ];
}
// One status vocabulary everywhere (list, panel, map legend): each state has its own marker and words.
const STAT = {
  ns: '<span class="st st-ns" title="This area was not in the survey that year"><i></i>not surveyed</span>',
  sup: '<span class="st st-sup" title="CMHC flag F: too unreliable to publish. Left blank, never estimated."><i>F</i>suppressed</span>',
  nm: '<span class="st st-nm" title="No position in the place file used for the map; listed and searchable here">not on map</span>',
  nd: '<span class="st st-nd"><i></i>no published value</span>' };
const FLOW_TOP = 12;
function flowStats(y) { const rows = (flows.data[String(y - 1)] || []).slice().sort((a, b) => b[2] - a[2]);
  const tot = rows.reduce((a, r) => a + r[2], 0), top = rows.slice(0, FLOW_TOP), topSum = top.reduce((a, r) => a + r[2], 0);
  return { rows, tot, top, share: tot ? topSum / tot : 0 }; }
function arcs(y, sel, z) {
  const rows = flows.data[String(y - 1)] || [];
  let data = rows.map(([o, d, v]) => ({ o, d, v }));
  data = sel ? data.filter(r => r.o === sel || r.d === sel) : data.sort((a, b) => b.v - a.v).slice(0, FLOW_TOP);
  const max = Math.max(1, ...data.map(r => r.v));
  const dim = lerpC(SEQ[1], C('ocean'), 0.2), bright = SEQ[4], out = DEC[2];
  return new ArcLayer({ id: 'arcs', data, coordinateSystem: CART, pickable: true, greatCircle: false,
    getSourcePosition: r => [...anchor[r.o], z], getTargetPosition: r => [...anchor[r.d], z], getHeight: 0.35, getTilt: 18, numSegments: 64, /* tilt bows A→B and B→A to opposite sides so the two directions never overprint */
    getWidth: r => (1.5 + (sel ? 14 : 11) * Math.sqrt(r.v / max)) * (innerWidth < 700 ? 0.6 : 1), widthUnits: 'pixels',   // same square-root scale on every screen; phones draw it 0.6× so arcs don't cover the map
    getSourceColor: r => [...(sel && r.o === sel ? out : dim), 190], getTargetColor: r => [...(sel && r.o === sel ? out : bright), 235],
    updateTriggers: { getWidth: [y, sel], getSourceColor: [sel], getTargetColor: [sel] } });
}
function eventPins(y, z) {
  const evs = STUDIO ? [] : events.filter(e => +e.date.slice(0, 4) === y && evKind(e) && evKind(e) !== 'elec');   // history pins need a tooltip, so they are left out of video
  return [new ScatterplotLayer({ id: 'pins', data: evs, coordinateSystem: CART, pickable: true, getPosition: e => [...e.xy, z + 3], radiusUnits: 'pixels', getRadius: 6,
    stroked: true, filled: true, getFillColor: C('accent'), getLineColor: [...C('ocean'), 255], lineWidthUnits: 'pixels', getLineWidth: 2.5, parameters: { depthTest: false } })];
}

// ---------------------------------------------------------------- layer menu (rail on desktop, sheet on phone)
const swatch = m => m.kind === 'spike' && !m.colorBy ? `background:${tok('spike')}` : m.kind === 'party' ? 'background:repeating-linear-gradient(90deg,var(--ink-3) 0 4px,transparent 4px 6px)'
  : m.kind === 'arcs' ? `background:linear-gradient(90deg,${cssc(SEQ[1])},${cssc(SEQ[4])})` : m.legend.kind === 'div' || m.legend.div ? `background:linear-gradient(90deg,${cssc(DEC[1])} 0 22%,${cssc(NEU)} 22% 30%,${cssc(SEQ[1])} 30%,${cssc(SEQ[4])})`
  : `background:linear-gradient(90deg,${cssc(SEQ[0])},${cssc(SEQ[4])})`;
const menuHTML = () => [...new Set(MEASURES.map(m => m.group))].map(g => `<div class="g"><div class="grp">${g}</div>${MEASURES.filter(m => m.group === g)
  .map(m => `<button class="opt" data-m="${m.id}">${m.label}<i class="sw" style="${swatch(m)}"></i></button>`).join('')}</div>`).join('');
// Starting questions: each opens real data, explains the measure, flags limits and suggests related layers. No conclusions.
const PATHS = [
  { id: 'grow', q: 'Where has the population grown or declined?', m: 'chg', y: YMAX,
    what: 'Percent change in population since July 1971 (since July 1991 for the Northwest Territories and Nunavut), from Statistics Canada estimates.',
    limits: 'Shows how much each place changed, not why. The latest year is preliminary.', rel: ['pop', 'rate', 'share', 'ipm', 'imm'] },
  { id: 'build', q: 'How do housing starts and household growth move over time?', m: 'starts', y: 2025,
    what: 'Homes started per 1,000 residents, by province. Select a province to see households added each year next to starts and completions.',
    limits: 'Starts are not finished homes; completions stop in 2022; demolitions are not subtracted. Comparing them is not a measure of shortage. No territorial data.', rel: ['hhg', 'comp', 'pop'] },
  { id: 'rent', q: 'How do rents and vacancy differ across measured cities?', m: 'rent', y: 2025,
    what: 'Average two-bedroom rent in purpose-built rental buildings for 33 metropolitan areas (CMHC, October survey). Use the list to find any city; compare two cities in the panel.',
    limits: 'Cities only — not provincial averages. Current dollars, not adjusted for inflation. Existing tenants included, so new leases are often higher.', rel: ['vac', 'rentrel', 'inc'] },
  { id: 'need', q: 'What does core housing need show in the census years?', m: 'chn', y: 2021,
    what: 'Share of people in households whose home is unaffordable, crowded or needs major repairs and who could not afford an acceptable local alternative.',
    limits: 'Two census snapshots (2016, 2021), not a trend. 2021 reflects 2020 incomes, which included temporary pandemic supports.', rel: ['inc', 'rentrel', 'rent'] },
  { id: 'move', q: 'Where did people move between provinces?', m: 'flow', y: 2023,
    what: 'Moves between provinces and territories, July to June. The national view shows the largest flows; choose a province to see every flow in and out.',
    limits: 'Estimates summed from quarters; people who move twice count twice.', rel: ['ipm', 'imm', 'chg'] },
];
const GROUPS = ['Questions', ...new Set(MEASURES.map(m => m.group))];
const TABNAME = g => g === 'Questions' ? 'Start here' : g;
function drawNav() { const cur = state.navQ ? 'Questions' : M[state.m].group;
  if (cur === 'Questions') { document.getElementById('layers').innerHTML = `<div class="tabs">${GROUPS.map(g => `<button class="tab ${g === cur ? 'on' : ''}" data-g="${g}">${g === 'Questions' ? 'Start here' : g}</button>`).join('')}</div>
    <div class="plates"><button class="opt qopt story ${state.story != null ? 'on' : ''}" data-story="0">The story: ${STORY.title}</button>${PATHS.map(p => `<button class="opt qopt ${state.q === p.id ? 'on' : ''}" data-q="${p.id}">${p.q}</button>`).join('')}</div>`; return; }
  document.getElementById('layers').innerHTML = `<div class="tabs">${GROUPS.map(g => `<button class="tab ${g === cur ? 'on' : ''}" data-g="${g}">${TABNAME(g)}</button>`).join('')}</div>
    <div class="plates">${MEASURES.filter(m => m.group === cur).map(m => `<button class="opt ${m.id === state.m ? 'on' : ''}" data-m="${m.id}">${m.label}</button>`).join('')}</div>`; }
document.getElementById('layers').addEventListener('click', e => {
  if (e.target.closest('[data-story]')) { openStory(0); return; }
  const qb = e.target.closest('[data-q]'); if (qb) { openPath(qb.dataset.q); return; }
  const t = e.target.closest('.tab'); if (!t) return;
  if (t.dataset.g === 'Questions') { state.navQ = true; drawNav(); return; }
  state.navQ = false; const m = MEASURES.find(x => x.group === t.dataset.g); state.m = m.id; state.y = clampYear(m, state.y); update(); });
function openPath(id) { const p = PATHS.find(x => x.id === id); state.story = null; state.q = id; state.navQ = false; state.m = p.m; state.y = clampYear(M[p.m], p.y); state.p = null; state.city = null; state.cmp = null;
  document.getElementById('layer-sheet').classList.remove('open'); update(); }
function pathCard() {
  if (state.story != null) return storyCard();
  const p = PATHS.find(x => x.id === state.q);
  if (!p || (state.m !== p.m && !p.rel.includes(state.m))) { state.q = null; return ''; }
  return `<div class="pathcard"><div class="pq"><span>${p.q}</span><button class="x" data-closeq aria-label="Close question">×</button></div><p><b>What this shows.</b> ${p.what}</p><p><b>What it doesn't tell you.</b> ${p.limits}</p>
    <div class="prel">Related: ${p.rel.map(id => `<button class="chip ${id === state.m ? 'on' : ''}" data-m="${id}">${M[id].label}</button>`).join('')}${state.m !== p.m ? `<button class="chip" data-m="${p.m}">← ${M[p.m].label}</button>` : ''}</div></div>`;
}
document.getElementById('layer-sheet').innerHTML = `<div style="font:500 22px var(--font-display);margin:0 0 6px">Start with a question</div>` + PATHS.map(p => `<button class="opt qopt" data-q="${p.id}">${p.q}</button>`).join('') + `<div style="font:500 22px var(--font-display);margin:18px 0 6px">All layers</div>` + menuHTML();
for (const id of ['layers', 'layer-sheet']) document.getElementById(id).addEventListener('click', e => { if (e.target.closest('[data-q]')) { if (id === 'layer-sheet') openPath(e.target.closest('[data-q]').dataset.q); return; } const b = e.target.closest('.opt'); if (!b) return;
  state.m = b.dataset.m; state.y = clampYear(M[state.m], state.y); state.navQ = false; document.getElementById('layer-sheet').classList.remove('open'); update(); });
document.getElementById('layer-btn').onclick = () => document.getElementById('layer-sheet').classList.toggle('open');
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

// ---------------------------------------------------------------- colours and map surface
{ const pp = document.getElementById('palpop');
  pp.innerHTML = `<h3>Colours · proposed themes</h3>${PALETTES.map(([id, name, mode], i) => `${i === RELEASE ? '<h3>Review only · for comparison</h3>' : ''}<button data-pal="${id}" class="${id === PAL ? 'on' : ''}" aria-pressed="${id === PAL}"><span class="sws">${PAL_SW[id].map(c => `<i style="background:${c}"></i>`).join('')}</span><span>${name}</span><small>${mode}</small></button>`).join('')}
    <h3>Map surface</h3><div class="txrow">${SURFACES.map(([id, name]) => `<button data-tx="${id}" class="${id === TX ? 'on' : ''}" aria-pressed="${id === TX}">${name}</button>`).join('')}</div>
    <p class="fine">Shaded relief is generalised physical geography for context (Natural Earth 1:50m, public domain; no detail finer than about 4 km). It does not show the selected statistic and does not move or resize any mark. Party colours on the election layer never change.</p>`;
  pp.addEventListener('click', e => { const b = e.target.closest('[data-pal],[data-tx]'); if (!b) return;
    const u = new URL(location.href), [k, v, store] = b.dataset.pal ? ['p', b.dataset.pal, 'ctt-palette'] : ['tx', b.dataset.tx, 'ctt-surface'];
    try { localStorage.setItem(store, v); } catch (err) { /* storage unavailable */ }
    u.searchParams.set(k, v); u.hash = location.hash; location.href = u.toString(); });
  addEventListener('keydown', e => { if (e.key === 'Escape') pp.hidden = true; });
  addEventListener('pointerdown', e => { if (!pp.hidden && !e.target.closest('#palpop,[data-act=pal]')) pp.hidden = true; }); }
// ---------------------------------------------------------------- map controls
document.getElementById('mapctl').addEventListener('click', e => { const a = e.target.closest('button')?.dataset.act; if (!a) return;
  if (a === 'pal') { const pp = document.getElementById('palpop'); pp.hidden = !pp.hidden; e.target.closest('button').setAttribute('aria-expanded', String(!pp.hidden)); return; }
  const v = { ...view };
  if (a === 'zin') v.zoom += 0.5; if (a === 'zout') v.zoom -= 0.5;
  if (a === 'tilt') v.rotationX = isPhone() ? (Math.abs(v.rotationX - fitView().rotationX) < 3 ? (fitView().rotationX > 60 ? 40 : 70) : fitView().rotationX) : v.rotationX > 10 ? 0 : fitView().rotationX; if (a === 'reset') { Object.assign(v, fitView()); userMoved = false; } else userMoved = true;
  view = { ...boundView(v), transitionDuration: 500, transitionInterpolator: new deck.LinearInterpolator(['target', 'zoom', 'rotationX', 'rotationOrbit']) };
  theDeck.setProps({ viewState: view }); });
addEventListener('resize', () => { view = { ...view, ...fitView() }; theDeck.setProps({ viewState: view }); drawEras(); update(); });
addEventListener('keydown', e => { if ((e.target.tagName === 'INPUT' && e.target.type !== 'range') || e.target.matches?.('[data-cmpyr], select, #palpop *')) return;
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
      <div class="note">${d.sides || 'Shrank on the left, grew on the right'}; middle swatch = ${d.deadLabel}. Each side has its own scale.</div>${d.nodata ? `<div class="note keep stkey">${STAT.nd}</div>` : ''}`; };
  if (L.kind === 'div') return arms(L);
  if (L.kind === 'mag') return `<div class="cap">${L.points ? '<span class="dot"></span>' : ''}${L.cap}</div><div class="bar">${Array.from({ length: 24 }, (_, i) => `<span style="background:${cssc(ramp(SEQ, (i + 0.5) / 24))}"></span>`).join('')}</div><div class="ticks">${L.ticks.map(([p, t]) => `<span style="left:${p * 100}%">${t}</span>`).join('')}</div>${L.points ? `<div class="note keep stkey"><span class="st"><i class="dot"></i>value</span>${STAT.ns}${state.m === 'rent' && CITIES.some(c => c.rent2br_status?.[state.y] === 'F') ? STAT.sup : ''}</div><div class="note">Each circle is a census metropolitan area, placed at its core city.</div>` : ''}${L.nodata ? `<div class="note keep stkey">${STAT.nd}</div>` : ''}`;
  if (L.kind === 'spike') return `<div class="spike"><i></i><i></i><i></i><div><b style="font-weight:500;color:var(--ink-1)">Spike height = number of people</b><div class="note" style="margin-top:2px">70 km of height per million people. Spikes stand inside each province, not at its population centre.</div></div></div>` + (L.div ? `<div style="margin-top:12px">${arms(L.div)}</div>` : '');
  if (L.kind === 'flow') return `<div>Arc width = people moving, July–June.</div><div class="note keep">${state.p ? `<span class="sw"><b style="background:${cssc(DEC[2])}"></b>leaving ${state.p}</span><span class="sw"><b style="background:${cssc(SEQ[4])}"></b>arriving in ${state.p}</span><span style="flex-basis:100%">The two directions between a pair are drawn side by side.</span>` : `${LIGHT ? 'Dark' : 'Bright'} end = destination; the two directions between a pair are drawn side by side. Showing the ${FLOW_TOP} largest of ${flowStats(state.y).rows.length} province-to-province flows (${Math.round(flowStats(state.y).share * 100)}% of all moves). Choose a province for all of its flows.`}</div>`;
  if (L.kind === 'party') { const e = electionAt(state.y); const ps = e ? Object.keys(e.seats_total) : [];
    return `<div>${ps.slice(0, 6).map(p => `<span class="sw"><b style="background:${cssc(partyCol(p))}"></b>${partyShort(p)}${CODE[partyShort(p)] && CODE[partyShort(p)] !== partyShort(p) ? ` <i class="code">${CODE[partyShort(p)]}</i>` : ''} ${e.seats_total[p]}</span>`).join('')}${e && Object.values(e.seats_by_province).some(s => topSeats(s)?.[0] === 'TIE') ? `<span class="sw"><b style="background:${cssc(NEU)}"></b>Tied for most seats</span>` : ''}</div><div class="note">Seats won, not votes. Map labels use the party codes shown here. Party colours appear only on this layer.</div>`; }
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
  if (m.kind === 'party') { const e = electionAt(y), sts = e && (g === 'CAN' ? e.seats_total : e.seats_by_province[g === 'NT+NU' ? 'NT' : g]); const top = topSeats(sts);
    if (top && top[0] === 'TIE') return `In the election of ${fmtDate(e.date)}, <em>${top[2].map(partyShort).join(' and ')}</em> tied for the most seats in ${name}: ${top[1]} each of ${Object.values(sts).reduce((a, b) => a + b, 0)}.`;
    return top ? `In the election of ${fmtDate(e.date)}, the <em>${partyShort(top[0])}</em> party won the most seats in ${name}: ${top[1]} of ${Object.values(sts).reduce((a, b) => a + b, 0)}.` : `No seats recorded for ${name}.`; }
  if (m.kind === 'points') { const c = CITIES.find(x => x.name === state.city), cv = c && m.cityValue(c, y);
    if (c) return cv == null ? `No published value for ${c.name} in ${y}.` : `${c.name}: <em>${m.fmt(cv)}</em> ${m.unit} · ${whenOf(m, y)}.`;
    if (m.id === 'vac' && v != null) return `Across Canada's metropolitan areas, <em>${m.fmt(v)}</em> of purpose-built rental apartments were vacant in October ${y}.`;
    return `Published for cities, not for Canada as a whole. Choose a city on the map.`; }
  if (g === 'CAN' && (m.id === 'ipm' || m.id === 'flow')) return 'Moves between provinces cancel out for Canada as a whole. Choose a province.';
  const when = whenOf(m, y), whenTxt = /^[A-Z][a-z]+ \d/.test(when) || /^\d/.test(when) ? when : when.charAt(0).toLowerCase() + when.slice(1);
  return v == null ? `No published value for ${name}, ${whenTxt} (${whyMissing(m, g, y)}).` : `${name}: <em>${m.fmt(v)}</em>${p} ${m.unit} · ${whenTxt}${rank()}.`;
}
function reading(m) {
  document.getElementById('r-group').textContent = m.group;
  document.getElementById('r-title').textContent = m.label;
  document.getElementById('r-q').textContent = m.q;
  const chips = [];
  if (isPrelim(m, state.y)) chips.push(`<button class="chip prelim" data-why="prelim"><i></i>Preliminary</button>`);
  else if (isPostcensal(m, state.y)) chips.push(`<button class="chip cover" data-why="postc">Postcensal · will be revised</button>`);
  if (!m.split(state.y) && m.kind !== 'points') chips.push(`<button class="chip" data-why="ntnu">N.W.T. and Nunavut combined</button>`);
  if (m.cover) chips.push(`<button class="chip cover" data-why="cover">${m.cover}</button>`);
  { const e = m.id === 'fed' && electionAt(state.y); if (e?.reconciled) chips.push(`<button class="chip" data-why="seats">${e.seats_recorded} seats · ${e.reconciled.additions.length} from Elections Canada</button>`); }
  chips.push(`<button class="chip src" data-why="src">${m.tag === 'Derived' ? 'Derived · ' : ''}${m.src.map(s => registry[s].table_id ? 'StatCan ' + registry[s].table_id : registry[s].publisher.split(',')[0]).join(' + ')}</button>`);
  if (!STUDIO && !isPhone()) chips.push(`<button class="chip studio-open" data-studio-open>Make a timelapse</button>`);
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
  { const on = overNote(m, state.y), lg = document.getElementById('legend'); lg.innerHTML = legendHTML(m) + on.html; lg.classList.toggle('has-hi', on.hi); lg.classList.toggle('has-lo', on.lo); }
  document.getElementById('pathcard').innerHTML = pathCard();
  document.getElementById('layer-btn').textContent = 'Layers';
}
document.getElementById('pathcard').addEventListener('click', e => { const sb = e.target.closest('[data-storygo]'); if (sb) { sb.dataset.storygo === 'x' ? (state.story = null, update()) : openStory(+sb.dataset.storygo); return; }
  if (e.target.closest('[data-closeq]')) { state.q = null; update(); return; }
  const b = e.target.closest('[data-m]'); if (b) { state.m = b.dataset.m; state.y = clampYear(M[state.m], state.y); update(); } });
document.getElementById('notes').addEventListener('click', e => { const w = e.target.closest('[data-why]')?.dataset.why; if (w) openSource(M[state.m], w); });
document.getElementById('r-meta').addEventListener('click', e => { const w = e.target.closest('[data-why]')?.dataset.why; if (w) openSource(M[state.m], w); });

// ---------------------------------------------------------------- place sheet
const body = document.getElementById('sheet-body');
// ---- main time-series chart: exact values on hover, tap or arrow keys; gaps stay gaps; method breaks are marked
const CHARTS = {};
function seriesFor(g, m) {
  const ys = [];
  for (let y = m.years[0]; y <= m.years[1]; y++) { let gg = g; if (!m.split(y) && (g === 'NT' || g === 'NU')) gg = 'NT+NU'; if (m.split(y) && g === 'NT+NU') continue;
    const v = m.kind === 'party' ? null : m.value(gg, y); ys.push([y, v != null && isFinite(v) ? v : null, gg]); }
  return ys;
}
function chartSVG(g, m, g2) {
  const A = seriesFor(g, m), B = g2 ? seriesFor(g2, m) : null;
  const vals = A.concat(B || []).filter(d => d[1] != null);
  if (vals.length < (m.only ? 1 : 2)) return `<p class="fine" style="margin-top:14px">No published values for ${NAMES[g]} on this measure.</p>`;
  const W = 330, H = 176, l = 4, r = 4, t = 24, b = 24;
  const lo = Math.min(0, ...vals.map(d => d[1])), hi = Math.max(...vals.map(d => d[1]));
  // x-axis starts where this place's published series starts (a short territorial series isn't squeezed into the corner)
  const firstYr = Math.min(...vals.map(d => d[0])), d0 = firstYr - m.years[0] > 4 ? firstYr - 1 : m.years[0], d1 = m.years[1];
  const X = y => l + (y - d0) / Math.max(1, d1 - d0) * (W - l - r), Y = v => t + (1 - (v - lo) / (hi - lo || 1)) * (H - t - b);
  const segs = ys => { const out = []; let cur = []; ys.forEach((d, i) => { const brk = i && d[2] !== ys[i - 1][2];   // territory split = new series
      if (d[1] == null || brk) { if (cur.length) out.push(cur); cur = d[1] == null ? [] : [d]; } else cur.push(d); }); if (cur.length) out.push(cur); return out; };
  const pathOf = seg => seg.map((d, i) => `${i ? 'L' : 'M'}${X(d[0]).toFixed(1)},${Y(d[1]).toFixed(1)}`).join('');
  const lineA = segs(A).map(sg => sg.length === 1 ? `<circle cx="${X(sg[0][0])}" cy="${Y(sg[0][1])}" r="2.5" fill="var(--ink-1)"/>` : `<path d="${pathOf(sg)}" fill="none" stroke="var(--ink-1)" stroke-width="2" stroke-linejoin="round"/>`).join('');
  const lineB = B ? segs(B).map(sg => sg.length === 1 ? `<circle cx="${X(sg[0][0])}" cy="${Y(sg[0][1])}" r="2.5" fill="var(--cmp)"/>` : `<path d="${pathOf(sg)}" fill="none" stroke="var(--cmp)" stroke-width="2" stroke-dasharray="5 3" stroke-linejoin="round"/>`).join('') : '';
  const first = A.find(d => d[1] != null), last = [...A].reverse().find(d => d[1] != null);
  const geoBrk = A.findIndex((d, i) => i && d[2] !== A[i - 1][2]);
  const breaks = [...m.breaks, ...(geoBrk > 0 ? [[A[geoBrk][0], 'separate territories from here']] : [])].filter(([yy]) => yy > d0 && yy <= d1);
  const before = state.y < d0 ? `<text x="${l + 2}" y="${H - b - 8}" font-size="11.5" fill="var(--ink-2)">◂ ${state.y} (selected) is before this series</text>` : '';
  const pre = A.findIndex(d => d[1] != null && isPrelim(m, d[0]));
  const cur = A.find(d => d[0] === state.y);
  const id = 'c' + Math.random().toString(36).slice(2, 7);
  CHARTS[id] = { m, A, B, g, g2 };
  const dots = m.only ? A.filter(d => d[1] != null).map(d => `<circle cx="${X(d[0])}" cy="${Y(d[1])}" r="5" fill="var(--ink-1)"/><text x="${X(d[0])}" y="${Y(d[1]) - 10}" text-anchor="middle" font-size="12" fill="var(--ink-1)">${m.fmt(d[1])}</text>`).join('')
    + (B ? B.filter(d => d[1] != null).map(d => `<rect x="${X(d[0]) - 4.5}" y="${Y(d[1]) - 4.5}" width="9" height="9" fill="var(--cmp)"/>`).join('') : '')
    + `<text x="${W / 2}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--ink-3)">census years only · no values in between</text>` : '';
  const notes = [];
  if (first && first[0] > m.years[0]) notes.push(`Series for ${NAMES[g]} begins ${first[0]}.`);
  if (last && last[0] < m.years[1]) notes.push(`Last published value ${last[0]}.`);
  if (!m.only && A.some((d, i) => d[1] == null && i > A.indexOf(first) && i < A.indexOf(last))) notes.push('Gaps are years with no published value.');
  return `<div class="chartwrap" data-cid="${id}">
    ${B ? `<div class="ckey"><span><i class="kl" style="border-color:var(--ink-1)"></i>${NAMES[g]}</span><span><i class="kl dash" style="border-color:var(--cmp)"></i>${NAMES[g2]}</span></div>` : ''}
    <svg class="chart" viewBox="0 0 ${W} ${H}" tabindex="0" role="img" aria-label="${m.label}, ${NAMES[g]}${B ? ' and ' + NAMES[g2] : ''}, ${d0} to ${d1}. Use left and right arrow keys to read each year.">
    ${lo < 0 ? `<line x1="${l}" x2="${W - r}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--ink-3)" stroke-dasharray="2 3"/>` : ''}
    <line x1="${l}" x2="${W - r}" y1="${Y(lo)}" y2="${Y(lo)}" stroke="var(--hairline)"/>
    ${m.only ? '' : `<text x="${l}" y="12" font-size="11.5" fill="var(--ink-3)">top of scale ${m.fmt(hi)}${lo < 0 ? ` · bottom ${m.fmt(lo)}` : ''}</text>`}
    <text x="${l}" y="${H - 6}" font-size="11.5" fill="var(--ink-3)">${d0}</text><text x="${W - r}" y="${H - 6}" text-anchor="end" font-size="11.5" fill="var(--ink-3)">${d1}</text>${before}
    ${breaks.map(([yy, lab], i) => `<line x1="${X(yy - 0.5)}" x2="${X(yy - 0.5)}" y1="${t}" y2="${H - b}" stroke="var(--ink-3)" stroke-dasharray="3 3"/><text x="${X(yy - 0.5) + (X(yy - 0.5) > W * 0.7 ? -3 : 3)}" text-anchor="${X(yy - 0.5) > W * 0.7 ? 'end' : 'start'}" y="${H - b - 6 - (i % 2) * 12}" font-size="10.5" fill="var(--ink-3)">${lab}</text>`).join('')}
    ${m.only ? dots : lineB + lineA}
    ${pre >= 0 && !m.only ? `<circle cx="${X(A[pre][0])}" cy="${Y(A[pre][1])}" r="4" fill="var(--panel)" stroke="var(--ink-1)" stroke-dasharray="2 2"/>` : ''}
    ${(() => { const c2 = state.cmpY && A.find(d => d[0] === state.cmpY); return c2 && c2[1] != null && c2[0] >= d0 ? `<line x1="${X(c2[0])}" x2="${X(c2[0])}" y1="${t - 6}" y2="${H - b}" stroke="var(--ink-2)" stroke-dasharray="1 3"/><circle cx="${X(c2[0])}" cy="${Y(c2[1])}" r="5" fill="none" stroke="var(--ink-1)" stroke-width="1.8"/>` : ''; })()}
    <line class="hov" x1="0" x2="0" y1="${t - 6}" y2="${H - b}" stroke="var(--ink-2)" visibility="hidden"/>
    ${cur && cur[1] != null ? `<line x1="${X(cur[0])}" x2="${X(cur[0])}" y1="${t - 6}" y2="${H - b}" stroke="var(--select)" stroke-opacity=".55"/><circle cx="${X(cur[0])}" cy="${Y(cur[1])}" r="5" fill="var(--select)" stroke="var(--panel)" stroke-width="2"/>` : ''}
    <rect class="hit" x="${l}" y="${t}" width="${W - l - r}" height="${H - t - b}" fill="transparent" data-chart="${d0},${d1},${l},${W - r},${W}" style="cursor:crosshair"/></svg>
    <div class="readout" aria-live="polite">${readout(id, state.y)}</div>
    ${notes.length || pre >= 0 ? `<div class="fine">${notes.join(' ')}${pre >= 0 ? ' Hollow dot = preliminary.' : ''}${breaks.length ? ' Dashed lines mark method changes; compare across them with care.' : ''}</div>` : (breaks.length ? '<div class="fine">Dashed lines mark method changes; compare across them with care.</div>' : '')}
  </div>`;
}
function readout(id, y) {
  const c = CHARTS[id]; if (!c) return '';
  const v = s => { const d = s.find(x => x[0] === y); return d && d[1] != null ? `<b>${c.m.fmt(d[1])}</b>${isPrelim(c.m, y) ? ' <span class="pm">prelim.</span>' : ''}` : '<span class="na">no published value</span>'; };
  const any = [c.A, c.B].some(s => s && s.find(x => x[0] === y)?.[1] != null);
  return `<span class="ry">${c.m.only ? y : whenOf(c.m, y)}</span> · ${NAMES[c.g]} ${v(c.A)}${c.B ? ` · ${NAMES[c.g2]} ${v(c.B)}` : ''}${any ? ` <span class="ru">${c.m.unit}</span>` : ''}`;
}
function chartYear(wrap, clientX) {
  const rect = wrap.querySelector('.hit'), [y0, y1, l, r, W] = rect.dataset.chart.split(',').map(Number), box = wrap.querySelector('svg').getBoundingClientRect();
  return Math.max(y0, Math.min(y1, Math.round(y0 + ((clientX - box.left) / box.width * W - l) / (r - l) * (y1 - y0))));
}
function hoverChart(wrap, y) {
  const c = CHARTS[wrap.dataset.cid]; if (!c) return;
  if (c.m.only) y = c.m.only.reduce((b, o) => Math.abs(o - y) < Math.abs(b - y) ? o : b);
  const [y0, y1, l, r] = wrap.querySelector('.hit').dataset.chart.split(',').map(Number), x = l + (y - y0) / Math.max(1, y1 - y0) * (r - l);
  const h = wrap.querySelector('.hov'); h.setAttribute('x1', x); h.setAttribute('x2', x); h.setAttribute('visibility', 'visible');
  wrap.querySelector('.readout').innerHTML = readout(wrap.dataset.cid, y);
}
function glance(g, y) {
  return `<table>${['pop', 'chg', 'rate', 'dens', 'share', 'nat', 'imm', 'npr', 'emi', 'ipm', 'starts', 'hhg', 'rentrel', 'inc'].map(id => { const m = M[id]; let gg = g;
    if ((gg === 'NT' || gg === 'NU') && !m.split(y)) gg = 'NT+NU';
    const v = y >= m.years[0] && y <= m.years[1] ? m.value(gg, y) : null;
    return `<tr class="click ${id === state.m ? 'cur' : ''}" data-m="${id}"><td>${m.label}</td><td>${v == null ? '—' : m.fmt(v)}${isPrelim(m, y) && v != null ? ' <span style="color:var(--ink-3)">p</span>' : ''}</td></tr>`; }).join('')}</table>
    <div class="fine">Choose a row to map it. p = preliminary. — = not available.</div>`;
}
// ---- small multi-series chart: colour plus a distinct dash and an end label for each line (never colour alone)
function multiChart(series, { y0, y1, cur, unit = '', zero = false, h = 150, bars, brk, brks = [] } = {}) {
  const W = 330, H = h, l = 4, r = 8, t = 14, b = 22;
  const vals = series.flatMap(s => Object.values(s.d)).concat(bars ? Object.values(bars.d) : []).filter(v => v != null);
  if (!vals.length) return '';
  let lo = Math.min(...vals), hi = Math.max(...vals); if (zero) lo = Math.min(0, lo);
  const X = y => l + (y - y0) / (y1 - y0) * (W - l - r), Y = v => t + (1 - (v - lo) / (hi - lo || 1)) * (H - t - b);
  const bw = Math.max(2, (W - l - r) / (y1 - y0 + 1) * 0.6);
  const barSvg = bars ? Object.entries(bars.d).filter(([, v]) => v != null).map(([yy, v]) => `<rect x="${X(+yy) - bw / 2}" y="${Math.min(Y(v), Y(0))}" width="${bw}" height="${Math.abs(Y(v) - Y(0))}" fill="${bars.c}" opacity=".55"/>`).join('') : '';
  const lines = series.map(s => { const pts = Object.entries(s.d).filter(([yy, v]) => v != null && +yy >= y0 && +yy <= y1).sort((a, b) => a[0] - b[0]);
    if (!pts.length) return ''; const path = pts.map(([yy, v], i) => `${i && +yy - pts[i - 1][0] === 1 ? 'L' : 'M'}${X(+yy).toFixed(1)},${Y(v).toFixed(1)}`).join(''); const [ly, lv] = pts.at(-1);
    return `<path d="${path}" fill="none" stroke="${s.c}" stroke-width="2" stroke-dasharray="${s.dash || ''}" stroke-linejoin="round"/><circle cx="${X(+ly)}" cy="${Y(lv)}" r="2.6" fill="${s.c}"/>
      `; }).join('');
  const key = [...(bars ? [`<span><i class="kb" style="background:${bars.c}"></i>${bars.label}</span>`] : []), ...series.map(s => `<span><i class="kl${s.dash ? ' dash' : ''}" style="border-color:${s.c}"></i>${s.label}${s.endNote ? ` <em>${s.endNote}</em>` : ''}</span>`)].join('');
  return `<div class="ckey">${key}</div><svg class="chart" viewBox="0 0 ${W} ${H}" style="height:${H}px">
    ${lo < 0 ? `<line x1="${l}" x2="${W - r}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--ink-3)" stroke-dasharray="2 3"/>` : ''}
    <line x1="${l}" x2="${W - r}" y1="${H - b}" y2="${H - b}" stroke="var(--hairline)"/>
    <text x="${l}" y="10" font-size="11" fill="var(--ink-3)">${unit} · top of scale ${hi >= 1000 ? sig3(hi) : Math.round(hi)}</text>
    <text x="${l}" y="${H - 6}" font-size="11" fill="var(--ink-3)">${y0}</text><text x="${W - r}" y="${H - 6}" text-anchor="end" font-size="11" fill="var(--ink-3)">${y1}</text>
    ${brk ? `<line x1="${X(brk[0])}" x2="${X(brk[0])}" y1="${t}" y2="${H - b}" stroke="var(--ink-3)" stroke-dasharray="3 3"/><text x="${X(brk[0]) - 4}" y="${t + 8}" text-anchor="end" font-size="10.5" fill="var(--ink-3)">${brk[1]}</text>` : ''}
    ${brks.map(([yy, lab]) => `<line x1="${X(yy)}" x2="${X(yy)}" y1="${t + 14}" y2="${H - b}" stroke="var(--ink-3)" stroke-dasharray="1 3"/><text x="${X(yy) + 3}" y="${H - b - 4}" font-size="10" fill="var(--ink-3)">${lab}</text>`).join('')}
    ${barSvg}${lines}${cur >= y0 && cur <= y1 ? `<line x1="${X(cur)}" x2="${X(cur)}" y1="${t}" y2="${H - b}" stroke="var(--accent)" stroke-opacity=".6"/>` : ''}</svg>`;
}
const seq = (y0, y1, f) => { const o = {}; for (let y = y0; y <= y1; y++) o[y] = f(y); return o; };
function chnLine(g) { const d = HCHN.data[g]; if (!d) return '';
  return `<p class="step"><b>3 · Core housing need</b> · ${NAMES[g]}, census years only. <button class="linkish" data-m="chn">2016: ${d[2016]?.pct ?? '—'}%</button> → <button class="linkish" data-m="chn">2021: ${d[2021]?.pct ?? '—'}%</button> of people examined.</p>
    <p class="fine">Two census snapshots, not a trend line. 2021 reflects 2020 incomes, which included temporary pandemic supports.</p>`; }
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
  const b = isProv ? multiChart([{ label: 'Rent vs prices', c: 'var(--seq-4)', d: rel }, { label: 'Real income', c: 'var(--ink-1)', dash: '4 3', d: ri }], { y0: 1979, y1: 2025, cur: y, unit: 'index, 1979 = 100', brk: [2019, 'CPI rent method change'], brks: [[1993, 'income survey'], [2012, 'income survey']] }) : '';
  return `<details class="path" ${M[state.m].group === 'Housing and cost of living' ? 'open' : ''}><summary>Housing path<span class="hint">people → homes → rents → income</span></summary><div class="in">
    <p class="pathnote">Related measures for <b>${NAMES[g]}</b>, side by side. Exploring them together does not show that one caused another.</p>
    <p class="step"><b>1 · Households and homes</b> · ${NAMES[g]}, 2007–2025. Bars: private households added each year (July to July). Lines: homes started and completed (calendar years).</p>${a}
    ${isProv ? '' : '<p class="fine">Starts and completions are not published for the territories in this table.</p>'}
    <p class="fine">Observed side by side, not a measure of shortage: completions are not net additions (demolitions aren't subtracted), households exclude collective dwellings, and the periods differ by six months.</p>
    ${b ? `<p class="step"><b>2 · Rents and incomes</b> · ${NAMES[g]}, 1979–2025. The rent price index relative to all prices, and median after-tax income adjusted for inflation (to 2024), both set to 100 in 1979.</p>${b}
    <p class="fine">Different universes: the CPI rent index covers all tenants, including renewals, and changed method in 2019 (dashed line); income covers all family units, owners and renters. Not an affordability ratio. For market rents, see the city layers.</p>` : ''}
    ${chnLine(g)}
    <p class="step"><b>4 · Cities.</b> <button class="linkish" data-m="vac">Vacancy</button> and <button class="linkish" data-m="rent">two-bedroom rents</button> are published for census metropolitan areas only.</p>
  </div></details>`;
}
function cityPanel(m, y) {
  const c = CITIES.find(x => x.name === state.city); if (!c) return null;
  const v = m.cityValue(c, y), st = c.rent2br_status?.[y];
  const c2 = CITIES.find(x => x.name === state.cmpCity && x.name !== c.name);
  const vs = Object.fromEntries(Object.entries(c.vacancy).map(([k, v]) => [+k, v])), rs = Object.fromEntries(Object.entries(c.rent2br).map(([k, v]) => [+k, v]));
  return `<div class="peek"><div><button class="back" data-act="nocity">← All cities</button><h2 class="place">${c.name}</h2></div>${isPhone() ? `<div class="peekv">${v == null ? '—' : m.fmt(v)}</div>` : ''}</div>
    <div class="when">${m.label} · ${whenOf(m, y)} · census metropolitan area</div>
    <div class="hero"><div class="v">${v == null ? '—' : m.fmt(v)}</div></div>
    <div class="hero-sub">${v == null ? (st === 'F' ? 'Too unreliable to publish for this year (CMHC quality flag F).' : 'Not surveyed or not available for this year.') : m.unit}</div>
    ${cityTable(m, y).replace('<details open>', '<details>')}
    ${cityCompare(m, c, y)}
    ${timeBlock(m, c.name, yy => { const v = m.cityValue(c, yy), st = m.id === 'rent' ? c.rent2br_status?.[yy] : null; return { v, why: v == null ? (st === 'F' ? 'suppressed (F)' : 'not surveyed') : '' }; }, y)}
    <p class="step"><b>Vacancy rate</b>, apartments of 6+ units, October · ${c.name}${c2 ? ' vs ' + c2.name : ''}</p>${multiChart([{ label: c.name, c: 'var(--ink-1)', d: vs }, ...(c2 ? [{ label: c2.name, c: 'var(--cmp)', dash: '5 3', d: Object.fromEntries(Object.entries(c2.vacancy).map(([k, v]) => [+k, v])) }] : [])], { y0: 1971, y1: 2025, cur: y, unit: '%', zero: true, h: 120 })}
    <p class="step"><b>Average rent, two-bedroom</b>, current dollars · ${c.name}${c2 ? ' vs ' + c2.name : ''}</p>${multiChart([{ label: c.name, c: 'var(--ink-1)', d: rs }, ...(c2 ? [{ label: c2.name, c: 'var(--cmp)', dash: '5 3', d: Object.fromEntries(Object.entries(c2.rent2br).map(([k, v]) => [+k, v])) }] : [])], { y0: 1987, y1: 2025, cur: y, unit: '$ per month', h: 120 })}
    <p class="fine">${c.place ? `Point placed at ${c.place} (Natural Earth)` : 'Not drawn on the map (no position in the place file used)'}; the survey covers the whole metropolitan area. Rents are not adjusted for inflation.</p>
    <button class="srcrow" data-why="src"><span>Source &amp; method</span><small>CMHC Rental Market Survey via StatCan 34-10-0127, 34-10-0133 →</small></button>`;
}
function cityTable(m, y) {
  const rows = CITIES.map(c => ({ c, v: m.cityValue(c, y), st: m.id === 'rent' ? c.rent2br_status?.[y] : null })).sort((a, b) => (b.v ?? -1) - (a.v ?? -1));
  return `<details open><summary>All ${CITIES.length} areas · ${y}<span class="hint wide">${MAPPED.length} on the map</span></summary><div class="in"><input class="citysearch" type="search" data-cityfilter placeholder="Find a city" aria-label="Find a city"><table>${rows.map(({ c, v, st }) =>
    `<tr class="click ${c.name === state.city ? 'cur' : ''}" data-city="${c.name}"><td>${c.name}${c.xy ? '' : ' ' + STAT.nm}</td><td>${v == null ? (st === 'F' ? STAT.sup : STAT.ns) : m.fmt(v) + (over(m, v) ? `<span class="ovm" title="${over(m, v) > 0 ? 'Above' : 'Below'} the map's colour scale">${OV[over(m, v)]}</span>` : '')}</td></tr>`).join('')}</table>
    <div class="fine">${m.id === 'rent' ? 'Current dollars. F = too unreliable to publish (CMHC); left blank, never estimated.' : 'Purpose-built apartments of 6+ units, October survey.'}</div></div></details>`;
}
function flowTable(y) {
  const f = flowStats(y);
  return `<details open><summary>Largest flows, July ${y - 1}–June ${y}<span class="hint">${FLOW_TOP} of ${f.rows.length}</span></summary><div class="in"><table>${f.top.map(([o, d, v]) =>
    `<tr class="click" data-prov="${o}"><td>${NAMES[o]} → ${NAMES[d]}</td><td>${fmtInt(v)}</td></tr>`).join('')}</table>
    <div class="fine">These ${FLOW_TOP} flows are ${Math.round(f.share * 100)}% of all ${fmtInt(f.tot)} moves between provinces and territories that year. Sums of four quarterly estimates; people who move twice are counted twice. Choose a province to see every flow in and out.</div></div></details>`;
}
// ---- comparison: two provinces/territories (or two cities) on the same measure and year
function geoFor(m, g, y) { return (g === 'NT' || g === 'NU') && !m.split(y) ? 'NT+NU' : g; }
function whyMissing(m, g, y) {
  if (m.id === 'rentrel' && g !== 'CAN' && !PROV10.includes(g)) return 'not published for the territories';
  if (['starts', 'comp'].includes(m.id) && !PROV10.includes(g) && g !== 'CAN') return 'no territorial data in this table';
  if (m.id === 'comp' && y > 2022) return 'series ends in 2022';
  if (m.id === 'inc' && ['YT', 'NT', 'NU'].includes(g) && y < 2018) return 'territories published from 2018 only';
  if (m.id === 'chn' && !m.only.includes(y)) return 'census years only';
  return 'no published value';
}
function cmpRow(m, g, y) {
  const gg = geoFor(m, g, y), v = m.value(gg, y), flags = [];
  if (v != null && isPrelim(m, y)) flags.push('preliminary');
  if (gg === 'NT+NU') flags.push('N.W.T. and Nunavut combined');
  return { g: gg, v, flags, why: v == null ? whyMissing(m, gg, y) : '' };
}
function diffText(m, a, b) {
  if (a.v == null || b.v == null || m.diff === 'none') return '';
  const d = a.v - b.v;
  if (m.diff === 'pp') { const pp = d * ({ vac: 1, chn: 1 }[m.id] ?? 100); return `${NAMES[a.g]} is <b>${Math.abs(pp).toFixed(1)} percentage points</b> ${d >= 0 ? 'higher' : 'lower'}.`; }
  if (m.diff === 'abs') return `Difference: <b>${(d >= 0 ? '+' : '−') + Math.abs(d).toFixed(1)}</b> ${m.unit} (${NAMES[a.g]} minus ${NAMES[b.g]}).`;
  if (b.v === 0) return '';
  const rel = a.v / b.v - 1;
  return `${NAMES[a.g]} is <b>${m.fmt(Math.abs(d)).replace(/^[+−-]/, '')}</b> ${d >= 0 ? 'higher' : 'lower'} (${pct(rel)} relative to ${NAMES[b.g]}).`;
}
function compareBlock(m, g, y) {
  if (m.kind === 'party' || m.kind === 'arcs' || m.kind === 'points' || g === 'CAN') return '';
  const opts = geosFor(m.split(y)).filter(k => k !== g).map(k => `<option value="${k}" ${state.cmp === k ? 'selected' : ''}>${NAMES[k]}</option>`).join('');
  const pick = `<label class="cmppick">Compare with <select data-cmp><option value="">— choose a place —</option>${opts}</select></label>`;
  if (!state.cmp || state.cmp === g) return `<div class="cmp">${pick}</div>`;
  const a = cmpRow(m, g, y), b = cmpRow(m, state.cmp, y);
  const cell = r => `<td>${r.v == null ? `<span class="na">— ${r.why}</span>` : `<b>${m.fmt(r.v)}</b>`}${r.flags.length ? `<div class="fl">${r.flags.join(' · ')}</div>` : ''}</td>`;
  return `<div class="cmp">${pick}
    <table class="cmpt"><thead><tr><th></th><th>${NAMES[a.g]}</th><th><i class="kl dash" style="border-color:var(--cmp)"></i> ${NAMES[b.g]}</th></tr></thead>
    <tbody><tr><td>${m.label}</td>${cell(a)}${cell(b)}</tr><tr><td>Date</td><td colspan="2">${whenOf(m, y)}</td></tr><tr><td>Unit</td><td colspan="2">${m.unit}</td></tr></tbody></table>
    <p class="cmpdiff">${diffText(m, a, b) || (m.diff === 'none' ? '' : 'No difference shown: one of the values is not published.')}</p>
    <p class="fine">Same source and definition for both (${m.src.map(x => registry[x].table_id || registry[x].publisher).join(' + ')}). A difference is an observation, not an explanation. <button class="linkish" data-why="src">Source &amp; method</button></p></div>`;
}
// ---- Then and now: one place, one measure, two published dates
// Options are only years with a published value for this place. No difference across a marked method/survey change
// or a change of geography; current-dollar differences are flagged as not adjusted for inflation.
function timeBlock(m, label, valueAt, y, geoAt) {
  if (m.kind === 'party' || m.kind === 'arcs') return '';
  const yrs = []; for (let yy = m.years[0]; yy <= m.years[1]; yy++) if (yy !== y && (!m.only || m.only.includes(yy)) && valueAt(yy).v != null) yrs.push(yy);
  if (!yrs.length) return '';
  const y2 = state.cmpY && yrs.includes(state.cmpY) ? state.cmpY : null;
  // Few dates (census): one button per published date. Many: a slider that only stops on published dates,
  // with a strip under it showing which years have a value and where a method change falls.
  let pick;
  if (yrs.length <= 6) pick = `<div class="cmppick tpick"><span>Then and now</span><span class="tchips">${yrs.map(yy => `<button data-cmpy="${yy}" class="${y2 === yy ? 'on' : ''}" aria-pressed="${y2 === yy}">${whenOf(m, yy)}</button>`).join('')}</span></div>`;
  else { const a = yrs[0], b = yrs.at(-1), px = yy => ((yy - a) / (b - a) * 100).toFixed(2);
    pick = `<div class="cmppick tpick"><span>Then and now</span><output>${y2 ? whenOf(m, y2) : 'slide to pick another date'}</output>${y2 ? '<button class="linkish" data-cmpy="">clear</button>' : ''}</div>
      <div class="yrs"><input type="range" data-cmpyr min="${a}" max="${b}" step="1" value="${y2 || yrs[Math.floor(yrs.length / 2)]}" data-prev="${y2 || yrs[Math.floor(yrs.length / 2)]}" data-yrs="${yrs.join(',')}" aria-label="Compare ${label} with another date" aria-valuetext="${y2 ? whenOf(m, y2) : 'none chosen'}" class="${y2 ? 'set' : ''}">
      <svg class="avail" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">${yrs.map(yy => `<rect x="${px(yy) - 0.35}" y="2" width=".7" height="6" fill="var(--ink-2)"/>`).join('')}${m.breaks.filter(([by]) => by > a && by <= b).map(([by]) => `<rect x="${px(by - 0.5) - 0.25}" y="0" width=".5" height="10" fill="var(--accent)"/>`).join('')}</svg>
      <div class="ends"><span>${a}</span><span>${yrs.length < b - a ? 'ticks = years with a published value' : ''}${m.breaks.some(([by]) => by > a && by <= b) ? `${yrs.length < b - a ? ' · ' : ''}<i class="bk"></i> method change` : ''}</span><span>${b}</span></div></div>`; }
  if (!y2) return `<div class="cmp tcmp">${pick}</div>`;
  const [ya, yb] = [Math.min(y, y2), Math.max(y, y2)], A = valueAt(ya), B = valueAt(yb);
  const brk = m.breaks.filter(([by]) => by > ya && by <= yb), geoChange = geoAt && geoAt(ya) !== geoAt(yb);
  const cell = (r, yy) => `<td>${r.v == null ? `<span class="na">— ${r.why}</span>` : `<b>${m.fmt(r.v)}</b>`}${r.flags?.length ? `<div class="fl">${r.flags.join(' · ')}</div>` : ''}<div class="fl"><button class="linkish" data-why="src">source</button></div></td>`;
  let diff = '';
  if (A.v == null || B.v == null) diff = 'No difference shown: one of the values is not published.';
  else if (brk.length) diff = `No difference shown: ${brk.map(([by, lab]) => lab.includes(String(by)) ? `the ${lab}` : `the ${lab} (${by})`).join(', ')} falls between these dates, so the two values are not directly comparable.`;
  else if (geoChange) diff = 'No difference shown: the area covered changes between these dates.';
  else if (m.diff !== 'none') { const d = B.v - A.v;
    diff = m.diff === 'pp' ? `From ${ya} to ${yb}: <b>${d >= 0 ? '+' : '−'}${Math.abs(d * ({ vac: 1, chn: 1 }[m.id] ?? 100)).toFixed(1)} percentage points</b>.`
      : m.diff === 'abs' ? `From ${ya} to ${yb}: <b>${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}</b> ${m.unit}.`
      : A.v ? `From ${ya} to ${yb}: <b>${d >= 0 ? '+' : '−'}${m.fmt(Math.abs(d)).replace(/^[+−-]/, '')}</b> (${pct(B.v / A.v - 1)}).` : '';
    if (/current dollars/i.test(m.unit + ' ' + (m.q || ''))) diff += ' Current dollars: not adjusted for inflation.'; }
  return `<div class="cmp tcmp">${pick}
    <table class="cmpt"><thead><tr><th>${label}</th><th>${ya === y2 ? '<i class="kl ring"></i> ' : ''}${whenOf(m, ya)}</th><th>${yb === y2 ? '<i class="kl ring"></i> ' : ''}${whenOf(m, yb)}</th></tr></thead>
    <tbody><tr><td>${m.label}</td>${cell(A, ya)}${cell(B, yb)}</tr><tr><td>Unit</td><td colspan="2">${m.unit}</td></tr>${m.only ? `<tr><td>Timing</td><td colspan="2">Census years only; nothing is shown for the years between.</td></tr>` : ''}</tbody></table>
    <p class="cmpdiff">${diff}</p>
    <p class="fine">Same source and definition at both dates unless noted. A change over time is an observation, not an explanation.</p></div>`;
}
function cityCompare(m, c, y) {
  const opts = CITIES.filter(x => x.name !== c.name).map(x => `<option value="${x.name}" ${state.cmpCity === x.name ? 'selected' : ''}>${x.name}</option>`).join('');
  const pick = `<label class="cmppick">Compare with <select data-cmpcity><option value="">— choose a city —</option>${opts}</select></label>`;
  const c2 = CITIES.find(x => x.name === state.cmpCity && x.name !== c.name);
  if (!c2) return `<div class="cmp">${pick}</div>`;
  const row = (x, mm) => { const v = mm.cityValue(x, y), st = mm.id === 'rent' ? x.rent2br_status?.[y] : null; return { v, why: v == null ? (st === 'F' ? 'suppressed (too unreliable to publish)' : 'not surveyed this year') : '' }; };
  const tr = mm => { const a = row(c, mm), b = row(c2, mm); const cell = r => `<td>${r.v == null ? `<span class="na">— ${r.why}</span>` : `<b>${mm.fmt(r.v)}</b>`}</td>`;
    const d = a.v != null && b.v != null ? (mm.id === 'vac' ? `${Math.abs(a.v - b.v).toFixed(1)} pts ${a.v >= b.v ? 'higher' : 'lower'}` : `${mm.fmt(Math.abs(a.v - b.v))} ${a.v >= b.v ? 'higher' : 'lower'} (${pct(a.v / b.v - 1)})`) : '—';
    return `<tr><td>${mm.label}</td>${cell(a)}${cell(b)}<td>${d}</td></tr>`; };
  return `<div class="cmp">${pick}
    <table class="cmpt"><thead><tr><th>October ${y}</th><th>${c.name}</th><th><i class="kl dash" style="border-color:var(--cmp)"></i> ${c2.name}</th><th>${c.name} vs ${c2.name}</th></tr></thead>
    <tbody>${tr(M.rent)}${tr(M.vac)}</tbody></table>
    <p class="fine">Both from CMHC's Rental Market Survey for the whole metropolitan area. Rents in current dollars, two-bedroom, purpose-built rental only.</p></div>`;
}
function renderPanel() {
  const m = M[state.m], y = state.y;
  if (m.kind === 'points' && state.city) { const html = cityPanel(m, y); if (html) { body.innerHTML = html; return; } }
  let g = state.p || 'CAN';
  if ((g === 'NT' || g === 'NU') && !m.split(y)) g = 'NT+NU';
  const v = m.kind === 'party' ? null : m.value(g, y);
  let big = '<span class="np">Not published</span>', sub = m.kind === 'points' && g === 'CAN' ? 'Published for metropolitan areas only; there is no national or provincial figure in this table.'
    : `No value for ${NAMES[g]} for ${whenOf(m, y).replace(/^C/, 'c')}: ${whyMissing(m, g, y)}. Nothing is estimated or filled in.`;
  if (m.kind === 'party') { const e = electionAt(y); const s = e && (g === 'CAN' ? e.seats_total : e.seats_by_province[g === 'NT+NU' ? 'NT' : g]);
    const top = topSeats(s); if (top && top[0] === 'TIE') { big = 'Tied'; sub = `${top[2].map(partyShort).join(' and ')} each won <b>${top[1]}</b> of ${Object.values(s).reduce((a, b) => a + b, 0)} seats`; } else if (top) { big = partyShort(top[0]); sub = `won the most seats: <b>${top[1]}</b> of ${Object.values(s).reduce((a, b) => a + b, 0)}`; } }
  else if (g === 'CAN' && (m.id === 'ipm' || m.id === 'flow')) { big = '—'; sub = 'Moves between provinces cancel out for Canada as a whole. Choose a province to see its net arrivals.'; }
  else if (v != null) {
    big = m.fmt(v); sub = m.unit;
    if (m.id === 'inc' && INC_GRADES[g]?.[y]) sub += ` · <span class="ovm">Statistics Canada quality grade ${INC_GRADES[g][y]} (${GRADE[INC_GRADES[g][y]]}; A is best)</span>`;
    if (g !== 'CAN' && over(m, v)) sub += ` · <span class="ovm">${over(m, v) > 0 ? '▲ above' : '▼ below'} the map’s colour scale (${m.fmt(m.rng[over(m, v) > 0 ? 1 : 0])}); the value is exact</span>`;
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
  const peek = `<div class="peek"><div>${state.p ? '<button class="back" data-act="canada">← All of Canada</button>' : ''}<h2 class="place">${NAMES[g]}</h2></div>${isPhone() && big !== '—' ? `<div class="peekv">${big}</div>` : ''}</div>`;
  body.innerHTML = `${peek}
    <div class="when">${m.label} · ${whenOf(m, y)}</div>
    <div class="hero" ${big === '—' ? 'hidden' : ''}><div class="v">${big}</div>${pre ? '<button class="chip prelim" data-why="prelim"><i></i>Preliminary</button>' : ''}</div>
    <div class="hero-sub">${sub}</div>
    ${fromto}
    ${m.kind === 'party' || m.kind === 'points' || (g === 'CAN' && ['ipm', 'flow', 'share'].includes(m.id)) ? '' : chartSVG(g, m, state.cmp && state.cmp !== g && g !== 'CAN' ? geoFor(m, state.cmp, y) : null)}
    ${compareBlock(m, g, y)}
    ${timeBlock(m, NAMES[g], yy => cmpRow(m, g, yy), y, yy => geoFor(m, g, yy))}
    ${m.kind === 'points' ? `<p class="fine" style="margin-top:14px">${m.id === 'vac' ? 'Canada figure: CMHC average across census metropolitan areas.' : 'No national or provincial average is published in this table.'} Choose a city on the map or in the list.</p>${cityTable(m, y)}` : ''}
    ${m.kind === 'arcs' && g === 'CAN' ? flowTable(y) : ''}
    <button class="srcrow" data-why="src"><span>Source &amp; method</span><small>${src} · ${m.tag} →</small></button>
    ${evs.length ? `<details ${isPhone() || m.group === 'Housing and cost of living' ? '' : 'open'}><summary>In ${y}<span class="hint">${evs[0].title}</span></summary><div class="in">${evs.map(x => `<div class="ev"><span class="tag"><i class="m-${x.k}"></i>${{ elec: 'Election result', hist: 'Historical fact', note: 'Data note' }[x.k]}</span><b>${x.title}</b>${fmtDate(x.date)} · ${x.where}.
      <div class="fine">${x.source_url ? `<a href="${x.source_url}" target="_blank" rel="noopener">${x.source}</a>` : x.source}</div></div>`).join('')}</div></details>` : ''}
    ${housingPath(g, y)}
    <details><summary>Other measures, ${y}<span class="hint">10 measures</span></summary><div class="in">${glance(g, y)}</div></details>
    ${seats ? `<details><summary>Federal seats<span class="hint">${(t => !t ? '' : t[0] === 'TIE' ? `Tied ${t[1]}–${t[1]}` : `${partyShort(t[0])} ${t[1]}`)(topSeats(seats))} · ${e.date.slice(0, 4)}</span></summary><div class="in">
      <div class="seats">${Object.entries(seats).map(([p, n]) => `<span title="${partyShort(p)} ${n}" style="flex:${n};background:${cssc(partyCol(p))}"></span>`).join('')}</div>
      <table>${Object.entries(seats).map(([p, n]) => `<tr><td>${partyShort(p)}</td><td>${n}</td></tr>`).join('')}</table>
      <div class="fine">Seats won in the election of ${fmtDate(e.date)} (ParlInfo). Seats, not vote share.</div></div></details>` : ''}
    ${mi ? `<details><summary>Federal government<span class="hint">${mi.pm}</span></summary><div class="in">${mi.pm}, ${partyShort(mi.party)}. Prime Minister from ${fmtDate(mi.start)}.
      <div class="fine">Shown for historical context only. This atlas does not attribute outcomes to governments.</div></div></details>` : ''}`;
}
body.addEventListener('click', e => {
  const t = e.target.closest('[data-act],[data-m],[data-chart],[data-why],[data-city],[data-prov]'); if (!t) return;
  if (t.dataset.city) { state.city = t.dataset.city; update(); return; }
  if (t.dataset.prov) { state.p = t.dataset.prov; update(); return; }
  if (t.dataset.act === 'canada') { state.p = null; update(); }
  else if (t.dataset.act === 'nocity') { state.city = null; update(); }
  else if (t.dataset.why) openSource(M[state.m], t.dataset.why);
  else if (t.dataset.m) { state.m = t.dataset.m; state.y = clampYear(M[state.m], state.y); update(); }
  else if (t.dataset.chart) { const [y0, y1, l, r, W] = t.dataset.chart.split(',').map(Number); const box = t.ownerSVGElement.getBoundingClientRect();
    state.y = clampYear(M[state.m], Math.round(y0 + ((e.clientX - box.left) / box.width * W - l) / (r - l) * (y1 - y0))); stop(); update(); }
});

body.addEventListener('pointermove', e => { const w = e.target.closest('.chartwrap'); if (w && e.target.classList.contains('hit')) hoverChart(w, chartYear(w, e.clientX)); });
body.addEventListener('pointerleave', () => body.querySelectorAll('.chartwrap').forEach(w => { w.querySelector('.hov')?.setAttribute('visibility', 'hidden'); const ro = w.querySelector('.readout'); if (ro) ro.innerHTML = readout(w.dataset.cid, state.y); }), true);
body.addEventListener('keydown', e => { const w = e.target.closest?.('.chartwrap'); if (!w || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  e.preventDefault(); e.stopPropagation(); const m = M[state.m]; let y = state.y + (e.key === 'ArrowRight' ? 1 : -1);
  if (m.only) { const i = m.only.indexOf(state.y) + (e.key === 'ArrowRight' ? 1 : -1); y = m.only[Math.max(0, Math.min(m.only.length - 1, i))]; }
  state.y = clampYear(m, y); stop(); update(); body.querySelector('.chartwrap svg')?.focus(); });
function snapYr(el) { const ys = el.dataset.yrs.split(',').map(Number), raw = +el.value, prev = +el.dataset.prev; let v = raw;
  if (!ys.includes(raw)) { const dir = raw >= prev ? 1 : -1, ahead = ys.filter(yy => dir > 0 ? yy > raw : yy < raw);
    v = ahead.length ? (dir > 0 ? ahead[0] : ahead.at(-1)) : ys.reduce((b, yy) => Math.abs(yy - raw) < Math.abs(b - raw) ? yy : b); }
  el.value = v; el.dataset.prev = v; return v; }
body.addEventListener('click', e => { const b = e.target.closest('button[data-cmpy]'); if (!b) return; state.cmpY = +b.dataset.cmpy && state.cmpY !== +b.dataset.cmpy ? +b.dataset.cmpy : null; update(); });
body.addEventListener('input', e => { if (e.target.matches('[data-cmpyr]')) { const v = snapYr(e.target), o = e.target.closest('.tcmp').querySelector('output'); if (o) o.textContent = whenOf(M[state.m], v); e.target.classList.add('set'); return; }
  if (e.target.matches('[data-cityfilter]')) { const q = e.target.value.trim().toLowerCase();
  body.querySelectorAll('tr[data-city]').forEach(tr => tr.hidden = q && !tr.dataset.city.toLowerCase().includes(q)); } });
body.addEventListener('change', e => { if (e.target.matches('[data-cmp]')) { state.cmp = e.target.value || null; update(); }
  if (e.target.matches('[data-cmpyr]')) { state.cmpY = snapYr(e.target); update(); body.querySelector('[data-cmpyr]')?.focus(); }
  if (e.target.matches('[data-cmpcity]')) { state.cmpCity = e.target.value || null; update(); } });
// phone sheet: collapsed (year + place), middle, expanded; drag or tap the grip
const sheet = document.getElementById('sheet');
const SNAP = () => [PEEK, Math.round(innerHeight * 0.45), Math.round(innerHeight * 0.88)];
var sheetState = 0;
function sheetH() { return SNAP()[sheetState]; }
function setSheet(i) { const was = sheetState; sheetState = i; sheet.dataset.state = i; window.__sheetH = SNAP()[i]; document.body.classList.toggle('sheet-up', i > 0);
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
  postc: ['Postcensal estimate', `Population estimates from July ${POSTCENSAL_FROM} onward are built forward from the 2021 Census. Statistics Canada describes them as final or updated postcensal, and will revise them to "intercensal" estimates after the 2026 Census is processed. Figures before July ${POSTCENSAL_FROM} are final.`],
  prelim: ['Preliminary estimate', 'Statistics Canada publishes a first estimate and revises it as census, immigration and vital-statistics data arrive. Population estimates from July 1, 2026 and components of change for July 2025 to June 2026 are preliminary; they can move noticeably.'],
  ntnu: ['Northwest Territories and Nunavut combined', 'Before July 1991, Statistics Canada reports one figure for the Northwest Territories including what is now Nunavut. The map shows them as one region for those dates. Changes for each territory are measured from July 1991.'],
  seats: ['Two seats reconciled', 'The Library of Parliament file retrieved for this project lists 341 of the 343 members elected on April 28, 2025. Vancouver Quadra (Liberal) and Fundy Royal (Conservative) were missing and have been added from Elections Canada’s Official Voting Results, Table 11. The source file itself is unchanged; the reconciliation is recorded in the project registry.'],
  cover: ['Coverage', ''],
};
const FORMULA = {
  chg: 'population(July 1, year) ÷ population(July 1, 1971) − 1; NT and NU from July 1991', rate: 'population(July 1, year) ÷ population(July 1, year − 1) − 1',
  dens: 'population(July 1, year) ÷ land area (2021 Census)', share: 'population ÷ Canada population, same date',
  nat: '(births − deaths, July–June) ÷ population at the start of the period × 1,000', imm: 'immigrants ÷ population at the start of the period × 1,000',
  npr: 'net non-permanent residents ÷ population at the start of the period × 1,000', emi: 'net emigration ÷ population at the start of the period × 1,000',
  ipm: 'net interprovincial migration ÷ population at the start of the period × 1,000',
  starts: 'housing starts in calendar year ÷ population on July 1 of that year × 1,000', comp: 'housing completions in calendar year ÷ population on July 1 of that year × 1,000',
  hhg: 'private households on July 1, year ÷ private households on July 1, 2006 − 1',
  rentrel: '(CPI rent, year ÷ CPI rent, 2019) ÷ (CPI all-items, year ÷ CPI all-items, 2019) − 1',
};
const COVER = {
  comp: 'CMHC table 34-10-0126 publishes completions to 2022 only (starts continue to 2025). The line and map stop at 2022 and are not extended. No territorial data.',
  chn: 'Census of Population, 2016 and 2021 only; there are no annual values in between and none are estimated. Percent of persons (not households) living in households examined for core housing need. On-reserve, farm and zero-income households are not examined. 2021 income refers to 2020, when temporary pandemic supports lowered the share of income spent on shelter; Statistics Canada attributes much of the 2016→2021 decline to them.',
  hhg: 'Private households from Table 17-10-0159, 2006–2025; 2025 is preliminary. All provinces and territories are covered.',
  inc: 'Median after-tax income is published for the provinces from 1976 and for the territories only from 2018. Earlier territorial years are shown as no data. Series breaks in 1993 and 2012 (survey changes).',
  starts: 'CMHC table 34-10-0126 covers Canada and the ten provinces only. The territories are shown dimmed as “no data”, not as zero. Completions in this table end in 2022; starts continue to 2025.',
  vac: `CMHC publishes vacancy for census metropolitan areas, not provinces. ${MAPPED.length} areas are mapped at their core city; ${HCITY.unplaced.map(x => x.split(',')[0]).join(', ')} are not in the place file used for positions and are listed but not drawn. Each area enters the series in a different year.`,
  rent: `CMHC average rents are published for centres of 10,000+, not provinces. Two-bedroom units in row and apartment structures of 3+ units, current dollars. Values flagged “too unreliable to publish” (F) are left blank. ${MAPPED.length} metropolitan areas are drawn; ${CITIES.length - MAPPED.length} more are listed in the panel.`,
  rentrel: 'Statistics Canada replaced its rent method in January 2019 (matched units → a hedonic model on Labour Force Survey rents), so this layer starts from 2019. The rent index covers all tenants (new leases, renewals and mid-lease), so it rises more slowly than asking rents for vacant units. Provinces only: the territories have city indexes (Whitehorse, Yellowknife, Iqaluit).',
};
function openSource(m, why = 'src') {
  const w = why === 'cover' ? ['Coverage', COVER[m.id] || ''] : WHY[why];
  document.getElementById('drawer-body').innerHTML = (w ? `<div style="color:var(--ink-3);font-size:13px">About this view</div><h2>${w[0]}</h2><p style="color:var(--ink-2);line-height:1.55">${w[1]}</p><hr style="border:0;border-top:1px solid var(--hairline);margin:20px 0">` : '') +
    `<div style="color:var(--ink-3);font-size:13px">${m.tag}</div><h2>${m.label}</h2><p style="color:var(--ink-2);line-height:1.5;margin:0">${m.q}</p>` +
    `<dl><dt>Years shown</dt><dd>${m.only ? m.only.join(' and ') + ' only' : m.years[0] + '–' + m.years[1]}</dd>${FORMULA[m.id] ? `<dt>Formula</dt><dd>${FORMULA[m.id]}</dd>` : ''}${COVER[m.id] ? `<dt>Coverage</dt><dd>${COVER[m.id]}</dd>` : ''}</dl>` +
    m.src.map(id => { const s = registry[id]; return `<dl><dt>Publisher</dt><dd>${s.publisher}</dd><dt>Dataset</dt><dd>${s.title}${s.table_id ? ` (Table ${s.table_id})` : ''}</dd>
      <dt>Link</dt><dd><a href="${s.landing_url}" target="_blank" rel="noopener">${s.landing_url}</a></dd>
      ${s.reporting_period ? `<dt>Frequency</dt><dd>${s.reporting_period}</dd>` : ''}${s.coverage ? `<dt>Geography</dt><dd>${s.coverage}</dd>` : ''}${s.release_in_file ? `<dt>Release</dt><dd>${s.release_in_file}</dd>` : ''}
      <dt>Retrieved</dt><dd>${s.retrieved}</dd><dt>Licence</dt><dd>${s.licence_url ? `<a href="${s.licence_url}" target="_blank" rel="noopener">${s.licence}</a>` : s.licence}</dd></dl>
      ${(s.methodology_notes || []).length ? `<details><summary>Method notes<span class="hint">${s.methodology_notes.length}</span></summary><ul>${s.methodology_notes.map(n => `<li>${n}</li>`).join('')}</ul></details>` : ''}
      ${(s.limitations || []).length ? `<details><summary>Limitations<span class="hint">${s.limitations.length}</span></summary><ul>${s.limitations.map(n => `<li>${n}</li>`).join('')}</ul></details>` : ''}
      <details><summary>File fingerprint<span class="hint">SHA-256</span></summary><div class="in" style="font-family:var(--font-mono);font-size:12px;word-break:break-all">${s.sha256 || '—'}</div></details>`; }).join('') +
    (TX === 'relief' && registry.naturalearth_sr50m ? (r => `<hr style="border:0;border-top:1px solid var(--hairline);margin:20px 0"><div style="color:var(--ink-3);font-size:13px">Map surface · context only</div><h2>Shaded relief</h2>
      <p style="color:var(--ink-2);line-height:1.55">Generalised physical geography drawn underneath the data. It is not “${m.label}” or any other statistic, and it does not change the position, size or colour of any data mark. It can be switched off in Colours and map surface.</p>
      <dl><dt>Publisher</dt><dd>${r.publisher}</dd><dt>Dataset</dt><dd>${r.title}</dd><dt>Link</dt><dd><a href="${r.landing_url}" target="_blank" rel="noopener">${r.landing_url}</a></dd><dt>Detail</dt><dd>${r.coverage || ''}</dd><dt>Retrieved</dt><dd>${r.retrieved}</dd><dt>Licence</dt><dd>${r.licence}</dd></dl>
      <details><summary>Limitations<span class="hint">${(r.limitations || []).length}</span></summary><ul>${(r.limitations || []).map(n => `<li>${n}</li>`).join('')}</ul></details>`)(registry.naturalearth_sr50m) : '');
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
  document.body.classList.toggle('k-party', m.kind === 'party');
  drawNav(); document.querySelectorAll('.opt').forEach(b => b.classList.toggle('on', b.dataset.m === state.m));
  theDeck.setProps({ layers: layers() });
  reading(m); renderPanel(); timelineCtx(state.y); writeHash(); placeCtl();
  if (isPhone() && !userMoved) { const f = fitView(); if (Math.abs(f.zoom - view.zoom) > 0.01 || Math.abs(f.target[1] - view.target[1]) > 5 || Math.abs(f.rotationX - view.rotationX) > 1) { view = { ...view, ...f }; theDeck.setProps({ viewState: view }); } }
}
drawEras();
setSheet(Q.get('sheet') ? +Q.get('sheet') : 0);
view = { ...view, ...fitView() }; theDeck.setProps({ viewState: view });
update();
// ================================================================ flagship story: population change
// Every number in the story text is computed from the loaded data when the card is drawn; nothing is typed in by hand.
const mil = n => (n / 1e6).toFixed(1) + ' million';
const canSeries = id => { const m = M[id], o = []; for (let y = m.years[0]; y <= m.years[1]; y++) { const v = m.value('CAN', y); if (v != null) o.push([y, v]); } return o; };
const STORY = { id: 'population-1971-' + YMAX, title: `How Canada’s population changed, 1971–${YMAX}`, chapters: [
  { m: 'pop', y: () => YMAX, t: () => `From ${Math.round(popAt('CAN', 1971) / 1e6)} million to ${Math.round(popAt('CAN', YMAX) / 1e6)} million`,
    text: () => { const a = popAt('CAN', 1971), b = popAt('CAN', YMAX); return `On July 1, 1971, Canada had <b>${mil(a)}</b> people. On July 1, ${YMAX}, it had <b>${mil(b)}</b>: ${mil(b - a)} more, an increase of ${Math.round((b / a - 1) * 100)}%. Each column is one province or territory, and its height is its population.`; },
    limit: () => `These are Statistics Canada’s annual estimates for July 1, not census counts. ${YMAX} is preliminary, and ${POSTCENSAL_FROM}–${YMAX - 1} will be revised after the 2026 Census.` },
  { m: 'chg', y: () => YMAX, t: () => 'Growth was uneven',
    text: () => { const r = PROV10.map(g => [g, M.chg.value(g, YMAX)]).sort((a, b) => b[1] - a[1]), c = M.chg.value('CAN', YMAX), n = r.filter(x => x[1] > c).length;
      return `Since 1971, ${NAMES[r[0][0]]}’s population grew <b>${pct(r[0][1])}</b>, the most of any province. ${NAMES[r.at(-1)[0]]}’s grew <b>${pct(r.at(-1)[1])}</b>, the least. ${n} of the ten provinces grew faster than Canada as a whole (${pct(c)}).`; },
    limit: () => 'The territories are measured from 1991, when separate figures begin, so they are not comparable with the provinces on this map. A percentage does not say why a place grew.' },
  { m: 'share', y: () => YMAX, t: () => 'The balance between provinces shifted',
    text: () => { const sh = (g, y) => popAt(g, y) / popAt('CAN', y) * 100, d = PROV10.map(g => [g, sh(g, YMAX) - sh(g, 1971)]).sort((a, b) => b[1] - a[1]), G = d[0][0], L = d.at(-1)[0], fewer = PROV10.filter(g => popAt(g, YMAX) < popAt(g, 1971));
      return `In 1971, ${NAMES[L]} was home to <b>${sh(L, 1971).toFixed(1)}%</b> of Canadians; in ${YMAX}, <b>${sh(L, YMAX).toFixed(1)}%</b>. Over the same years ${NAMES[G]} went from ${sh(G, 1971).toFixed(1)}% to ${sh(G, YMAX).toFixed(1)}%. ${fewer.length ? `${fewer.map(g => NAMES[g]).join(' and ')} had fewer people in ${YMAX} than in 1971.` : `Every province had more people in ${YMAX} than in 1971, so a falling share here means slower growth, not decline.`}`; },
    limit: () => 'Shares always add to 100%, so one province’s gain is arithmetic, not a transfer of people from another.' },
  { m: 'dens', y: () => YMAX, t: () => 'A large country, thinly settled on average',
    text: () => { const r = PROV.map(g => [g, M.dens.value(g, YMAX)]).sort((a, b) => b[1] - a[1]), f = v => v < 1 ? v.toFixed(2) : v.toFixed(1);
      return `${NAMES[r[0][0]]} had <b>${f(r[0][1])}</b> people for every square kilometre of land in ${YMAX}; ${NAMES[r.at(-1)[0]]} had <b>${f(r.at(-1)[1])}</b>. For Canada as a whole the figure was ${f(M.dens.value('CAN', YMAX))}.`; },
    limit: () => 'An average over each whole province or territory, using 2021 Census land area for every year. It hides how concentrated settlement is inside each one. Colours use a logarithmic scale.' },
  { m: 'rate', t: () => 'Not every year was growth',
    pick: () => { let n = 0, tot = 0, min = [null, null, 0]; const by = {}; for (const g of PROV10) for (let y = 1972; y <= YMAX; y++) { const v = M.rate.value(g, y); if (v == null) continue; tot++; if (v < 0) { n++; by[g] = (by[g] || 0) + 1; } if (v < min[2]) min = [g, y, v]; }
      const most = Object.entries(by).sort((a, b) => b[1] - a[1])[0]; return { n, tot, min, most }; },
    y() { return this.pick().min[1]; }, p() { return this.pick().min[0]; },
    text() { const k = this.pick(); return `Between 1972 and ${YMAX}, a province’s population fell from one July to the next in <b>${k.n}</b> of ${k.tot} cases. ${NAMES[k.most[0]]} accounts for ${k.most[1]} of them. The largest one-year fall was in ${NAMES[k.min[0]]} in ${k.min[1]}: <b>${pct(k.min[2], 1)}</b>.`; },
    limit: () => 'A one-year change is a small difference between two estimates, so it is the figure most affected by later revisions.' },
  { m: 'flow', y: () => M.flow.years[1], t: () => 'Moving between provinces',
    text: () => { const y = M.flow.years[1], rows = (flows.data[String(y - 1)] || []).slice().sort((a, b) => b[2] - a[2]), tot = rows.reduce((a, r) => a + r[2], 0); let up = 0, dn = 0, n = 0;
      for (let yy = 1972; yy <= YMAX; yy++) { const c = compAt('AB', yy); if (c?.net_interprovincial == null) continue; n++; c.net_interprovincial > 0 ? up++ : c.net_interprovincial < 0 ? dn++ : 0; }
      return `In the twelve months to June 30, ${y}, <b>${fmtInt(tot)}</b> moves between provinces and territories were recorded. The largest single stream was <b>${fmtInt(rows[0][2])}</b> moves from ${NAMES[rows[0][0]]} to ${NAMES[rows[0][1]]}. Over ${n} years of records, Alberta gained people from the rest of Canada in ${up} years and lost them in ${dn}.`; },
    limit: () => 'These are moves, not people: someone who moves twice in a year is counted twice. The national map draws the twelve largest streams; choose a province to see all of its flows.' },
  { m: 'imm', t: () => 'Arrivals from other countries',
    pick: () => { const s = canSeries('imm'); return { hi: s.reduce((a, b) => b[1] > a[1] ? b : a), lo: s.reduce((a, b) => b[1] < a[1] ? b : a), last: s.at(-1) }; },
    y() { return this.pick().hi[0]; },
    text() { const k = this.pick(), per = y => `${y - 1}/${String(y).slice(2)}`; return `Canada admitted <b>${k.hi[1].toFixed(1)}</b> immigrants for every 1,000 residents in ${per(k.hi[0])}, the highest rate in this record, and ${k.lo[1].toFixed(1)} in ${per(k.lo[0])}, the lowest. In the latest year, ${per(k.last[0])}, the rate was ${k.last[1].toFixed(1)}.`; },
    limit: () => 'Counts new permanent residents only. Temporary residents are a separate layer. Rates are per 1,000 residents at the start of each July-to-June year, so large and small provinces can be compared.' },
  { m: 'npr', t: () => 'Temporary residents',
    pick: () => { const s = canSeries('npr'); return { hi: s.reduce((a, b) => b[1] > a[1] ? b : a), lo: s.reduce((a, b) => b[1] < a[1] ? b : a), last: s.at(-1) }; },
    y() { return this.pick().hi[0]; },
    text() { const k = this.pick(), per = y => `${y - 1}/${String(y).slice(2)}`; return `The net change in temporary residents (permit holders and asylum claimants) was highest in ${per(k.hi[0])}, at <b>${signed(k.hi[1])}</b> per 1,000 residents, and lowest in ${per(k.lo[0])}, at <b>${signed(k.lo[1])}</b>. In the latest year, ${per(k.last[0])}, it was ${signed(k.last[1])}.`; },
    limit: () => 'A net figure: arrivals minus departures and changes of status. The latest year is preliminary.' },
  { m: 'nat', y: () => YMAX, t: () => 'Births minus deaths',
    text: () => { const s = canSeries('nat'), neg = PROV10.filter(g => M.nat.value(g, YMAX) < 0), per = y => `${y - 1}/${String(y).slice(2)}`;
      return `In ${per(s[0][0])}, births exceeded deaths by <b>${s[0][1].toFixed(1)}</b> per 1,000 residents across Canada. In ${per(s.at(-1)[0])} the figure was <b>${signed(s.at(-1)[1])}</b>. ${neg.length ? `In ${neg.length} of the ten provinces, deaths outnumbered births that year: ${neg.map(g => NAMES[g]).join(', ')}.` : 'In every province births still outnumbered deaths that year.'}`; },
    limit: () => 'Natural increase only; it leaves out all migration. The latest year is preliminary.' },
  { m: 'pop', y: () => YMAX, t: () => 'What this story does not cover yet',
    text: () => `Two parts of the picture are not in the explorer yet: how much of the population lives in metropolitan areas, and how its age structure changed. Both need tables that have not been added and audited. Everything shown in this story comes from Statistics Canada tables 17-10-0009, 17-10-0008 and 17-10-0045, and 2021 Census land areas.`,
    limit: () => 'Open “Source & method” on any layer for the table, licence, retrieval date and limitations. The story describes what changed; it does not explain why.' },
] };
function openStory(i) { const n = STORY.chapters.length; if (i < 0 || i >= n) return; const ch = STORY.chapters[i]; state.story = i; state.q = null; state.navQ = false; state.m = ch.m;
  state.y = clampYear(M[ch.m], ch.y ? ch.y() : YMAX); state.p = ch.p ? ch.p() : null; state.city = null; state.cmp = null; state.cmpY = null; document.getElementById('layer-sheet').classList.remove('open'); update(); }
function storyCard() { const i = state.story, ch = STORY.chapters[i]; if (!ch || state.m !== ch.m) { state.story = null; return ''; } const n = STORY.chapters.length;
  return `<div class="pathcard storycard"><div class="pq"><span><small>${STORY.title} · ${i + 1} of ${n}</small>${ch.t()}</span><button class="x" data-storygo="x" aria-label="Leave the story">×</button></div>
    <p>${ch.text()}</p><p class="lim"><b>Keep in mind.</b> ${ch.limit()}</p>
    <div class="prel">${i > 0 ? `<button class="chip" data-storygo="${i - 1}">← Back</button>` : ''}${i < n - 1 ? `<button class="chip on" data-storygo="${i + 1}">Next: ${STORY.chapters[i + 1].t()} →</button>` : `<button class="chip on" data-storygo="x">Explore on your own →</button>`}</div></div>`; }
if (Q.get('story') != null && !STUDIO) setTimeout(() => openStory(+Q.get('story') || 0), 0);

// ================================================================ Timelapse Studio
// One configuration object describes a timelapse completely (layer, place, period, camera, text). The same object drives
// the in-browser preview and the frame-exact renderer (render/timelapse.py), so an export can always be reproduced.
const b64e = o => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64d = t => JSON.parse(decodeURIComponent(escape(atob(t.replace(/-/g, '+').replace(/_/g, '/')))));
function defaultAnnotations(m, a, b) { const out = [];
  if (['pop', 'chg', 'share', 'dens', 'rate'].includes(m.id)) { for (const T of [25, 30, 35, 40, 45, 50]) { let y = null; for (let yy = Math.max(a, 1972); yy <= b; yy++) if (popAt('CAN', yy) >= T * 1e6 && popAt('CAN', yy - 1) < T * 1e6) { y = yy; break; } if (y) out.push({ year: y, text: `Canada passes ${T} million people (July 1 estimate)` }); }
    if (a < 1991 && b >= 1991) out.push({ year: 1991, text: 'Northwest Territories and Nunavut are shown separately from 1991' }); }
  for (const [y, lab] of m.breaks || []) if (y > a && y <= b) out.push({ year: y, text: `Method change: ${lab}. Compare across it with care` });
  if (isPrelim(m, b)) out.push({ year: b, text: `${b} is a preliminary estimate` });
  return out.sort((x, y) => x.year - y.year); }
function studioConfig(over = {}) { const m = M[over.layer || state.m], [a, b] = m.years, place = 'place' in over ? over.place : state.p;
  return { version: 1, id: `${m.id}${place ? '-' + enc(place) : ''}-${a}-${b}`, title: m.label, subtitle: m.q, layer: m.id, place: place || null, from: a, to: b, fps: 30, intro: 2.5, perYear: 0.6, outro: 5,
    camera: 'push', theme: PAL, surface: TX, annotations: defaultAnnotations(m, a, b), credit: 'The Canadian Data Project', ...over }; }
document.addEventListener('click', e => { if (!e.target.closest('[data-studio-open]')) return; const c = studioConfig(), m = M[c.layer]; let d = document.getElementById('studiodlg');
  if (!d) { d = document.createElement('dialog'); d.id = 'studiodlg'; document.getElementById('app').appendChild(d); }
  d.innerHTML = `<form method="dialog" class="sform"><h2>Make a timelapse</h2><p class="fine">${m.label}${c.place ? ' · ' + NAMES[c.place] : ' · all of Canada'}. The preview and the exported video are drawn from the same configuration, so an export can be reproduced exactly.</p>
    <label>Title<input name="title" value="${c.title.replace(/"/g, '&quot;')}"></label><label>Subtitle<input name="subtitle" value="${c.subtitle.replace(/"/g, '&quot;')}"></label>
    <div class="two"><label>From<input name="from" type="number" min="${m.years[0]}" max="${m.years[1]}" value="${c.from}"></label><label>To<input name="to" type="number" min="${m.years[0]}" max="${m.years[1]}" value="${c.to}"></label></div>
    <div class="two"><label>Seconds per year<select name="perYear"><option value="0.4">0.4 (fast)</option><option value="0.6" selected>0.6</option><option value="1">1.0 (slow)</option></select></label>
      <label>Camera<select name="camera"><option value="push">Slow push-in</option><option value="static">Still</option><option value="pan">Pan west to east</option><option value="orbit">Gentle turn</option></select></label></div>
    <label>Notes on screen, one per line as “year: text”<textarea name="ann" rows="5">${c.annotations.map(a => `${a.year}: ${a.text}`).join('\n')}</textarea></label>
    <p class="fine" id="studio-len"></p>
    <div class="acts"><button type="button" data-studio="preview" class="pri">Preview</button><button type="button" data-studio="save">Download configuration</button><button value="cancel">Close</button></div>
    <p class="fine">To export a 1080p video from a saved configuration: <code>python3 render/timelapse.py &lt;configuration&gt;.json</code>. Only years with a published value are shown; nothing is interpolated between them.</p></form>`;
  const read = () => { const f = new FormData(d.querySelector('form')), from = Math.max(m.years[0], Math.min(m.years[1], +f.get('from'))), to = Math.max(from, Math.min(m.years[1], +f.get('to')));
    const ann = String(f.get('ann')).split('\n').map(l => l.match(/^\s*(\d{4})\s*:\s*(.+)$/)).filter(Boolean).map(x => ({ year: +x[1], text: x[2].trim() })).filter(a => a.year >= from && a.year <= to);
    return studioConfig({ layer: m.id, place: c.place, title: f.get('title'), subtitle: f.get('subtitle'), from, to, perYear: +f.get('perYear'), camera: f.get('camera'), annotations: ann, id: `${m.id}${c.place ? '-' + enc(c.place) : ''}-${from}-${to}` }); };
  const len = () => { const k = read(); let n = 0; for (let y = k.from; y <= k.to; y++) if (!m.only || m.only.includes(y)) n++; d.querySelector('#studio-len').textContent = `${n} dates · about ${Math.round(k.intro + n * k.perYear + k.outro)} seconds at 30 frames per second, 1920 × 1080.`; };
  d.oninput = len; len();
  d.onclick = ev => { const a = ev.target.closest('[data-studio]')?.dataset.studio; if (!a) return; const k = read();
    if (a === 'preview') window.open(`${location.pathname}?studio=${b64e(k)}&p=${k.theme}&tx=${k.surface}`, '_blank');
    if (a === 'save') { const u = URL.createObjectURL(new Blob([JSON.stringify(k, null, 1)], { type: 'application/json' })), l = document.createElement('a'); l.href = u; l.download = `timelapse-${k.id}.json`; l.click(); setTimeout(() => URL.revokeObjectURL(u), 2000); } };
  d.showModal(); });
if (STUDIO) { const SC = b64d(STUDIO), m = M[SC.layer]; state.m = SC.layer; state.p = SC.place || null; state.story = null; state.q = null; state.city = null;
  const years = []; for (let y = SC.from; y <= SC.to; y++) if (!m.only || m.only.includes(y)) years.push(y);
  const fps = SC.fps || 30, nI = Math.round(SC.intro * fps), per = Math.max(1, Math.round(SC.perYear * fps)), nO = Math.round(SC.outro * fps), N = nI + years.length * per + nO;
  const stage = document.createElement('div'); stage.id = 'stage';
  const srcLine = m.src.map(x => registry[x]).map(r => `${r.publisher}${r.table_id ? ', table ' + r.table_id : ''}`).filter((x, i, a) => a.indexOf(x) === i).join(' · ');
  stage.innerHTML = `<div id="st-sub"></div><div id="st-ann"></div><div id="st-foot"><span>Source: ${srcLine}. Annual published values; nothing is interpolated.</span><b>${SC.credit || ''}</b></div>
    <div id="st-bar"><i></i>${years.filter(y => y % 10 === 0 || y === years[0] || y === years.at(-1)).map(y => `<span style="left:${(years.indexOf(y) + 0.5) / years.length * 100}%">${y}</span>`).join('')}</div>
    <div id="st-out"><h3>Sources and method</h3>${m.src.map(x => registry[x]).map(r => `<p><b>${r.publisher}</b>${r.table_id ? ' · table ' + r.table_id : ''} · ${r.title}<br><small>${r.licence} · retrieved ${r.retrieved}</small></p>`).join('')}<p class="cv">${m.q}${m.cover ? ' ' + m.cover + '.' : ''} Shown as published for each year${isPrelim(m, years.at(-1)) ? `; ${years.at(-1)} is preliminary` : ''}. This video describes the data; it does not explain causes.</p></div>`;
  document.getElementById('app').appendChild(stage); document.getElementById('st-sub').textContent = SC.subtitle || '';
  const ease = t => t * t * (3 - 2 * t); let base = null, lastY = null, relY = null;
  const cam = t => { const e = ease(t), v = { ...base, target: [...base.target] };
    if (SC.camera === 'push') { v.zoom = base.zoom - 0.17 + 0.15 * e; v.rotationOrbit = -11 + 8 * e; v.rotationX = base.rotationX + 3 - 5 * e; }
    else if (SC.camera === 'pan') { v.zoom = base.zoom + 0.1; v.target[0] = base.target[0] - 300 + 600 * e; }
    else if (SC.camera === 'orbit') { v.rotationOrbit = -15 + 22 * e; }
    return v; };
  const renderFrame = f => { f = Math.max(0, Math.min(N - 1, Math.round(f))); if (!base) base = fitView();
    const i = f < nI ? 0 : Math.min(years.length - 1, Math.floor((f - nI) / per)), y = years[i];
    view = cam(N > 1 ? f / (N - 1) : 0); theDeck.setProps({ viewState: view, controller: false, useDevicePixels: +Q.get('ss') || Math.max(2, devicePixelRatio) });   // supersample the map for video
    if (y !== lastY) { state.y = y; lastY = y; state.m = SC.layer; state.p = SC.place || null; update(); document.getElementById('r-title').textContent = SC.title; }
    if (y !== relY || f % 6 === 0) { theDeck.redraw('studio'); theDeck.setProps({ layers: layers() }); relY = y; }   // label collision layout: on each new year and every 6th frame as the camera drifts
    theDeck.redraw('studio');
    const a = (SC.annotations || []).filter(a => a.year <= y && y < a.year + (a.hold || Math.max(2, Math.round(2.4 / SC.perYear)))).at(-1), out = f >= N - nO, intro = f < nI;
    document.getElementById('st-ann').textContent = a && !intro && !out ? a.text : ''; document.getElementById('st-ann').classList.toggle('on', !!a && !intro && !out);
    document.body.classList.toggle('st-intro', intro); document.body.classList.toggle('st-outro', out);
    stage.querySelector('#st-bar i').style.width = ((i + (intro ? 0 : out ? 1 : Math.min(1, ((f - nI) % per + 1) / per))) / years.length * 100) + '%';
    return { frame: f, year: y, phase: intro ? 'intro' : out ? 'outro' : 'run', title: SC.title, finding: document.getElementById('finding').innerText, annotation: a && !intro && !out ? a.text : '' }; };
  window.CTT = { get ready() { return window.READY === true && (TX !== 'relief' || !!RELIEF.img); }, frameCount: N, fps, renderFrame, config: SC, years };
  if (Q.get('render') == null) { // preview: plays in real time, with a scrubber
    const ctl = document.createElement('div'); ctl.id = 'st-ctl'; ctl.innerHTML = `<button aria-label="Play or pause">❚❚</button><input type="range" min="0" max="${N - 1}" value="0" aria-label="Position"><span></span><em>Preview · ${Math.round(N / fps)} s · export with render/timelapse.py</em>`;
    document.getElementById('app').appendChild(ctl); const rng = ctl.querySelector('input'), btn = ctl.querySelector('button'), lab = ctl.querySelector('span'); let playing = true, f0 = 0, t0 = performance.now();
    const show = f => { const info = renderFrame(f); rng.value = f; lab.textContent = `${info.year} · ${(f / fps).toFixed(1)} s`; };
    const loop = () => { if (playing && CTT.ready) { let f = f0 + (performance.now() - t0) / 1000 * fps; if (f >= N - 1) { f = N - 1; playing = false; btn.textContent = '▶'; } show(f); } else if (!CTT.ready) t0 = performance.now(); requestAnimationFrame(loop); };
    btn.onclick = () => { playing = !playing; btn.textContent = playing ? '❚❚' : '▶'; if (playing) { f0 = +rng.value >= N - 1 ? 0 : +rng.value; t0 = performance.now(); } };
    rng.oninput = () => { playing = false; btn.textContent = '▶'; show(+rng.value); };
    setTimeout(() => requestAnimationFrame(loop), 0); }
}

window.CTX = { STORY, openStory, studioConfig,  over, overList, MEASURES, YMIN, YMAX, FIT, FIT_PTS, measureFit, state, update, M, setSheet, getView: () => view, fitView, boundView, deck: theDeck, clampYear, CITIES, MAPPED, PATHS, openPath, cmpRow, diffText };
window.READY = true;
