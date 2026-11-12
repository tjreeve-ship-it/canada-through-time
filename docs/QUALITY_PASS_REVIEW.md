# Explorer quality pass — review notes

Review build: `web/explore-qa/` (single-file copy: `dist/canada-through-time-explorer-qa.html`).
Baseline ("before"): `web/explore-next/`. The live Aurora explorer (`web/explore/`, published artifact) is untouched.
Nothing committed, published, or rendered. No new datasets.

## How to open it

- **Easiest:** double-click `canada-through-time-explorer-qa.html` (sent in chat; also copied to `Documents\canada-through-time\review\`). Works offline from `file://` — data, fonts and deck.gl are inlined. Checked in Chrome at 1440×900 and 390×844 with no console errors.
- **From the repo:** `cd web && python3 -m http.server 8000`, then open `http://localhost:8000/explore-qa/`.
- Palette switch: the existing palette control cycles Vintage → Paper → Glacier.

## Inspection — ranked red-team list (baseline, explore-next)

1. **Tablet widths (761–1100 px) crashed** (deck.gl viewport assertion) and the nav overlapped the headline.
2. **City labels collided** across the Windsor–Québec corridor; the selected city was hard to find.
3. **Charts showed shape only:** no exact values, gaps drawn as connected lines, no marks for method/survey breaks, short territorial series looked like errors.
4. **The large year dominated the reading block**; the finding sentence read awkwardly ("$75,800 2024 dollars, Calendar year…").
5. **Phone:** the legend sat on the map and the meta chip row was clipped at the right edge with no cue.
6. **No way to compare** two provinces or two cities.
7. **No entry point for newcomers** — 20+ layers with no question to start from.

## References (one line each)

- [WCAG 2.1 SC 1.4.11 Non-text Contrast](https://w3c.github.io/wcag21/understanding/non-text-contrast) — map marks, outlines and controls need 3:1 against neighbours; used for the selected-city halo and no-data swatch.
- [Datawrapper: choropleth maps](https://www.datawrapper.de/blog/choroplethmaps) — a legend with explicit stops and a single-hue lightness ramp reads better than many hues.
- [Datawrapper: colours for data vis](https://www.datawrapper.de/blog/colors) — vary lightness, not just hue, so palettes survive colour-blindness and greyscale.
- [NN/g: Tooltip guidelines](https://www.nngroup.com/articles/tooltip-guidelines/) — hover info must also work by keyboard and touch, and vital info shouldn't live only in a tooltip; hence the persistent chart readout.

## What changed

**Map and navigation**
- Tablet: bottom-sheet layout up to 1100 px; view fitting guarded against tiny regions (crash fixed).
- Phone: map fits below the reading block; meta chips now wrap instead of clipping.
- Reset is predictable: the map refits on layer/year changes until you move it yourself; ⌂ clears that.
- Zoom/pan bounds kept.
- City labels: screen-space collision placement with priority (selected > hovered > large CMAs > value). Phones label only the selected/hovered city. Labels re-place after the camera settles.
- City list: searchable; "not mapped" tag on the 3 CMAs without coordinates (Brantford, Guelph, St. Catharines–Niagara).
- Flows: aggregation note kept visible on phones.

**Comparison (places, not periods)**
- Province vs province and city vs city (rent, vacancy). Table shows value, flags, date, unit, and a difference only when both values exist and the measure supports one (level → absolute + %; change measures → absolute; percentage measures → percentage points).
- Missing values state why (territories not published; series ends 2022; territories from 2018 only; census years only; no published value). Footer: "A difference is an observation, not an explanation," with Source & method link.
- Comparison place drawn as a dashed overlay on the chart. State is in the URL.

**Charts**
- Exact value readout on hover, tap, and ← → keys (chart is focusable); readout falls back to the selected year.
- Units, dates, scope shown; gaps break the line; preliminary values hollow; "top of scale" noted.
- Breaks marked: 2019 rent method change; income survey changes 1993 (SLID) and 2012 (CIS); territorial series starts.
- Census measures (core housing need) are dots only — 2016 and 2021, never joined.
- Notes: series start, last published value, gaps, method caution.

**Starting questions ("Start here")**
- Five questions: How has Canada grown? / How much housing is being built? / What does rent cost? / Who can't afford their housing? / Where are people moving?
- Each card: what the measure shows, what it doesn't tell you, related layers. No conclusions offered. Card closes when you leave its layers.

**Typography**
- Newsreader (titles, numbers) + IBM Plex Sans (UI, prose). Year hero cut from a display giant to a 84 px italic (46 px phone) sitting under the title; place name 40 px; hero value 52 px.

## Palette comparison

Same real views (growth, rent cities, federal results, starts, flows, core need) at desktop and phone; see `palette_compare.png`.

| | Sequential L* range | Min adjacent ΔE (incl. CVD sims) | No-data vs lightest step | Notes |
|---|---|---|---|---|
| **Vintage** (current default) | 22–93 | 15.0 | 23.2 | Selected outline vs darkest step only 1.1:1 — the halo carries it. Russet may read as Liberal/NDP red. |
| **Paper** (light) | 89–20 | 18.2 | 9.3 → raised by darkening no-data grey | Best for print/light mode; low-value city dots weak on pale land. |
| **Glacier** (dark, blue/amber) | 30–95 | 16.8 | 26.1 | Cleanest lightness ramp; growth vs decline ΔE 85 under deuteranopia. Blue may echo Conservative. |

**Recommendation:** Glacier as the working dark palette, Paper as the light/print mode. Vintage remains the build default until you decide. Every palette risks a party association somewhere; the labels, not colour, carry meaning.

## Data integrity — confirmed

| Check | Status |
|---|---|
| Missing ≠ zero | Missing shown as no-data grey / hollow / "No published value … (reason)" |
| Suppressed stays suppressed | Yes (test: suppressed rents stay blank) |
| Preliminary/revised marked | Hollow dot + chip |
| Completions stop 2022 | Yes (test + "series ends in 2022") |
| Territories missing where uncovered | Yes, with reason |
| City-only not province-wide | Rent/vacancy only at CMAs; Canada figure labelled as CMA average |
| Starts vs household growth ≠ "shortage" | No such label anywhere |
| Income not a renter-affordability measure | Housing-path note: "income covers all family units, owners and renters. Not an affordability ratio." |
| 2019 rent break, income survey breaks visible | Marked on charts |
| Census data not annual | Dots, census years only; year clamps to nearest census year |
| Source, publisher, licence, dates, geography, formula, limits | Source & method panel, reachable from chips and comparison |

Checks run: `pytest tests` 43 passed; `tests/ui_check_explorer.py` 33/33 passed (incl. tablet 820 px, comparison, missing comparison, readout, arrow keys, income breaks, census dots, question card, dense-city labels, city search).

## Remaining issues / not done

- **Period-to-period comparison** (same place, two years) not built — only place vs place.
- **Label edges:** a city label can still overlap a province abbreviation (e.g. St. John's over PE at 1440 px).
- City list header truncates ("30 on the m…") at 1440 px.
- Phone map is width-limited, so there's some empty space between the legend and map.
- Paper palette: low-value city dots are faint on light land.
- Party-colour associations exist in all three palettes.
- Before/after phone income pair isn't like-for-like (sheet open vs collapsed).
