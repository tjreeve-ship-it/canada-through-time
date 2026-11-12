# Final explorer pass — review notes

Review build: `web/explore-final/` (single file: `dist/canada-through-time-explorer-final.html`).
Before: `web/explore-qa/`. The live explorer (`web/explore/`) and `explore-qa` are untouched. Nothing committed or published. No new datasets.

## How to open it

- Double-click `canada-through-time-explorer-final.html` (also in `Documents\canada-through-time\review\`). Works offline.
- From the repo: `cd web && python3 -m http.server 8000`, then `http://localhost:8000/explore-final/`.
- Alternatives stay available by adding to the address: `?p=field`, `?p=dusk`, `?p=vintage` (palette) and `&t=civic`, `&t=grotesk` (type). Default is Aurora Night + Newsreader/Plex.
- `palette-and-type-study.html` is the side-by-side gallery at full size.

## Baseline critique (ranked, from 40 rendered views of explore-qa)

1. Phone, sheet half open: the selected place was hidden under the sheet.
2. "No published value" looked broken: near-empty chart, wrong legend wording ("no data in this table" for a place that is in the table from 2018).
3. Label collisions: St. John's over PE, Kitchener-Cambridge-Waterloo over NS, "Conservative 13" over "Conservative 7"; phone labels cut off at the edge.
4. Tablet cropped Newfoundland and PE.
5. Phone wasted the top third; the map was small.
6. Clipped text: city-list header, long source chip on phone, panel row hints.
7. Year dominated; letter-spaced capitals in the nav; smudgy label outlines.
8. "Not mapped", "no data", "not surveyed", "suppressed" used unrelated styles.
9. One russet ramp for everything, close to Liberal red; no-data barely different from plain land.
10. No same-place, two-date comparison.

## Palette study

Three directions, each rendered on population change, housing starts, city vacancy, migration flows and federal seats, desktop and phone (see gallery).

| | Aim | Smallest neighbour step (worst case incl. colour-blind sims) | Main / quiet text contrast | Verdict |
|---|---|---|---|---|
| **A · Aurora Night** | Northern, non-partisan: navy → teal → sea-glass → pale gold; clay for "less" | 10.4 | 15.7 / 6.6 | **Recommended** |
| B · Field Paper | Light atlas page: straw → olive; lavender for "less" | 11.1 | 14.0 / 4.8 | Best light option; pale low values fade on city dots |
| C · Tuscan Dusk | Warm night: plum → mauve → peach → cream; sage for "less" | 13.0 | 15.4 / 6.1 | Handsome; mid-tones sit near the land colour, warm end leans toward election red |

Why Aurora: no data ramp resembles a party colour, so the election layer reads as a different kind of map; low and high values separate in both large fills and small dots; neither end of the growth/decline scale reads as "good" or "bad". Known weakness: the darkest step is close to the land colour (1.2:1), so low-value city dots rely on their light ring.

Map lighting is now neutral for the new palettes so a province's colour matches its legend swatch.

## Typography study

All three share: upright year in a quieter tone (56 px desktop, inline with the title on phones), sentence-case navigation, tabular figures in tables/legends/year, nothing lighter than regular weight. All faces cover French accents (checked é è ê ë à â ç î ï ô û ù ü œ and the glyphs used in place names).

| | Character | Trade-off |
|---|---|---|
| **T1 · Newsreader + IBM Plex Sans** | Editorial atlas; figures align | Titles are the most delicate of the three on a phone. **Recommended** |
| T2 · Source Serif 4 + Public Sans | Sturdy, institutional | Reads more like a government report |
| T3 · Schibsted Grotesk + IBM Plex Sans | Modern news app | Least distinctive; its tabular period is too wide for headline values |

## Changes

- **Map fit:** the camera now measures Canada's real outline and fits it to the free area. Tablet no longer crops the east; phone maps fill the width and open near top-down (the 3D button still tilts).
- **Phone, sheet up:** the reading block collapses to title, year and scale, and the map refits above the sheet, so the selected place stays visible.
- **City labels:** avoid province abbreviations and screen/panel edges; try the other side before dropping; the selected city always gets a label. Unlabelled cities remain in the list, search and tooltips.
- **Election map:** labels use party codes (LPC, CPC…), spelled out in the legend.
- **No published value:** stippled on the map and in the legend; panel says "Not published", the reason, and "Nothing is estimated or filled in"; the chart starts where that place's series starts and notes the selected year is before it.
- **Status vocabulary:** value ●, not surveyed ○, suppressed Ⓕ, not on map (dashed tag), no published value (stipple) — same in legend, list and panel, including on phones.
- **Clipping:** city-list header shortened ("All 33 areas · 2025 — 30 on the map"); panel row hints and long source chips wrap.
- **Then and now:** pick another date for the same place and measure (provinces and cities). Only dates with a published value are offered; census measures offer census years only. No difference is shown across a marked survey change or a change of geography; current-dollar differences say they are not inflation-adjusted. The second date is ringed on the chart and saved in the link (`@2015`).

## Transparency checks

Unchanged and re-verified by tests: missing ≠ zero; suppressed stays blank; completions end 2022; territories missing where uncovered; core housing need on census years only; 2019 rent and 1993/2012 income breaks marked; starts-vs-households "not a measure of shortage"; income "not an affordability ratio"; "does not show that one caused another" notes; Source & method reachable from chips, comparisons and each then-and-now value.

## Checks run

- `pytest tests`: 43 passed.
- `PAGE=explore-final/index.html python3 tests/ui_check_explorer.py`: 42/42 passed (the 33 existing checks plus new ones for stipple/no-value wording, then-and-now, French glyphs, phone fit and selected city above the sheet).
- 40 after-views rendered with no console errors at 1440×900, 834×1112, 390×844.
- Single-file build opened from `file://`.

## Remaining issues

- Aurora's lowest step is dark; low-value city dots depend on their ring.
- On desktop, adding "Then and now" pushes the city list lower in a selected city's panel (scroll to reach it).
- Phone map labels show only the selected/hovered city by design; others via list and search.
- Tablet province abbreviations are small.
- Hover-only chart readout on desktop has keyboard and tap equivalents, but the comparison pickers are plain dropdowns with long date lists.
- The then-and-now difference for inflation-adjusted or index measures is shown as published; no extra adjustment is made.
- Province value labels can still touch where provinces are narrow (Saskatchewan/Manitoba at 1440 px on dollar measures).
