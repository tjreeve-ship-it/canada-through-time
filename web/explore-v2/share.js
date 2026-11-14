// Share: every view already has its own address; this button makes it easy to pass on. Copy the link, post it on X or
// Reddit, or save a picture of the map with its title and source written on it (map views only).
const SITE = 'Canada Through Time';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const txt = sel => (document.querySelector(sel)?.textContent || '').replace(/\s+/g, ' ').trim();
const shown = id => { const e = document.getElementById(id); return e && !e.hidden; };

// what is on screen: a title, a source line, and which map (if any) can be pictured
function current() {
  const h = location.hash;
  if (shown('ab')) return { title: 'About and sources', source: '', deck: null };
  if (shown('nb')) { const city = txt('#nb-h'), m = txt('#nb-read h2'); return { title: `${m}: ${city} neighbourhoods`, sub: '2021 Census, by census tract', source: 'Statistics Canada, 2021 Census of Population (98-401-X2021007)', deck: 'nb' }; }
  if (shown('cl')) { const mode = txt('#cl-modes .on'), yr = txt('#cl-y'), head = txt('#cl-side h2');
    return { title: head || `Climate: ${mode}`, sub: mode === 'Glaciers' ? 'Glacier-wide mass balance' : yr ? (yr.includes('–') ? `${yr} average` : yr) : '', source: mode === 'Glaciers' ? 'WGMS (2026), Fluctuations of Glaciers Database' : 'Environment and Climate Change Canada, AHCCD', deck: 'cl' }; }
  if (shown('mn')) { const tab = txt('#mn-tabs .on'), big = txt('#mn-body .bign'), lede = txt('#mn-body .mhero .lede'); return { title: `${tab}: ${big}`, sub: (lede.match(/^[^.]*\.(?!\d)/) || [lede])[0].replace(/\.$/, '').slice(0, 120), source: tab === 'Where it goes' ? 'Public Accounts of Canada' : 'Government of Canada proactive disclosure', deck: null }; }
  const t = txt('#r-title'), y = txt('#yearhero') || '', meta = txt('#r-meta');
  const place = txt('#sheet .place');
  return { title: [t, place && place !== 'Canada' ? place : ''].filter(Boolean).join(' · ') || SITE, sub: y, source: (meta.match(/(StatCan|IRCC|CMHC|Elections Canada|Statistics Canada)[^·]*/) || [''])[0].trim(), deck: 'map' };
}

// picture of a deck map: ask deck to draw once more and copy the canvas in the same frame (the drawing buffer is cleared after)
function snap(d) {
  return new Promise((res, rej) => {
    const orig = d.props.onAfterRender; let done = false;
    const t = setTimeout(() => { if (!done) { d.setProps({ onAfterRender: orig }); rej(new Error('no frame')); } }, 2500);
    d.setProps({ onAfterRender: (...a) => { orig?.(...a); if (done) return; done = true; clearTimeout(t);
      try { res(d.getCanvas().toDataURL('image/png')); } catch (e) { rej(e); } finally { setTimeout(() => d.setProps({ onAfterRender: orig }), 0); } } });
    d.redraw('share');
  });
}
const loadImg = src => new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = src; });
const css = n => getComputedStyle(document.body).getPropertyValue(n).trim() || null;
async function picture(info) {
  const d = window.__decks?.[info.deck]; if (!d) throw new Error('no map');
  const img = await crop(await loadImg(await snap(d)));
  const leg = legendOf(info.deck);
  const W = 1600, H = 1000, head = 150, foot = 64, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), page = css('--page') || '#efeadb', ink = css('--ink-1') || '#1f1d14', ink3 = css('--ink-3') || '#777', acc = css('--accent') || '#b8472f';
  g.fillStyle = page; g.fillRect(0, 0, W, H);
  // the map, scaled to fit between the title and the footer
  const aw = W - 80, ah = H - head - foot - 20, k = Math.min(aw / img.width, ah / img.height), iw = img.width * k, ih = img.height * k;
  g.drawImage(img, (W - iw) / 2, head + (ah - ih) / 2 + 6, iw, ih);
  const disp = (getComputedStyle(document.body).getPropertyValue('--font-display') || 'Georgia').trim(), ui = (getComputedStyle(document.body).getPropertyValue('--font-ui') || 'sans-serif').trim();
  g.fillStyle = acc; g.font = `600 22px ${ui}`; g.fillText(SITE.toUpperCase(), 48, 56);
  g.fillStyle = ink; g.font = `500 50px ${disp}`; let title = info.title; while (g.measureText(title).width > W - 96 && title.length > 10) title = title.slice(0, -2); if (title !== info.title) title += '…'; g.fillText(title, 48, 112);
  if (info.sub) { g.fillStyle = ink3; g.font = `400 24px ${ui}`; g.fillText(info.sub.slice(0, 110), 48, 142); }
  if (leg) drawLegend(g, leg, 48, H - foot - 92, ui, ink, ink3, page);
  g.fillStyle = ink3; g.font = `400 20px ${ui}`; g.fillText(`Data: ${info.source || 'see the About page'}`, 48, H - 26);
  g.textAlign = 'right'; g.fillText(window.SHARE_HOST || (location.host + location.pathname).replace(/\/(index\.html)?$/, '') || 'Canada Through Time', W - 48, H - 26);
  return c;
}

// trim the empty margin around the map (the map canvases are transparent where nothing is drawn)
async function crop(img) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const { data } = g.getImageData(0, 0, c.width, c.height); let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
  for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) if (data[(y * c.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 <= x0 || y1 <= y0 || (x1 - x0) * (y1 - y0) > c.width * c.height * 0.92) return img;
  const p = 16; x0 = Math.max(0, x0 - p); y0 = Math.max(0, y0 - p); x1 = Math.min(c.width, x1 + p); y1 = Math.min(c.height, y1 + p);
  const o = document.createElement('canvas'); o.width = x1 - x0; o.height = y1 - y0; o.getContext('2d').drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
  return loadImg(o.toDataURL('image/png'));
}
// the colour key, copied from the legend on screen: its title, its colours and its end labels
function legendOf(which) {
  const el = document.querySelector(which === 'map' ? '#legend' : which === 'nb' ? '#nb-legend' : '#cl-legend'); if (!el) return null;
  const title = (el.querySelector('.cap, .lg-t, b')?.textContent || '').trim();
  let cols = [...el.querySelectorAll('.bar span')].map(s => s.style.background).filter(Boolean);
  if (!cols.length) { const bar = el.querySelector('.lg-bar'); cols = (bar?.style.background.match(/rgb\([^)]+\)/g)) || []; }
  const ticks = [...el.querySelectorAll('.ticks span, .lg-ax span')].map(s => s.textContent.trim()).filter(Boolean);
  return title || cols.length ? { title, cols, lo: ticks[0] || '', hi: ticks[ticks.length - 1] || '' } : null;
}
function drawLegend(g, L, x, y, ui, ink, ink3, page) {
  const w = 420; g.save(); g.fillStyle = page; g.globalAlpha = 0.92; g.fillRect(x - 12, y - 30, w + 24, L.cols.length ? 96 : 44); g.globalAlpha = 1;
  g.fillStyle = ink; g.font = `600 19px ${ui}`; g.textAlign = 'left'; let t = L.title; if (g.measureText(t).width > w) { while (g.measureText(t + '…').width > w && t.length > 8) t = t.slice(0, -1); t += '…'; } g.fillText(t, x, y);
  if (L.cols.length) { const bw = w / L.cols.length; L.cols.forEach((c, i) => { g.fillStyle = c; g.fillRect(x + i * bw, y + 12, bw + 0.6, 16); });
    g.fillStyle = ink3; g.font = `400 17px ${ui}`; g.fillText(L.lo, x, y + 50); g.textAlign = 'right'; g.fillText(L.hi, x + w, y + 50); }
  g.restore();
}

// ---------------------------------------------------------------- UI
const bar = document.getElementById('shell');
const btn = document.createElement('button'); btn.className = 'sharebtn'; btn.setAttribute('aria-label', 'Share this view'); btn.title = 'Share this view';
btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3 M7 8l5-5 5 5 M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg><span>Share</span>';
bar?.insertBefore(btn, bar.querySelector('[data-shell-about]'));
const pop = document.createElement('div'); pop.id = 'sharepop'; pop.hidden = true; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Share this view'); document.body.appendChild(pop);
function open() {
  window.CTX2?.closeHome?.();
  const info = current(), url = location.href, text = info.title + (info.sub ? ` (${info.sub})` : '');
  pop.innerHTML = `<div class="sp-h"><b>Share this view</b><button data-spx aria-label="Close">×</button></div>
    <p class="sp-t">${esc(text)}</p>
    <div class="sp-link"><input readonly value="${esc(url)}" aria-label="Link to this view"><button data-spcopy>Copy link</button></div>
    <div class="sp-row">
      <a class="sp-b" target="_blank" rel="noopener" href="https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}">Post on X</a>
      <a class="sp-b" target="_blank" rel="noopener" href="https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}">Reddit</a>
      ${navigator.share ? '<button class="sp-b" data-spnative>More…</button>' : ''}
      ${info.deck ? '<button class="sp-b" data-sppic>Save picture</button>' : ''}</div>
    <p class="sp-note">The link opens exactly this view: same section, measure, year and place.</p><div class="sp-msg" aria-live="polite"></div>`;
  pop.hidden = false; pop._info = info;
  const r = btn.getBoundingClientRect(); pop.style.top = r.bottom + 8 + 'px'; pop.style.right = Math.max(8, innerWidth - r.right - 60) + 'px';
}
const msg = m => { const e = pop.querySelector('.sp-msg'); if (e) e.textContent = m; };
btn.addEventListener('click', () => pop.hidden ? open() : (pop.hidden = true));
document.addEventListener('click', e => { if (!pop.hidden && !pop.contains(e.target) && !btn.contains(e.target)) pop.hidden = true; });
addEventListener('keydown', e => { if (e.key === 'Escape') pop.hidden = true; });
addEventListener('hashchange', () => { pop.hidden = true; });
pop.addEventListener('click', async e => {
  if (e.target.closest('[data-spx]')) { pop.hidden = true; return; }
  if (e.target.closest('[data-spcopy]')) { const inp = pop.querySelector('input');
    try { await navigator.clipboard.writeText(inp.value); msg('Link copied.'); } catch { inp.select(); try { document.execCommand('copy'); msg('Link copied.'); } catch { msg('Select the link and copy it.'); } } return; }
  if (e.target.closest('[data-spnative]')) { try { await navigator.share({ title: pop._info.title, url: location.href }); } catch { } return; }
  if (e.target.closest('[data-sppic]')) {
    msg('Drawing the picture…');
    try { const c = await picture(pop._info); const a = document.createElement('a'); a.download = (pop._info.title.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 60) || 'canada-through-time') + '.png';
      a.href = c.toDataURL('image/png'); document.body.appendChild(a); a.click(); a.remove(); msg('Picture saved.'); }
    catch (err) { console.warn(err); msg('Couldn’t draw the picture here. Copy the link instead.'); }
  }
});
window.SHARE = { current, picture, open };
