// About and sources: who made this, how the numbers are handled, every source with its licence and attribution,
// and how to report a mistake. The source list is built from the project's registry, the same file the pipeline uses to
// check every raw file, so it can't drift from what the explorer actually shows.
const BASE = document.documentElement.dataset.base || '..';
const J = u => window.__DATA?.[u] ? Promise.resolve(window.__DATA[u]) : fetch(u.replace(/^\.\.\//, BASE + '/')).then(r => { if (!r.ok) throw new Error(u); return r.json(); });
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmtDate = d => { const t = new Date(d + 'T12:00:00'); return isNaN(t) ? d : t.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }); };
const linkOf = s => s.landing_url || (s.doi ? (s.doi.startsWith('http') ? s.doi : 'https://doi.org/' + s.doi) : '');

let REG, el, ready, prevHash = '';
const ORDER = ['Statistics Canada', 'Immigration, Refugees and Citizenship Canada (IRCC)', 'Canada Mortgage and Housing Corporation (CMHC), via Statistics Canada', 'Environment and Climate Change Canada',
  'Public Services and Procurement Canada (Receiver General)', 'Treasury Board of Canada Secretariat (departmental disclosures)', 'Elections Canada', 'Library of Parliament', 'World Glacier Monitoring Service (WGMS)', 'Natural Earth'];

function build() {
  el = document.createElement('section'); el.id = 'ab'; el.className = 'world'; el.hidden = true; el.setAttribute('aria-label', 'About and sources');
  el.innerHTML = `<header class="w-head"><div class="w-title"><span class="kick">About</span><h1>About and sources</h1></div><nav class="w-tabs" id="ab-tabs"><button data-abj="ab-what" class="on">What this is</button><button data-abj="ab-rules">How numbers are handled</button><button data-abj="ab-src">Sources</button><button data-abj="ab-fix">Report a mistake</button></nav></header><div class="w-body" id="ab-body"></div>`;
  document.body.appendChild(el);
  el.addEventListener('click', e => { const j = e.target.closest('[data-abj]'); if (j) { el.querySelector('#' + j.dataset.abj)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); el.querySelectorAll('[data-abj]').forEach(b => b.classList.toggle('on', b === j)); } });
}
function render() {
  const srcs = Object.entries(REG).map(([id, s]) => ({ id, ...s }));
  const pubs = [...new Set(srcs.map(s => s.publisher))].sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99));
  const latest = srcs.map(s => s.retrieved).filter(Boolean).sort().pop();
  const card = s => `<li class="srow"><div class="st"><b>${esc(s.title)}</b>${s.table_id ? ` <span class="tid">${esc(s.table_id)}</span>` : ''}</div>
      <div class="smeta">${[s.reporting_period, s.retrieved ? 'retrieved ' + fmtDate(s.retrieved) : '', s.units].filter(Boolean).map(esc).join(' · ')}</div>
      <div class="sa">${esc(s.attribution || '')}</div>
      <div class="sl">${linkOf(s) ? `<a href="${esc(linkOf(s))}" target="_blank" rel="noopener">Source page ↗</a>` : ''}${s.licence ? `<span>Licence: ${s.licence_url ? `<a href="${esc(s.licence_url)}" target="_blank" rel="noopener">${esc(s.licence)}</a>` : esc(s.licence)}</span>` : ''}</div>
      ${(s.limitations || []).length ? `<details><summary>Limitations</summary><ul>${s.limitations.map(l => `<li>${esc(l)}</li>`).join('')}</ul></details>` : ''}</li>`;
  el.querySelector('#ab-body').innerHTML = `<div class="ab">
    <section id="ab-what" class="ab-s"><h2>What this is</h2>
      <p class="big">Canada Through Time is a free, independent explorer of official Canadian data: people, places, money and climate, mostly from 1971 to today.</p>
      <p>It is made by <b>The Canadian Data Project</b> (<a href="https://x.com/CanadaAnalytics" target="_blank" rel="noopener">@CanadaAnalytics</a> on X, and on YouTube). It is not affiliated with, or endorsed by, the Government of Canada, Statistics Canada, CMHC, Elections Canada or any other source listed here. The sources’ use of their data here does not mean they endorse this site.</p>
      <p>It has four parts: <b>Canada over time</b> (provinces and territories year by year), <b>Neighbourhoods</b> (census tracts in 50 cities, 2021 Census), <b>Climate</b> (Environment Canada weather stations and measured glaciers), and <b>Follow the dollar</b> (federal spending, grants and contracts). Press <b>?</b> in the top bar on any page for a quick tour.</p>
      <p class="muted">Data last retrieved ${latest ? fmtDate(latest) : '—'}. ${srcs.length} sources.</p></section>
    <section id="ab-rules" class="ab-s"><h2>How numbers are handled</h2>
      <ol class="rules">
        <li><b>Every number comes from a source file.</b> Each raw file is downloaded once, fingerprinted (SHA-256) and checked again every time the data is rebuilt. Numbers are computed by code from those files, never typed in by hand.</li>
        <li><b>Missing is not zero.</b> When a value is suppressed, not collected or not yet published, it is shown as blank, grey or hollow, never as 0 and never filled in by guessing.</li>
        <li><b>Preliminary is labelled.</b> Estimates that the source will revise are marked preliminary where they appear.</li>
        <li><b>Only simple, stated arithmetic.</b> Sums, differences, shares, per-person figures and averages, each explained where it’s shown. No forecasts, no models, no adjustments the source didn’t make.</li>
        <li><b>Side by side, not cause and effect.</b> Two things shown together are not claimed to be connected. Where a change in how data was collected could look like a real change (for example, grant disclosure rules in 2018), the page says so.</li>
        <li><b>Non-partisan.</b> No party, government or position is favoured. Dates of governments are shown for context only.</li>
        <li><b>Tested.</b> Automated checks compare the explorer’s data against the raw files, and every page, measure and year is opened in a browser to look for errors before each update.</li>
      </ol></section>
    <section id="ab-src" class="ab-s"><h2>Sources</h2>
      <p>Contains information licensed under the <a href="https://open.canada.ca/en/open-government-licence-canada" target="_blank" rel="noopener">Open Government Licence – Canada</a> and the <a href="https://www.statcan.gc.ca/en/reference/licence" target="_blank" rel="noopener">Statistics Canada Open Licence</a>. Glacier data: WGMS (2026), Fluctuations of Glaciers Database, World Glacier Monitoring Service, Zurich, Switzerland, doi:10.5904/wgms-fog-2026-02-10. Base map: Natural Earth (public domain).</p>
      ${pubs.map(p => `<h3>${esc(p)} <small>${srcs.filter(s => s.publisher === p).length}</small></h3><ul class="slist">${srcs.filter(s => s.publisher === p).sort((a, b) => (a.title > b.title) - (a.title < b.title)).map(card).join('')}</ul>`).join('')}</section>
    <section id="ab-fix" class="ab-s"><h2>Report a mistake</h2>
      <p>If a number looks wrong, send a message to <a href="https://x.com/CanadaAnalytics" target="_blank" rel="noopener">@CanadaAnalytics</a> on X with the page link (the address bar keeps your exact view) and what you expected. Corrections are checked against the source and fixed in the next update.</p>
      <p class="muted">Privacy: this site uses no cookies and no ads. Your browser remembers only whether you’ve seen the home screen and each tour.</p></section>
  </div>`;
}
async function open(opts = {}) {
  if (!el) build();
  if (!location.hash.startsWith('#about')) prevHash = location.hash;
  el.hidden = false; document.body.classList.add('nb-on');
  if (!ready) ready = J('../data/explorer/registry.json').then(r => { REG = r; render(); });
  await ready;
  if (location.hash !== '#about') history.replaceState(null, '', '#about');
  if (opts.section) el.querySelector('#' + opts.section)?.scrollIntoView({ block: 'start' }); else el.querySelector('#ab-body').scrollTop = 0;
}
function close() { el.hidden = true; document.body.classList.remove('nb-on'); history.replaceState(null, '', prevHash || location.pathname + location.search); dispatchEvent(new Event('nb-close')); }
window.ABOUT = { open, close };
if (location.hash === '#about') open();
