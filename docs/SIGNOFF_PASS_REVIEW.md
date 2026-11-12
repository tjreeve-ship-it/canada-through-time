# Visual sign-off pass — before video pilots

Review build: `web/explore-signoff/` (single file: `dist/canada-through-time-explorer-signoff.html`).
Copied from `web/explore-atlas/`. The live explorer, `explore-qa`, `explore-final` and `explore-atlas` are untouched. Nothing committed or published. No datasets added.

## How to open it

- Double-click `canada-through-time-explorer-signoff.html` (also in `Documents\canada-through-time\review\`). Works offline.
- From the repo: `cd web && python3 -m http.server 8000`, then `http://localhost:8000/explore-signoff/`.

## What I inspected

Rendered in headless Chrome and viewed at full size: people (3D spikes), migration flows (national and British Columbia), population change, federal seats, Toronto rent, income 2024 with and without a territory selected — each at 1440×900, 834×1112 and 390×844, before (atlas) and after (sign-off). Aurora Night was viewed on spikes, flows, income and population change. Every page rendered without errors. Not viewed at full size in this pass: the six "review only" palettes on the new spike/flow treatments (they share the same code).

## Population spikes — changed, because phone and tablet were not readable

Found in the atlas build:
- **Phone and tablet:** the camera looked almost straight down, so columns were short stubs. Ontario (16.3M) and British Columbia (5.7M) looked nearly the same height, and no values were shown. The height encoding was effectively invisible.
- **All sizes:** each column sat in a soft grey disc; in the Maritimes three discs merged into one smudge.

Changed:
- Phones and tablets tilt the camera for the people and flow layers so columns are seen from the side (other layers keep the near-top-down view that fills the screen).
- Values are shown on phone and tablet for the people layer (staggered or dropped on collision; always in the panel).
- The grey disc is a thin base ring; each column has a lit top face.
- Relief is drawn at 36% under spikes and flows (was 50%).

Not changed: height is still 70 km per million people, same positions, same colour. A check confirms the Ontario/Quebec height ratio equals their population ratio exactly. Relief is a flat overlay beneath the columns; it adds no height.

## Migration flows — changed, two real problems

Found:
- The two directions between a pair (Alberta→BC and BC→Alberta) were drawn on exactly the same path, so one hid the other and overlaps looked blotchy.
- On light palettes the legend said "Bright end = destination" while the destination end was the dark end.

Changed:
- Each direction bows to its own side, so pairs sit side by side. Arcs are smoother.
- Legend says "Dark end = destination" on light palettes ("Bright end" on dark) and notes the side-by-side drawing.
- Phones draw arcs at 0.6× width so they don't cover the map.

Not changed: width still follows the square root of people moving; colour meaning (leaving / arriving) is the same; the "12 largest of 156 flows (63% of all moves)" note is still shown on every screen size. Arcs are wide, curved and coloured, unlike the thin dark province boundaries and the grey relief.

## Values beyond the colour scale

- **On the map:** a ▲ after the value (▼ for below the bottom of the scale). On phones, where values aren't labelled, the ▲ follows the abbreviation ("NT ▲").
- **In the legend:** the bar end is pointed, and a line names each place with its exact value, e.g. "▲ Above the colour scale (colour stops at $90,000; values are exact): Northwest Territories $116,100 · Nunavut $109,600". More than four are summarised and marked in the list.
- **In the panel:** a selected place says "▲ above the map's colour scale ($90,000); the value is exact". City lists carry the same marker.
- Values are untouched (checked: N.W.T. 116,100 and Nunavut 109,600 in the data).

Other layers: I checked every layer and year. 13 of 17 colour scales are exceeded somewhere (for example core housing need: Nunavut 47.2% against a 15% top; vacancy above 8% in 32 years; Alberta's +206% against a +200% top). The same treatment applies to all of them automatically. Population density flags the combined N.W.T./Nunavut as below scale every year before 1991 (0.01 people per km² against a 0.02 bottom); the scales themselves were not changed in this pass.

## Relief as context

- Layer order verified by check: relief is beneath boundaries, city marks, spike rings, spikes and flow arcs; labels draw last.
- It is a transparent image; it cannot move, resize or recolour a mark. Strength: 50% on plain land (cities), 36% under spikes and flows, 16% under data-coloured provinces.
- Identified in two places: the picker note, and a new "Map surface · context only" section in Source & method with publisher, dataset, link, licence, retrieval date and limitations.
- Resolution wording corrected everywhere (picker, registry, pipeline notes): the source is Natural Earth 1:50m (2 arc-minute cells, about 3.7 km north–south), itself downsampled and generalised. The 3 km grid is a convenient cell size; **resampling adds no detail**.

## Palette arrangement for release

- **Light: Field Paper · Ember** (default, unchanged).
- **Dark: Aurora Night.** Of the four dark palettes it has the highest text contrast (15.7:1), a ramp that resembles no party colour, and the most distinct identity from Ember. Tuscan Dusk's warm end leans toward election red; Glacier is blue; Deep Vintage is russet (see `dark_theme_candidates.png`).
- The picker now groups these two as "proposed themes" and the other six as "review only". Election colours are identical in every palette.

## Known issues re-checked

- Province value labels: no overlapping pairs on the dollar measure at desktop (automated check) and none seen on tablet, where values are now shown.
- City list: directly under the headline value. No change needed.
- Tablet abbreviations: 13 px, readable. No change needed.
- Clipping: none seen at the three sizes in the views above.

## Still imperfect

- Phone people map is busy: eight values plus abbreviations on a 390 px map. Legible, not elegant.
- Value labels on very dark fills (light palette, top of scale) are readable through their outline but look heavy.
- On phones the flow legend's side-by-side note runs on the same line as the swatches.
- Density's "below scale" marker on the pre-1991 territories is correct but appears for many years; widening that one scale would remove it.
- Changing palette or surface still reloads the page.

## Recommendation

The two signature treatments now read clearly at all three sizes, over-scale values are explicit, and the relief is documented as context. I recommend freezing this as the visual checkpoint: Field Paper · Ember with shaded relief as the look for the first pilots, Aurora Night as the dark alternative.

## Checks run (re-run at hand-off)

- `pytest tests`: 43 passed.
- `PAGE=explore-signoff/index.html python3 tests/ui_check_explorer.py`: 59/59 passed (includes spike height ratio, layer order with relief beneath marks, over-scale markers and exact values, palette grouping, phone and tablet fit).
- Viewed at full size at hand-off: people, British Columbia flows and income 2024 at desktop, tablet and phone; Ontario selected on phone. Viewed at reduced size only: national flows, federal seats, population change and Toronto rent on desktop.
- The single-file build was written at 22:07, after the last source change (21:59).
