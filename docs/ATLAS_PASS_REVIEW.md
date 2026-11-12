# Atlas pass — lighter direction, palette picker, terrain study

Review build: `web/explore-atlas/` (single file: `dist/canada-through-time-explorer-atlas.html`).
Based on `web/explore-final/`. The live explorer, `explore-qa` and `explore-final` are untouched. Nothing committed or published. No new topic datasets; one context source added (shaded relief).

## How to open it

- Double-click `canada-through-time-explorer-atlas.html` (also in `Documents\canada-through-time\review\`). Works offline.
- From the repo: `cd web && python3 -m http.server 8000`, then `http://localhost:8000/explore-atlas/`.
- **Colours and map surface:** the round three-colour button beside the map controls (3D, ⌂). Pick any of eight palettes and one of three surfaces; the choice is remembered on that device and kept in the link (`?p=ember&tx=relief`).

## What I saw first (ranked, from the rendered explore-final build)

1. Dark only. Low values are dark marks on dark land, and there was no daylight/video-friendly light option in the build.
2. Nothing guides the eye to the active layer: the selected pill is the same cream as all other text.
3. Large flat land on city, flow and people views — the map reads as an empty plate.
4. Province dollar values touch (Saskatchewan/Manitoba).
5. "Then and now" was a 50-item dropdown that didn't show which years exist, and it pushed the city list off the first screen.
6. Tablet province abbreviations were small.
7. Year in a light serif still pulled against the title.

## Decisions applied

- **Type: T2, Source Serif 4 + Public Sans** (confirmed in code: `.ty-civic`). Serif for titles, place names and the year; Public Sans for everything else; tabular lining figures in tables, legends, the year and the date control; no weights under 400; no letter-spaced capitals. French accents and place-name glyphs verified in the font files.
- **Title and year:** desktop title 33 px semibold, year 50 px in the same serif at reduced strength with a short accent rule under it. Phone: year sits on the title line at the same size, quieter.
- **Default palette: Field Paper · Ember.** Field Paper with a deeper low end (so pale values hold on light land), darker no-value grey, and a muted reddish orange (`#B8472F`) used only for the active layer pill, the active group underline, the year rule, history markers and method-change ticks. It is never a data colour. On the election layer the accent switches to ink so it cannot read as a party colour.

## Palettes in the picker

| Palette | Mode | "More" ramp | "Less" | Smallest neighbour step* | Low dot vs land |
|---|---|---|---|---|---|
| **Field Paper · Ember** (default) | light | straw → olive | lavender | 12.0 | 1.39:1 + dark ring |
| Field Paper (original) | light | pale straw → olive | lavender | 11.1 | 1.12:1 |
| Lichen | light | mint → deep teal | clay | 11.9 | 1.39:1 + dark ring |
| Heather | light | pink-mauve → plum | moss | 11.7 | 1.40:1 + dark ring |
| Aurora Night | dark | navy → teal → pale gold | clay | 10.4 | ring |
| Tuscan Dusk | dark | plum → peach → cream | sage | 13.0 | ring |
| Glacier | dark | blue → ice | amber | (earlier build) | ring |
| Deep Vintage | dark | russet → cream | sea-glass | (earlier build) | ring |

*Colour difference (CAM02-UCS), worst case across normal vision and simulated deuteranopia, protanopia, tritanopia; about 10+ is comfortably distinct. All palettes: main text ≥ 14:1, quiet text ≥ 4.8:1. Election colours are identical in every palette.

Judgement beyond the numbers: Ember and Lichen are the two that hold up on every view. Heather is distinctive but its mid-plum is the closest of the new ones to a "party-ish" hue (minor parties only). Glacier's blue and Vintage's russet remain the ones most likely to be read politically; they are kept as options, not recommended.

## Terrain and texture study

Same map, same data, three surfaces (see `texture_comparison.png`):

1. **Plain** — cleanest; city and people views look empty.
2. **Paper grain** — a non-data noise over the whole page. Adds warmth, but also slightly greys text panels and does nothing for the map itself.
3. **Shaded relief** — real terrain. **Recommended and set as default.**

Relief source and handling:
- **Source:** Natural Earth "Shaded Relief Basic", 1:50m, v2.0.0 (`SR_50M.tif`). **Licence:** public domain. Natural Earth derived it from downsampled SRTM Plus elevation.
- **Resolution / coverage:** 10,800 × 5,400 px world grid (2 arc-minutes, about 3.7 km); all of Canada covered.
- **Processing** (`pipeline/build_relief.py`): resampled to a 3 km grid in the map's projection (EPSG:3347), clipped to the map's own province outlines, stored as a transparent overlay (dark where the hillshade is darker than flat ground, light where lighter). Linear contrast only; nothing invented.
- **Registered** in `registry/sources.yaml` as `naturalearth_sr50m` with its SHA-256 and limitations.
- **Caveats stated in the product:** the picker says relief is physical geography for context and does not show the selected statistic. It is a generalised cartographic hillshade (small islands were embossed by Natural Earth), not a measuring surface.
- **Kept subordinate:** drawn under boundaries, labels, city marks, spikes and flows. 50% strength where land carries no data (cities, flows, people); 16% where provinces are coloured by data or party, so it cannot shift a fill by a legend step. It does not move, resize or recolour any mark.

## Polish

- **Province value labels:** collision-checked; a label that would touch its neighbour is staggered (Manitoba drops below Saskatchewan on dollar measures). If no position fits, the value is hidden and the abbreviation stays; the value remains in tooltip, panel and ranking.
- **City list:** now directly under the city's headline value, above the comparison controls.
- **Tablet abbreviations:** 13 px (were 10.5).
- **Then and now date control:** a slider that stops only on published dates, with a strip beneath showing which years have a value and where a method change falls; the chosen date reads out beside the label; works with arrow keys. Measures with few dates (census) get one button per date. Comparison rules unchanged: no difference across survey or geography changes; current-dollar note kept.
- **Low-value city dots:** deeper low end plus a dark ring on light palettes.

## Remaining issues

- Palette or surface changes reload the page (about a second) rather than switching live.
- Relief at 16% is barely visible on dark fills — deliberate, but it means choropleths look flatter than city views.
- Paper grain covers text panels as well as the map.
- Light palettes: territories on income 2024 sit above the top of the scale and read as one dark block (true to the data; the scale tops out at $90K+).
- The 3D spike columns and flow arcs were not restyled in this pass.
- Dark palettes were checked on two views each in this pass, not the full set.

## Checks run

- `pytest tests`: 43 passed (includes the registry test with the new relief source and its fingerprint).
- `PAGE=explore-atlas/index.html python3 tests/ui_check_explorer.py`: 48/48 passed. New checks in this pass: date buttons for census and short series, slider keyboard use, no overlapping province value labels on a dollar measure, eight palettes and three surfaces in the picker, accent not used on the election layer, relief drawn below data marks. The keyboard check caught a real bug (arrow keys on the new slider also moved the main timeline), now fixed.
- 40 matching views rendered at 1440×900, 834×1112 and 390×844 with no page errors; 49 palette, texture and control views likewise.
- Single-file build opened from `file://` with a non-default palette; relief and picker present.
- Not re-run after the last one-line keyboard fix: the 40-view screenshot set (the fix does not affect rendering).
