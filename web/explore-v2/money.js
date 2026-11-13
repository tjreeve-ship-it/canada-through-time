// Follow the dollar: where federal money goes (Public Accounts), who receives grants and contributions, and who wins contracts.
// All amounts are published figures. Computations here are sums over published records, shares of a total, and amounts
// per resident (published population on July 1 inside each fiscal year). Agreement and contract values are commitments
// over their whole life, not one year's spending; every panel says so.
const BASE = document.documentElement.dataset.base || '..';
const J = u => window.__DATA?.[u] ? Promise.resolve(window.__DATA[u]) : fetch(u.replace(/^\.\.\//, BASE + '/')).then(r => { if (!r.ok) throw new Error(u); return r.json(); });
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const nf = (v, dp = 0) => v.toLocaleString('en-CA', { minimumFractionDigits: dp, maximumFractionDigits: dp });
const $ = v => { const a = Math.abs(v), s = v < 0 ? '−' : ''; return a >= 1e9 ? `${s}$${nf(a / 1e9, a >= 1e11 ? 0 : 1)}B` : a >= 1e6 ? `${s}$${nf(a / 1e6, a >= 1e8 ? 0 : 1)}M` : a >= 1e3 ? `${s}$${nf(a / 1e3, 0)}K` : `${s}$${nf(a)}`; };
const fyName = y => `${y - 1}–${String(y).slice(2)}`;
const pc = (a, b) => b ? nf(a / b * 100, a / b < 0.1 ? 1 : 0) + '%' : '—';
const PROVN = { NL: 'Newfoundland and Labrador', PE: 'Prince Edward Island', NS: 'Nova Scotia', NB: 'New Brunswick', QC: 'Quebec', ON: 'Ontario', MB: 'Manitoba', SK: 'Saskatchewan', AB: 'Alberta', BC: 'British Columbia', YT: 'Yukon', NT: 'Northwest Territories', NU: 'Nunavut', 'NT+NU': 'N.W.T. and Nunavut' };
const P13 = ['NL', 'PE', 'NS', 'NB', 'QC', 'ON', 'MB', 'SK', 'AB', 'BC', 'YT', 'NT', 'NU'];

let PA, G, C, POP, SHAPES, el, ready;
const S = { tab: 'spend', y: null, gy: 'all', cy: 'all', dept: null, sort: 'total' };
const TABS = [['spend', 'Where it goes'], ['grants', 'Grants and contributions'], ['contracts', 'Contracts']];

// population on July 1 inside a fiscal year (FY 2024–25 → July 1, 2024)
function popAt(g, fy) { const i = POP.dates.indexOf(`${fy - 1}-07-01`); return i >= 0 ? POP.series[g]?.[i] ?? null : null; }
const sumYears = (ys, sel) => Object.entries(ys).reduce((a, [y, [t, n]]) => sel === 'all' || +y === +sel ? [a[0] + t, a[1] + n] : a, [0, 0]);

// ---------------------------------------------------------------- shell
function build() {
  el = document.createElement('section'); el.id = 'mn'; el.className = 'world'; el.hidden = true; el.setAttribute('aria-label', 'Follow the dollar');
  el.innerHTML = `<header class="w-head"><div class="w-title"><span class="kick">Follow the dollar · Public Accounts and proactive disclosure</span><h1>Where Ottawa’s money goes</h1></div>
    <nav class="w-tabs" role="tablist" id="mn-tabs"></nav></header><div class="w-body" id="mn-body"></div>`;
  document.body.appendChild(el);
  el.addEventListener('click', e => {
    const t = e.target.closest('[data-mnt]'); if (t) { S.tab = t.dataset.mnt; S.dept = null; render(); el.querySelector('#mn-body').scrollTop = 0; return; }
    const d = e.target.closest('[data-dept]'); if (d) { S.dept = S.dept === d.dataset.dept ? null : d.dataset.dept; render(); return; }
    const y = e.target.closest('[data-fy]'); if (y) { const k = { spend: 'y', grants: 'gy', contracts: 'cy' }[S.tab]; S[k] = y.dataset.fy === 'all' ? 'all' : +y.dataset.fy; render(); return; }
    if (e.target.closest('[data-mnclear]')) { S.dept = null; render(); }
  });
  el.addEventListener('input', e => { if (e.target.id === 'mn-year') { S.y = +e.target.value; render(true); } });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !el.hidden && S.dept) { S.dept = null; render(); } });
}

// ---------------------------------------------------------------- charts (SVG)
// 12 standard objects folded into 7 groups for colour (categorical slots in fixed order); lists keep all 12 names
const GROUPS = [['Transfer payments', [9]], ['Staff (personnel)', [0]], ['Interest on public debt', [10]], ['Professional and special services', [3]],
  ['Other subsidies and payments', [11]], ['Equipment, buildings and land', [7, 8]], ['Day-to-day operations', [1, 2, 4, 5, 6]]];
const GCOL = i => `var(--cat-${i + 1})`;
const grouped = (vals12) => GROUPS.map(([n, ks], i) => [n, GCOL(i), ks.reduce((a, k) => a + (vals12[k] || 0), 0)]);
function stackChart(years, rows, { h = 180, cur, fmt = $, labels } = {}) {   // rows: [[label, colour, values-by-year]]
  const W = 900, tot = years.map((_, i) => rows.reduce((a, r) => a + Math.max(0, r[2][i] || 0), 0)), mx = Math.max(...tot) || 1, bw = W / years.length;
  const Y = v => h - v / mx * h;
  let bars = ''; years.forEach((y, i) => { let acc = 0; rows.forEach(([lab, col, vs]) => { const v = Math.max(0, vs[i] || 0); if (!v) return; bars += `<rect x="${i * bw + 1}" y="${Y(acc + v)}" width="${bw - 2}" height="${Y(acc) - Y(acc + v)}" fill="${col}" class="${+cur === +y ? 'cur' : ''}"><title>${fyName(y)} · ${esc(lab)}: ${fmt(v)}</title></rect>`; acc += v; }); });
  const ticks = [0, 0.5, 1].map(f => `<text x="${W + 4}" y="${Y(mx * f) + 4}" class="ax">${fmt(mx * f)}</text><line x1="0" x2="${W}" y1="${Y(mx * f)}" y2="${Y(mx * f)}" class="grid"/>`).join('');
  const last = years[years.length - 1], xl = years.filter((y, i) => i === 0 || y === last || (y % 5 === 0 && last - y >= 3)).map(y => `<text x="${(years.indexOf(y) + 0.5) * bw}" y="${h + 14}" text-anchor="middle" class="ax">${labels ? labels(y) : fyName(y)}</text>`).join('');
  return `<svg class="stack" viewBox="0 0 ${W + 60} ${h + 20}" role="img">${ticks}${bars}${xl}</svg>`;
}
function hbars(rows, { fmt = $, max, click, sel, note } = {}) {   // rows: [key, label, value, sub]
  const mx = max || Math.max(...rows.map(r => r[2]), 1);
  return `<div class="hb2">${rows.map(([k, lab, v, sub]) => `<button ${click ? `data-${click}="${esc(k)}"` : 'tabindex="-1"'} class="${sel === k ? 'on' : ''}"><span class="l">${esc(lab)}${sub ? `<i>${esc(sub)}</i>` : ''}</span><em style="--w:${Math.max(0.5, v / mx * 100)}%"></em><b>${fmt(v)}</b></button>`).join('')}</div>${note ? `<p class="note">${note}</p>` : ''}`;
}
function yearChips(years, cur, partial) {
  return `<div class="chips" role="group" aria-label="Fiscal year"><button data-fy="all" class="${cur === 'all' ? 'on' : ''}">All years</button>${years.map(y => `<button data-fy="${y}" class="${+cur === y ? 'on' : ''}">${fyName(y)}${partial?.includes(y) ? '*' : ''}</button>`).join('')}</div>`;
}
// small province map (SVG, the explorer's Lambert projection)
function provMap(values, fmt, title) {
  const vals = P13.map(g => values[g]).filter(v => v != null), mx = Math.max(...vals, 1);
  const fill = v => v == null ? 'var(--land-dim)' : `color-mix(in oklab, var(--seq-5) ${Math.round(Math.sqrt(v / mx) * 100)}%, var(--seq-1))`;   // more = towards the strong end (square root so mid-sized provinces stay visible)
  const paths = SHAPES.map(f => `<path d="${f.d}" fill="${fill(values[f.abbr])}"><title>${PROVN[f.abbr]}: ${values[f.abbr] == null ? 'no value' : fmt(values[f.abbr])}</title></path>`).join('');
  const labs = SHAPES.map(f => values[f.abbr] != null ? `<text x="${f.lx}" y="${f.ly}" text-anchor="middle" class="pl"><tspan>${f.abbr}</tspan><tspan x="${f.lx}" dy="13">${fmt(values[f.abbr])}</tspan></text>` : '').join('');
  return `<figure class="pmap"><figcaption>${title}</figcaption><div class="pkey"><span>less</span><i></i><span>more</span></div><svg viewBox="0 0 600 420" role="img" aria-label="${esc(title)}">${paths}${labs}</svg></figure>`;
}

// ---------------------------------------------------------------- tabs
function spend() {
  const ys = PA.years, y = S.y, i = ys.indexOf(y), T = PA.totals[y], tot = T.reduce((a, b) => a + b, 0) * 1e3, pop = popAt('CAN', y);
  const objRows = GROUPS.map(([n], gi) => [n, GCOL(gi), ys.map(yy => grouped(PA.totals[yy])[gi][2] * 1e3)]);
  const depts = PA.depts.map(d => [d.name, (d.v[y] || []).reduce((a, b) => a + b, 0) * 1e3, d]).filter(r => r[1] > 0).sort((a, b) => b[1] - a[1]);
  const D = S.dept && PA.depts.find(d => d.name === S.dept);
  const objNow = grouped(T).map(([n, col, v], gi) => [gi, n, v * 1e3]);
  return `<div class="w-grid">
    <section class="card mhero"><div class="yr"><b>${fyName(y)}</b><input id="mn-year" type="range" min="${ys[0]}" max="${ys[ys.length - 1]}" value="${y}" aria-label="Fiscal year"></div>
      <div class="bign">${$(tot)}</div><p class="lede">spent by federal ministries and agencies in fiscal ${fyName(y)}${pop ? `, about <b>${'$' + nf(tot / pop)}</b> for every person in Canada` : ''}.</p>
      <div class="objbar">${objNow.filter(r => r[2] > 0).map(([k, n, v]) => `<span style="flex:${v};background:${GCOL(k)}" title="${esc(n)}: ${$(v)}"></span>`).join('')}</div>
      <ul class="objleg">${objNow.filter(r => r[2] > 0).map(([k, n, v]) => `<li><i style="background:${GCOL(k)}"></i>${esc(n)} <b>${$(v)}</b> <em>${pc(v, tot)}</em></li>`).join('')}</ul></section>
    <section class="card wide"><h3>Spending by type, every year <small>Public Accounts, fiscal 2002–03 to 2025–26, current dollars</small></h3>${stackChart(ys, objRows, { cur: y })}
      <p class="note">Transfer payments are money paid to provinces, people and organizations (health and social transfers, Old Age Security, Canada Child Benefit, grants and contributions). Amounts are not adjusted for inflation or population.</p></section>
    <section class="card"><h3>Who spends it <small>${fyName(y)} · ${depts.length} ministries and agencies</small></h3>${hbars(depts.slice(0, 18).map(([n, v]) => [n, n, v]), { click: 'dept', sel: S.dept })}
      <p class="note">Click one to see its 24 years. Departments that were renamed or reorganized appear under each name used.</p></section>
    <section class="card">${D ? deptCard(D) : `<h3>Pick a department</h3><p class="note">Every department’s spending is split into the same 12 standard objects, so you can see whether it mostly pays staff, buys things, or sends money out as transfers.</p>
      <h4>Largest changes since the previous year</h4>${hbars(depts.map(([n, v, d]) => [n, n, v - ((d.v[y - 1] || []).reduce((a, b) => a + b, 0) * 1e3)]).filter(r => isFinite(r[2])).sort((a, b) => Math.abs(b[2]) - Math.abs(a[2])).slice(0, 8).map(r => [r[0], r[1], Math.abs(r[2]), r[2] >= 0 ? '▲ more' : '▼ less']), { click: 'dept', fmt: v => $(v), sign: true })}`}</section>
    ${srcCard('Receiver General for Canada, Public Accounts of Canada: ministerial expenditures by standard object (open.canada.ca, PSPC). Population: Statistics Canada 17-10-0009.', PA.notes)}
  </div>`;
}
function deptCard(D) {
  const ys = PA.years.filter(y => D.v[y]), rows = GROUPS.map(([n], gi) => [n, GCOL(gi), PA.years.map(y => D.v[y] ? grouped(D.v[y])[gi][2] * 1e3 : 0)]).filter(r => r[2].some(v => v > 0));
  const last = ys[ys.length - 1], lv = D.v[last].reduce((a, b) => a + b, 0) * 1e3;
  return `<div class="dt-h"><div><span class="kick">${esc(D.portfolio)}</span><h3>${esc(D.name)}</h3></div><button data-mnclear aria-label="Close">×</button></div>
    <p class="lede"><b>${$(lv)}</b> in ${fyName(last)} · listed ${ys.length} of ${PA.years.length} years under this name</p>
    ${stackChart(PA.years, rows, { h: 150, cur: S.y })}
    <ul class="objleg">${rows.map(([n, col, vs]) => `<li><i style="background:${col}"></i>${esc(n)} <b>${$(vs[PA.years.indexOf(last)])}</b></li>`).join('')}</ul>
    <p class="note">Standard objects grouped for colour: day-to-day operations = transportation and communications, information, rentals, repair and maintenance, utilities, materials and supplies.</p>`;
}

function grants() {
  const yrs = Object.keys(G.by_kind.C || {}).map(Number).concat(Object.keys(G.by_kind.G || {}).map(Number)).filter((y, i, a) => a.indexOf(y) === i && y >= 2008).sort((a, b) => a - b);
  const sel = S.gy, tot = Object.values(G.by_kind).reduce((a, ys) => a + sumYears(ys, sel)[0], 0), n = Object.values(G.by_kind).reduce((a, ys) => a + sumYears(ys, sel)[1], 0);
  const series = Object.entries(G.by_kind).filter(([k]) => G.agreement_types[k]).map(([k, ys]) => [G.agreement_types[k], k === 'C' ? 'var(--cat-1)' : k === 'G' ? 'var(--cat-2)' : k === 'O' ? 'var(--cat-3)' : 'var(--land-dim)', yrs.map(y => ys[y]?.[0] || 0)]);
  const prov = Object.fromEntries(P13.map(g => [g, G.by_prov[g] ? sumYears(G.by_prov[g], sel)[0] : null]));
  const perRes = Object.fromEntries(P13.map(g => { if (sel === 'all' || prov[g] == null) return [g, null]; const p = popAt(g, sel); return [g, p ? prov[g] / p : null]; }));
  const other = ['Not stated', 'Outside Canada', 'Batch reports'].map(k => [k, G.by_prov[k] ? sumYears(G.by_prov[k], sel)[0] : 0]);
  const recips = G.recipients.filter(r => r.prov !== 'Batch reports').map(r => [r.name, r.name, sel === 'all' ? r.t : r.by[sel] || 0, [r.city, r.prov].filter(Boolean).join(', ')]).filter(r => r[2] > 0).sort((a, b) => b[2] - a[2]).slice(0, 15);
  const types = Object.entries(G.by_type).map(([k, ys]) => [k, G.recipient_types[k] || k, sumYears(ys, sel)[0]]).sort((a, b) => b[2] - a[2]);
  const depts = Object.entries(G.by_dept).map(([k, ys]) => [k, k, sumYears(ys, sel)[0]]).sort((a, b) => b[2] - a[2]).slice(0, 10);
  const cities = G.cities.map(c => [c.name, c.name, sel === 'all' ? c.t : c.by[sel] || 0, PROVN[c.prov]]).filter(r => r[2] > 0).sort((a, b) => b[2] - a[2]).slice(0, 12);
  const big = G.largest.filter(b => sel === 'all' || b.fy === +sel).slice(0, 10);
  return `<div class="w-grid">
    <section class="card mhero"><div class="kick">${sel === 'all' ? 'All agreements disclosed' : 'Agreements starting in fiscal ' + fyName(sel)}</div>
      <div class="bign">${$(tot)}</div><p class="lede">committed in <b>${nf(n)}</b> grant and contribution agreements over $25,000. These are totals over each agreement’s life, often several years, not one year’s payments.</p>
      ${yearChips(yrs, sel, [2027])}</section>
    <section class="card wide"><h3>Value of agreements by the year they started <small>contributions, grants, other transfers</small></h3>${stackChart(yrs, series, { cur: sel })}<ul class="objleg row">${series.map(([n, col]) => `<li><i style="background:${col}"></i>${esc(n)}</li>`).join('')}</ul>
      <p class="note">Reporting expanded a lot from 2018, so earlier years are far from complete; don’t read the rise before 2018 as a rise in spending. * 2026–27 has only the months disclosed so far.</p></section>
    <section class="card">${provMap(sel === 'all' ? prov : perRes, sel === 'all' ? $ : v => '$' + nf(v), sel === 'all' ? 'Agreement value by recipient province, all years' : `Per resident, agreements starting ${fyName(sel)}`)}
      <p class="note">Province of the recipient’s address. Also: ${other.map(([k, v]) => `${k.toLowerCase()} ${$(v)}`).join(' · ')}. A recipient’s address is not always where the money is used (head offices, provincial governments).</p></section>
    <section class="card"><h3>Biggest recipients <small>${sel === 'all' ? 'all years' : fyName(sel)}</small></h3>${hbars(recips)}<p class="note">Names as disclosed; the same organization can appear under slightly different names. Excludes batch reports.</p></section>
    <section class="card"><h3>Who receives it</h3>${hbars(types)}<h3 class="mt">Which departments</h3>${hbars(depts)}</section>
    <section class="card"><h3>Recipient cities</h3>${hbars(cities)}</section>
    <section class="card wide"><h3>Largest single agreements <small>${sel === 'all' ? 'all years' : fyName(sel)}</small></h3>${table(big, ['Recipient', 'Program', 'Department', 'Year', 'Value'], b => [esc(b.name), esc(b.prog), esc(b.dept), fyName(b.fy), $(b.v)])}</section>
    ${srcCard('Government of Canada, Proactive Disclosure of Grants and Contributions (open.canada.ca), retrieved November 13, 2026. Population: Statistics Canada 17-10-0009.', G.notes.concat([`${nf(G.agreements)} agreements; each counted once at its latest amendment.`]))}
  </div>`;
}

function contracts() {
  const yrs = [...new Set(Object.values(C.by_proc).flatMap(ys => Object.keys(ys).map(Number)))].filter(y => y >= 2006).sort((a, b) => a - b);
  const sel = S.cy, tot = Object.values(C.by_proc).reduce((a, ys) => a + sumYears(ys, sel)[0], 0), n = Object.values(C.by_proc).reduce((a, ys) => a + sumYears(ys, sel)[1], 0);
  const tn = C.by_proc.TN ? sumYears(C.by_proc.TN, sel)[0] : 0, ns = C.by_proc['?'] ? sumYears(C.by_proc['?'], sel)[0] : 0;
  const PCOL = { TC: 'var(--cat-1)', OB: 'var(--cat-3)', ST: 'var(--cat-7)', AC: 'var(--cat-4)', TN: 'var(--cat-2)', '?': 'var(--land-dim)' };
  const series = ['TC', 'OB', 'ST', 'AC', 'TN', '?'].filter(k => C.by_proc[k]).map(k => [C.procedures[k], PCOL[k], yrs.map(y => C.by_proc[k][y]?.[0] || 0)]);
  const vendors = C.vendors.map(v => [v.name, v.name, sel === 'all' ? v.t : v.by[sel] || 0, v.dept]).filter(r => r[2] > 0).sort((a, b) => b[2] - a[2]).slice(0, 15);
  const depts = Object.entries(C.by_dept).map(([k, ys]) => [k, k, sumYears(ys, sel)[0]]).sort((a, b) => b[2] - a[2]).slice(0, 10);
  const objs = Object.entries(C.by_obj).map(([k, ys]) => [k, C.objects[k] || 'Code ' + k, sumYears(ys, sel)[0]]).sort((a, b) => b[2] - a[2]).slice(0, 10);
  const prov = Object.fromEntries(P13.map(g => [g, C.by_prov[g] ? sumYears(C.by_prov[g], sel)[0] : null])); const nn = C.by_prov['NT+NU'] ? sumYears(C.by_prov['NT+NU'], sel)[0] : 0;
  const procs = ['TC', 'OB', 'ST', 'AC', 'TN', '?'].filter(k => C.by_proc[k]).map(k => [k, C.procedures[k], sumYears(C.by_proc[k], sel)[0]]);
  const big = C.largest.filter(b => sel === 'all' || b.fy === +sel).slice(0, 10);
  return `<div class="w-grid">
    <section class="card mhero"><div class="kick">${sel === 'all' ? 'All contracts disclosed' : 'Contracts awarded in fiscal ' + fyName(sel)}</div>
      <div class="bign">${$(tot)}</div><p class="lede">in <b>${nf(n)}</b> contracts over $10,000, including amendments. <b>${pc(tn, tot)}</b> of that value is marked non-competitive${ns ? ` (and the award method isn’t stated for another ${pc(ns, tot)})` : ''}.</p>
      ${yearChips(yrs, sel, [2027])}</section>
    <section class="card wide"><h3>Contract value by the year first awarded, by how it was awarded</h3>${stackChart(yrs, series, { cur: sel })}
      <ul class="objleg row">${series.map(([n, col]) => `<li><i style="background:${col}"></i>${esc(n)}</li>`).join('')}</ul>
      <p class="note">A few very large multi-year contracts (shipbuilding, aircraft, building management) make some years jump. * 2026–27 has only the months disclosed so far.</p></section>
    <section class="card"><h3>Biggest vendors <small>${sel === 'all' ? 'all years' : fyName(sel)}</small></h3>${hbars(vendors)}<p class="note">Names as disclosed; one company can appear under several spellings.</p></section>
    <section class="card"><h3>How contracts were awarded</h3>${hbars(procs)}<h3 class="mt">What was bought</h3>${hbars(objs)}</section>
    <section class="card">${provMap(prov, $, 'Contract value by vendor province (from postal code)')}<p class="note">${nn ? `Postal codes starting with X (N.W.T. and Nunavut together): ${$(nn)}. ` : ''}Vendor address, not where the work happens.</p></section>
    <section class="card"><h3>Which departments</h3>${hbars(depts)}</section>
    <section class="card wide"><h3>Largest single contracts <small>${sel === 'all' ? 'all years' : fyName(sel)}</small></h3>${table(big, ['Vendor', 'What', 'Department', 'How', 'Year', 'Value'], b => [esc(b.name), esc(b.what), esc(b.dept), esc(C.procedures[b.proc] || b.proc), fyName(b.fy), $(b.v)])}</section>
    ${srcCard('Government of Canada, Proactive Publication of Contracts (open.canada.ca), retrieved November 13, 2026.', C.notes.concat([`${nf(C.contracts)} contracts; each counted once at its latest value.`]))}
  </div>`;
}
const table = (rows, head, f) => `<div class="tbl"><table><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${f(r).map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const srcCard = (src, notes) => `<section class="card wide src"><h4>Sources and method</h4><p>${esc(src)}</p><ul>${notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></section>`;

// ---------------------------------------------------------------- render
function render(fast) {
  writeHash();
  el.querySelector('#mn-tabs').innerHTML = TABS.map(([k, l]) => `<button role="tab" data-mnt="${k}" class="${S.tab === k ? 'on' : ''}" aria-selected="${S.tab === k}">${l}</button>`).join('');
  const body = el.querySelector('#mn-body'), st = body.scrollTop;
  body.innerHTML = ({ spend, grants, contracts })[S.tab]();
  if (fast) { body.scrollTop = st; const r = body.querySelector('#mn-year'); r?.focus(); }
}
function writeHash() { const h = `#mn=${S.tab}/${S.tab === 'spend' ? S.y : S.tab === 'grants' ? S.gy : S.cy}`; if (location.hash !== h) history.replaceState(null, '', h); }
function readHash() { const h = location.hash; if (!h.startsWith('#mn=')) return; const [t, y] = h.slice(4).split('/'); if (TABS.some(x => x[0] === t)) S.tab = t;
  const v = y === 'all' ? 'all' : +y; if (t === 'spend' && PA.years.includes(v)) S.y = v; if (t === 'grants' && y) S.gy = v; if (t === 'contracts' && y) S.cy = v; }
let prevHash = '';
async function open(opts = {}) {
  if (!el) build();
  if (!location.hash.startsWith('#mn=')) prevHash = location.hash;
  el.hidden = false; document.body.classList.add('nb-on');
  if (!ready) ready = Promise.all([J('../data/money/public_accounts.json'), J('../data/money/grants.json'), J('../data/money/contracts.json'), J('../data/population.json'), J('../data/provinces.geojson')]).then(([a, g, c, p, sh]) => {
    PA = a; G = g; C = c; POP = p; S.y = PA.years[PA.years.length - 1];
    // province outlines → SVG paths (StatCan Lambert metres → a 600×420 box)
    const [x0, y0, x1, y1] = [3.6e6, 0.25e6, 9.2e6, 4.95e6], k = Math.min(600 / (x1 - x0), 420 / (y1 - y0)), X = x => ((x - x0) * k).toFixed(1), Y = y => (420 - (y - y0) * k).toFixed(1);
    SHAPES = sh.features.map(f => { const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      const d = polys.map(poly => poly.map(ring => ring.filter((_, i) => i % 2 === 0 || i === ring.length - 1)).filter(r => r.length > 3).map(r => 'M' + r.map(q => X(q[0]) + ' ' + Y(q[1])).join('L') + 'Z').join('')).join('');
      return { abbr: f.properties.abbr, d, lx: +X(f.properties.lx), ly: +Y(f.properties.ly) }; });
  });
  await ready; readHash();
  if (opts.tab) S.tab = opts.tab;
  render();
}
function close() { el.hidden = true; document.body.classList.remove('nb-on'); history.replaceState(null, '', prevHash || location.pathname + location.search); dispatchEvent(new Event('nb-close')); }
window.MONEY = { open, close, _render: () => render(), get state() { return S; }, get data() { return { PA, G, C }; } };
if (location.hash.startsWith('#mn=')) open();
