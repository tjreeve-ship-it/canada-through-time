// App shell: one top bar for every part of the explorer, so moving between the map, neighbourhoods, climate and money is
// a single click and the current place is always clear.
const WORLDS = [
  ['map', 'Canada over time', 'Map', '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z M9 4v14 M15 6v14"/>'],
  ['nb', 'Neighbourhoods', 'Cities', '<path d="M3 21V9l5-3 5 3v12 M13 21V5l4-2 4 2v16 M6 12h4 M6 16h4 M16 9h2 M16 13h2 M16 17h2"/>'],
  ['cl', 'Climate', 'Climate', '<path d="M12 3a2 2 0 0 0-2 2v9.3a4 4 0 1 0 4 0V5a2 2 0 0 0-2-2z M12 10v7"/>'],
  ['mn', 'Follow the dollar', 'Money', '<path d="M12 2v20 M17 6.5c-1-1.5-2.8-2.5-5-2.5-2.8 0-5 1.6-5 3.8 0 5 10 2.6 10 7.8 0 2.2-2.2 3.9-5 3.9-2.4 0-4.4-1.1-5.3-2.8"/>'],
];
const API = { nb: () => window.CITIES, cl: () => window.CLIMATE, mn: () => window.MONEY };
const bar = document.createElement('header');
bar.id = 'shell';
bar.innerHTML = `<button class="brand" data-shell-home aria-label="Home"><span class="glyph" aria-hidden="true"><i></i><i></i><i></i></span><span class="bt">Canada <em>Through Time</em></span></button>
  <nav class="worlds" aria-label="Sections">${WORLDS.map(([k, l, s, ic]) => `<button data-world="${k}" aria-label="${l}"><svg viewBox="0 0 24 24" aria-hidden="true">${ic}</svg><span class="lg">${l}</span><span class="sm">${s}</span></button>`).join('')}</nav>
  <button class="find" data-shell-search aria-label="Search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><span>Search places, topics, years</span><kbd>/</kbd></button>`;
document.body.prepend(bar);
document.body.classList.add('has-shell');

let current = 'map';
function mark(k) { current = k; bar.querySelectorAll('[data-world]').forEach(b => { const on = b.dataset.world === k; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'page' : 'false'); }); }
function closeAll(except) { for (const [k, api] of Object.entries(API)) { if (k === except) continue; const a = api(), node = document.getElementById(k); try { if (a && node && !node.hidden) a.close(); } catch (e) { console.warn(e); } } }
async function go(k, opts) {
  window.CTX2?.closeHome?.();
  closeAll(k);
  if (k === 'map') { mark('map'); return; }
  mark(k); await API[k]()?.open(opts);
}
bar.addEventListener('click', e => {
  const w = e.target.closest('[data-world]'); if (w) { go(w.dataset.world); return; }
  if (e.target.closest('[data-shell-search]')) { closeAll(); mark('map'); window.CTX2?.openHome?.(true); return; }
  if (e.target.closest('[data-shell-home]')) { closeAll(); mark('map'); window.CTX2?.openHome?.(); }
});
// keep the highlight right when a world is opened another way (search result, home card, link)
const syncFromHash = () => { const h = location.hash; mark(h.startsWith('#nb=') ? 'nb' : h.startsWith('#cl=') ? 'cl' : h.startsWith('#mn=') ? 'mn' : 'map'); };
addEventListener('hashchange', syncFromHash);
addEventListener('nb-close', () => setTimeout(syncFromHash, 0));
new MutationObserver(() => { const open = ['nb', 'cl', 'mn'].find(k => { const x = document.getElementById(k); return x && !x.hidden; }); if ((open || 'map') !== current) mark(open || 'map'); })
  .observe(document.body, { subtree: true, attributes: true, attributeFilter: ['hidden'], childList: true });
syncFromHash();
window.SHELL = { go, mark };
