# Housing and cost-of-living bundle, plus three palettes — review package

Prototype: `web/proto3/index.html?p=vintage|beach|tuscan` (the live Aurora explorer in `web/explore/` is unchanged). Nothing committed or published.

## 1. Source inventory and feasibility

All tables verified through Statistics Canada's Web Data Service metadata on 2026-11-11, downloaded as full-table CSV zips, stored unmodified in `data/raw/statcan/`, and registered with SHA-256 hashes in `registry/sources.yaml`.

| Question | Source (table) | Publisher | Coverage | Frequency | Geography | Used as | Status |
|---|---|---|---|---|---|---|---|
| Population | 17-10-0009-01 | Statistics Canada | 1971–2026 (July 2026 preliminary) | Quarterly | Canada, provinces, territories | Denominator for rates | In use (existing) |
| Households | 17-10-0159-01 | Statistics Canada | 2006–2025 (2025 preliminary) | Annual, July 1 | Canada, provinces, territories | Household growth layer; households added per year | **Added** |
| Starts, under construction, completions | 34-10-0126-01 | CMHC via StatCan | Starts 1955–2025; **completions and under construction end 2022** | Annual | Canada and 10 provinces (no territories) | Starts per 1,000 layer; path chart | **Added** |
| Rental vacancy | 34-10-0127-01 | CMHC via StatCan | 1971–2025, each CMA from a different year | Annual (October) | 36 CMAs + CMA average; no provinces | City point layer | **Added** |
| Average rent | 34-10-0133-01 | CMHC via StatCan | 1987–2025 | Annual (October) | 247 centres; no provinces | City point layer (2-bedroom, row + apartment 3+) | **Added** |
| Rent and shelter prices | 18-10-0005-01 | Statistics Canada | Canada 1914/1949–2025; provinces 1979–2025 | Annual average | Provinces; territories only as cities | Rent vs all prices layer (from 2019); path chart | **Added** |
| Income | 11-10-0190-01 | Statistics Canada | Provinces 1976–2024; territories 2018–2024 | Annual | Canada, provinces, territories | Median after-tax income layer; path chart | **Added** |
| City positions | Natural Earth populated places | Natural Earth | n/a | n/a | Points | Places each CMA at its core city | **Added** |

**Licences.** Statistics Canada tables are covered by the Statistics Canada Open Licence. CMHC tables are covered by the CMHC Licence Agreement for the Use of Data, which allows reuse and redistribution as long as the data are reproduced accurately, the source is acknowledged clearly, and nothing implies CMHC endorsement. Natural Earth is public domain.

**Considered and not used yet:**
- **Core housing need** (39-10-0048, 2006–2021, census years only). Valuable, but it is a census-year series with a different universe. It's the best next affordability measure.
- **Starts and completions in centres of 10,000+** (34-10-0136, quarterly, to 2026). Could extend completions past 2022, but it covers a different universe (small centres excluded), so it can't be joined to the all-areas series without a visible break.
- **New Housing Price Index** (18-10-0205) and **Canadian Housing Survey** affordability tables. Next candidates.

## 2. What the layers show (actual data)

| Layer | Form | Measure | Scale | Evidence level |
|---|---|---|---|---|
| Housing starts | Map (provinces) | Starts ÷ July 1 population × 1,000 | Sequential | Derived (two official tables) |
| Household growth | Map | % change in private households since 2006 | Diverging, neutral ±1% | Derived |
| Rental vacancy | City points | % of purpose-built apartments vacant, October | Sequential | Official statistic |
| Average rent, 2-bedroom | City points | Current dollars per month | Sequential | Official statistic |
| Rent prices vs all prices | Map | CPI rent ÷ all-items CPI, change since 2019 | Diverging, neutral ±1% | Derived |
| Median after-tax income | Map | 2024 constant dollars | Sequential | Official statistic |
| Housing path (place panel) | Two charts | Households added vs starts and completions; real rent index vs real income, 1979 = 100 | — | Observed comparison |

**Exploration path:** pick a province, and the panel walks through:
1. Households added each year vs homes started and completed.
2. Rent prices relative to all prices, beside real median income.
3. A link to the city layers for vacancy and market rents.

A selected city shows its vacancy history and its two-bedroom rent history.

**Observed comparisons, with no causal claim:**
- **Canada, 2007–2025:** about 4.09 million starts against about 4.05 million households added (2006→2025).
- **Ontario:** about 1.40 million starts against 1.54 million households added.
- **Alberta:** 636,000 starts against 608,000 households added.

These are not measures of shortage. Starts are not completions, completions aren't net of demolitions, households exclude collective dwellings, and the periods differ by six months.

**Rents since 2019 (the current CPI method):**
- The rent index rose 8.2% more than all prices in Canada, 7.2% more in Ontario, and 17.2% more in Nova Scotia.
- The average CMA vacancy rate went from 1.9% in 2022 to 3.3% in 2025.

## 3. Data gaps, discrepancies and how they are shown

- **Completions end in 2022** in the all-areas table, while starts run to 2025. The chart labels the completions line "(ends 2022)"; it is never extended.
- **No territorial starts, completions or CPI rent at territory level.** Those are drawn dimmed as "no data", listed in the legend, and explained in the coverage chip; never shown as zero.
- **Vacancy and rents exist only for cities.** They are drawn as points on the core city, with a chip reading "30 of 33 cities mapped". Brantford, Guelph and St. Catharines–Niagara aren't in the Natural Earth place file, so they are named but not drawn.
- **Suppressed rents** (CMHC flag F, "too unreliable to publish") stay blank and say so in the tooltip and panel.
- **CPI rent method change, January 2019.** Statistics Canada moved from matched units to a hedonic model (62F0014M2019002). The map layer starts in 2019; the long-run chart marks 2019 with a dashed "method change" line. The CPI rent index covers all tenants, including renewals, so it rises more slowly than market rents. That is why the city rent layers sit next to it.
- **Income and rent universes differ.** Median income covers all family units, owners and renters together. There is no rent-to-income ratio anywhere; the two are shown as separate lines, both inflation-adjusted.
- **Preliminary data.** 2025 households and July 2026 population are flagged preliminary.
- **Income series breaks** in 1993 and 2012, when the underlying survey changed. These are recorded in the registry but not yet drawn on the chart. To do.

## 4. Palettes

Each palette is a complete token system: page, sky, sea, land, no-data, boundaries, text (3 levels), panel, selection, history markers, sequential ramp (5 steps), decline arm (3), neutral, and spikes. Each has been checked on Population, Change since 1971, Migration flows, Federal seats and Housing starts, on desktop and phone.

**Text contrast (WCAG) against the page:**

| Palette | Main text | Secondary | Muted |
|---|---|---|---|
| Deep Vintage | 13.8 | 10.1 | 6.7 |
| Beachfront | 12.2 | 7.0 | 5.1 (after darkening; it was 3.8) |
| Tuscan Sunset | 15.7 | 10.7 | 6.1 |

**How the reference colours were adapted:**
- **Deep Vintage:** petrol `#244855` → sky/sea; sea-glass `#90AEAD` → boundaries and the decline arm; russet `#874F41` → coral → cream `#FBE9D0` → the magnitude/growth ramp.
  - Coral `#E64833` started as the selection colour, but it sat inside the data ramp and vanished on coral provinces. Selection is now a warm white over a dark halo, and coral is kept for historical markers.
- **Beachfront:** parchment `#EDE8D0` page; dusty blue `#ABBDED` lightened for the sea; lavender `#DBD1ED` deepened into a 5-step violet ramp, because lavender alone is too light to carry magnitude on parchment; olive `#6E632E` for decline and boundaries.
  - The muted text was darkened to pass contrast.
- **Tuscan Sunset:** plum `#9988A1` deepened for the sky and land.
  - The first ramp (rust → vermilion `#E35336` → peach) was almost indistinguishable from Vintage, and it read as election red. I replaced it with a plum → peach sunset ramp and a cool sage decline arm (not in the reference set; added so decline doesn't read as "bad red").

**Neutrality:** growth and decline arms use different hue families of similar weight; neither is red or green. Party colours appear only on the election layer, with names. No palette is fully free of party associations (every hue belongs to some party), so meaning always comes with labels and a legend.

**Recommendation: Deep Vintage.**
- It's the most distinctive and coastal-Canadian of the three, and the most legible on the dark composition.
- It keeps one clear meaning per colour family: warm for magnitude and growth, sea-glass for decline, white for selection, coral for history.
- It works across choropleths, points, arcs and spikes.

Beachfront is the best daylight/print variant, and could become the paper theme for exports. Tuscan Sunset is handsome but the darkest and lowest-contrast between land and low data values.

## 5. Walkthrough video notes (Video of Canada Data Project 2.mp4, live Aurora)

- Zooming out can shrink the map to a thin strip (the 2003 frame). The zoom-out limit should stop at the whole country.
- Migration flows at the national level is a tangle of near-white arcs. It should open with a province suggested, or show net flows by default.
- At full-HD desktop the labels, timeline and panel text read small. The proto3 type sizes address most of this.

## 6. Proposed next sequence

1. Approve the palette (or adjust it), then apply it to the live explorer's tokens. One pass.
2. Fold the housing bundle into the live explorer behind the "Housing and cost of living" chapter; add the ledger and checker entries for any housing claim before it is used in a story.
3. Add core housing need (2016, 2021) as the affordability measure, with a census-year marker.
4. Decide whether to extend completions to 2025 with the 10,000+ centres table (shown as a separate, labelled series).
5. Fix zoom limits and the national flows default from the video review.
