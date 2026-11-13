// How to use: a short guided tour for each part of the explorer. It runs once, the first time someone opens that part,
// and again whenever they press the "?" button in the top bar. Each step points at the real control it describes.
const phone = () => matchMedia('(max-width: 900px)').matches;
const STEPS = {
  map: () => [
    { t: 'Canada, province by province', b: 'The map shows one measure for every province and territory, starting with population. Hover or tap a province for its number. This quick tour shows the controls.', sel: null },
    phone() ? { t: 'Pick what to map', b: 'Tap here to choose a topic: people, money, the economy, housing or elections.', sel: '#layer-btn' }
      : { t: 'Pick what to map', b: 'Choose a section, then a topic, then a measure. There are over 60, from population and rent to federal transfers and election results.', sel: '#layers' },
    phone() ? { t: 'Travel through time', b: 'Press play or drag the year to watch Canada change since 1971.', sel: '#mtl' }
      : { t: 'Travel through time', b: 'Press play, or drag the slider, to watch the map change year by year since 1971. Dots on the line mark events.', sel: '#timeline' },
    phone() ? null : { t: 'Click a province', b: 'The panel on the right shows its full history for the measure you picked, where the number comes from, and how it compares with the rest of Canada.', sel: '#sheet' },
    phone() ? null : { t: 'Other ways to look at it', b: 'Switch from the map to a ranking, a scatter of two measures, small trend charts, a side-by-side comparison, or the change between two years.', sel: '#viewbar' },
    { t: 'Go deeper', b: 'Neighbourhoods inside 50 cities, climate since the 1800s, and where federal money goes each have their own section.', sel: '#shell .worlds' },
    { t: 'Or just ask', b: 'Search for a place, a topic or a year, like “Alberta unemployment 2010”. Press ? any time to see this tour again.', sel: '#shell .find' },
  ].filter(Boolean),
  nb: () => [
    { t: 'Inside your city', b: 'Each shape is a census tract: a neighbourhood of about 2,500 to 8,000 people. The colour shows how much of the chosen measure it has.', sel: '#nb-map', pad: -40 },
    { t: 'Pick a city', b: 'All 50 cities with census tracts, from Toronto to Wood Buffalo.', sel: '#nb-city' },
    phone() ? { t: 'Pick what to show', b: 'Income, rent, age, where people were born, language and more.', sel: '#nb-mselect' }
      : { t: 'Pick what to show', b: 'Income, rent, age, immigrants by country of birth, visible minority groups, language, education and more. All from the 2021 Census.', sel: '#nb-ms' },
    { t: 'Click a neighbourhood', b: 'Its full profile appears, next to the city average. Grey areas have no published value: Statistics Canada suppresses small or low-response areas.', sel: phone() ? '#nb-detail' : '#nb-dt' },
    phone() ? null : { t: 'Compare cities', b: 'The same measure for all 50 cities. Click one to jump there.', sel: '#nb-rank' },
  ].filter(Boolean),
  cl: () => [
    { t: 'Every dot is a weather station', b: 'Colour shows how much warmer or colder it was than that station’s own 1961–1990 average. Hollow dots had no reading for that period.', sel: '#cl-map', pad: -40 },
    { t: 'Play the years', b: 'Press play to run from 1900 to 2020. The 10-year average smooths out single odd years.', sel: '#cl-time' },
    { t: 'Four views', b: 'Temperature, precipitation, each station’s long-term warming trend, and the glaciers measured every year.', sel: '#cl-modes' },
    { t: 'Click a station', b: 'See every year it recorded since it opened, with its 1961–1990 average.', sel: '#cl-detail' },
  ],
  mn: () => [
    { t: 'Three ways to follow the money', b: 'What every department spends, the grants and contributions it hands out, and the contracts it signs.', sel: '#mn-tabs' },
    { t: 'Change the year', b: 'Drag to any year since 2002–03. Grants and contracts use year buttons instead.', sel: '#mn-body .mhero' },
    { t: 'Click a department', b: 'See 24 years of its spending, split into staff, transfers, services, equipment and more.', sel: '#mn-body .hb2' },
    { t: 'Read the fine print', b: 'Each page ends with exactly where the numbers come from and how they were counted, so you can check them.', sel: '#mn-body .src' },
  ],
};

let st = null;
const root = document.createElement('div'); root.id = 'tour'; root.hidden = true;
root.innerHTML = '<div class="t-spot"></div><div class="t-card" role="dialog" aria-modal="true" aria-labelledby="t-title"><div class="t-step"></div><h3 id="t-title"></h3><p></p><div class="t-btns"><button class="t-skip">Skip tour</button><span></span><button class="t-back">Back</button><button class="t-next">Next</button></div></div>';
document.body.appendChild(root);
const spot = root.querySelector('.t-spot'), card = root.querySelector('.t-card');
root.querySelector('.t-skip').onclick = () => end();
root.querySelector('.t-back').onclick = () => show(st.i - 1);
root.querySelector('.t-next').onclick = () => st.i >= st.steps.length - 1 ? end() : show(st.i + 1);
addEventListener('keydown', e => { if (!st) return; if (e.key === 'Escape') end(); if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); root.querySelector('.t-next').click(); } if (e.key === 'ArrowLeft') show(st.i - 1); }, true);
addEventListener('resize', () => st && show(st.i));

const visible = el => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 4 && r.height > 4 && getComputedStyle(el).visibility !== 'hidden'; };
function show(i) {
  if (!st) return; i = Math.max(0, Math.min(st.steps.length - 1, i));
  // skip steps whose control is not on screen (e.g. a panel that only appears later)
  const ok = s => !s.sel || visible(document.querySelector(s.sel));
  const dir = i >= st.i ? 1 : -1; let k = i; while (k >= 0 && k < st.steps.length && !ok(st.steps[k])) k += dir;
  if (k < 0 || k >= st.steps.length) { if (dir > 0) return end(); k = st.i; }
  st.i = k; const s = st.steps[k], el = s.sel && document.querySelector(s.sel), pad = s.pad ?? 6;
  if (el) { const q = el.getBoundingClientRect(); if (q.top < 70 || q.bottom > innerHeight - 10) el.scrollIntoView({ block: q.height > innerHeight * 0.6 ? 'start' : 'center' }); }   // bring it into view inside scrolling pages
  const r = el ? el.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2 - 40, width: 0, height: 0 };
  spot.style.opacity = el ? 1 : 0; root.classList.toggle('dim', !el);
  const box = { x: Math.max(4, r.left - pad), y: Math.max(4, r.top - pad), w: Math.min(innerWidth - 8, r.width + 2 * pad), h: Math.min(innerHeight - 8, r.height + 2 * pad) };
  Object.assign(spot.style, { left: box.x + 'px', top: box.y + 'px', width: box.w + 'px', height: box.h + 'px' });
  card.querySelector('.t-step').textContent = `${k + 1} of ${st.steps.length}`;
  card.querySelector('h3').textContent = s.t; card.querySelector('p').textContent = s.b;
  card.querySelector('.t-back').hidden = k === 0; card.querySelector('.t-next').textContent = k === st.steps.length - 1 ? 'Done' : 'Next';
  // place the card beside the highlighted area: below, above, right or left, whichever fits; else centred
  const cw = Math.min(el ? 340 : 420, innerWidth - 24); card.style.width = cw + 'px'; const ch = card.offsetHeight || 170, m = 14; let x, y;
  if (!el) { x = innerWidth / 2 - cw / 2; y = innerHeight / 2 - ch / 2; } else
  if (box.y + box.h + m + ch < innerHeight) { y = box.y + box.h + m; x = box.x + box.w / 2 - cw / 2; }
  else if (box.y - m - ch > 60) { y = box.y - m - ch; x = box.x + box.w / 2 - cw / 2; }
  else if (box.x + box.w + m + cw < innerWidth) { x = box.x + box.w + m; y = box.y + box.h / 2 - ch / 2; }
  else if (box.x - m - cw > 0) { x = box.x - m - cw; y = box.y + box.h / 2 - ch / 2; }
  else { x = innerWidth / 2 - cw / 2; y = innerHeight - ch - 24; }
  Object.assign(card.style, { left: Math.max(12, Math.min(innerWidth - cw - 12, x)) + 'px', top: Math.max(70, Math.min(innerHeight - ch - 12, y)) + 'px' });
  card.querySelector('.t-next').focus({ preventScroll: true });
}
function start(world, auto) {
  const steps = STEPS[world]?.(); if (!steps?.length) return;
  if (auto) { try { if (localStorage.getItem('ctt-tour-' + world)) return; } catch (e) { return; } }
  try { localStorage.setItem('ctt-tour-' + world, '1'); } catch (e) { }
  const shown = steps.filter(s => !s.sel || visible(document.querySelector(s.sel)));   // number only the steps that can be shown
  st = { world, steps: shown.length ? shown : steps, i: 0 }; root.hidden = false; document.body.classList.add('touring');
  requestAnimationFrame(() => show(0));
}
function end() { st = null; root.hidden = true; document.body.classList.remove('touring'); }
// first visit to each part: wait until it has drawn, then start
// automated checks (headless browsers) don't get the automatic tour unless the address asks for it with ?tour
const noAuto = navigator.webdriver && !new URLSearchParams(location.search).has('tour');
function maybe(world) { if (noAuto || document.body.classList.contains('studio') || document.body.classList.contains('home-on')) return; setTimeout(() => { if (!st && !document.body.classList.contains('home-on')) start(world, true); }, world === 'map' ? 900 : 1300); }
window.TOUR = { start, end, maybe, get active() { return st?.world || null; } };
