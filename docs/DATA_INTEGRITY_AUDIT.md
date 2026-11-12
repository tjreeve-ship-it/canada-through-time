# Data integrity audit — every layer in the sign-off build

Audited build: `web/explore-signoff/` (visual checkpoint `checkpoints/visual-signoff-2026-11-11`). Audit date: 2026-11-11. No data or code in the build was changed by this audit.

## Method

1. **What the explorer shows:** every value for every layer, place and year was read out of the running page itself (`tools/audit_dump_displayed.py` → `audit/displayed.json`).
2. **What the sources say:** the same values were recomputed directly from the raw downloaded files (`tools/audit_layers.py`). This script does not use the project's pipeline or its processed files, so a pipeline mistake cannot hide.
3. The two were compared value by value in both directions: shown-but-not-in-source (silent fills) and in-source-but-not-shown (silent drops). Results: `audit/layer_audit.json`.
4. Raw files are fingerprinted (SHA-256) in `registry/sources.yaml` and checked by the test suite (43 tests pass).

Not covered: whether Statistics Canada, CMHC or the Library of Parliament have published newer versions since the files were retrieved on 2026-11-11, and the event/prime-minister timeline text.

## Result in one table

| Layer | Values compared | Mismatches | Shown but not in source | In source, not shown | Status |
|---|---|---|---|---|---|
| People | 765 | 0 | 0 | 0 | **Ready** |
| Change since 1971 | 752 | 0 | 0 | 0 | **Ready** |
| Growth in the past year | 750 | 0 | 0 | 0 | **Ready** |
| People per km² | 765 | 0 | 0 | 0 | **Ready** |
| Share of Canadians | 765 | 0 | 0 | 0 | **Ready** |
| Natural increase | 750 | 0 | 0 | 0 | **Ready** |
| Immigrants | 750 | 0 | 0 | 0 | **Ready** |
| Temporary residents (net) | 750 | 0 | 0 | 0 | **Ready** |
| Emigration (net) | 750 | 0 | 0 | 0 | **Ready** |
| Moves between provinces | 723 | 0 | 27 (Canada = 0) | 0 | Ready after minor fix (C3) |
| Migration flows (province figure) | 723 | 0 | 27 (Canada = 0) | 0 | Ready after minor fix (C3, C6) |
| Migration flows (origin → destination) | 8,075 | 0 | 0 | 0 | **Ready** |
| Federal election seats | 473 | 0 vs file | 0 | 0 | **Needs correction (C1, C2)** |
| Housing starts | 594 | 0 | 0 | 0 | **Ready** |
| Housing completions | 561 | 0 | 0 | 0 | **Ready** |
| Household growth | 266 | 0 | 0 | 0 | **Ready** |
| Rental vacancy (cities + CMA average) | 1,608 | 0 | 0 | 0 | **Ready** |
| Average rent, 2-bedroom (cities) | 1,122 | 0 | 0 | 0 | Ready after minor fix (C5) |
| Rent prices vs all prices | 66 | 0 | 0 | 0 | **Ready** |
| Core housing need | 28 | 0 | 0 | 0 | Ready; one decision open (R1) |
| Median after-tax income | 560 | 0 | 0 | 0 | Ready after minor fix (C4) |

About 19,900 displayed values were compared. Every one matches its source file exactly. No interpolated or filled values were found.

## Corrections needed

**C1 — Federal seats, 2025: two members are missing from the source file, and it changes the map. (Must fix before release.)**
The Library of Parliament file retrieved on 2026-11-11 lists 341 of 343 members elected on April 28, 2025: 42 of British Columbia's 43 and 9 of New Brunswick's 10. In the file British Columbia is tied, Conservative 19 – Liberal 19, and the map labels it "CPC 19". The published result is Liberal 20, Conservative 19, NDP 3, Green 1 ([2025 federal election in British Columbia](https://en.wikipedia.org/wiki/2025_Canadian_federal_election_in_British_Columbia); to be confirmed against Elections Canada when fixing). So the explorer currently shows British Columbia's largest party wrongly, and the national line "Liberal … 168 seats" is one short for the Liberals and one short for another party. The build does show "341 of 343 seats recorded", but that does not tell a viewer the colour is wrong.
Fix: re-download the file; if two members are still absent, reconcile against Elections Canada's official results and record the reconciliation in the registry.

**C2 — Federal seats: ties are shown as a win. (Must fix before release.)**
Ten province-elections have two parties tied for most seats (e.g. New Brunswick 1972 and 1988, Saskatchewan 1980 and 1993, Nova Scotia 2000 and 2011). The map colours the province for whichever party is listed first. Fix: a distinct "tied" treatment and wording.

**C3 — Moves between provinces / flows: Canada is given 0 where the source has no figure. (Minor.)**
For Canada the code substitutes 0 when the source has no net interprovincial value. The panel already says moves "cancel out for Canada as a whole" and shows no number, but the underlying value should be "not applicable", not 0.

**C4 — Income: Statistics Canada's quality grades are not shown. (Minor.)**
The source grades each estimate by sampling variability: A excellent, B very good, C good, D acceptable, E use with caution, F too unreliable to publish. In the series used, 290 are A, 80 are B, 3 are C (Nunavut 2020 and 2021, Northwest Territories 2021), 187 ungraded, and none are D, E or F. Nothing shown is unreliable, but the grade should be visible where it is below B.

**C5 — City rent: the legend lists "suppressed", but no value in this series is suppressed. (Minor.)**
For the 33 metropolitan areas and the unit type used, the source has no F-flagged values (missing years are "not available"). The suppressed marker should only appear when it applies.

**C6 — Migration flows: the province figure comes from a different table than the one cited. (Minor, wording.)**
Arcs come from table 17-10-0045; the "net arrivals per 1,000" figure for a selected province comes from table 17-10-0008. Both should be cited on that layer.

**C7 — Population revision status is only partly labelled. (Minor.)**
The source's own note: final intercensal to April 2021; final postcensal July 2021–July 2023; updated postcensal October 2023–April 2026; preliminary from July 2026. The explorer marks only 2026 as preliminary. 2021–2025 are postcensal and will be revised after the 2026 Census; they should carry a lighter "subject to revision" mark. This affects every population-based layer and every per-1,000 rate.

## Research / decisions

**R1 — Core housing need shows 2016 and 2021 only; the source table also has 2006 and 2011.** The earlier years were left out without a recorded reason. 2011 came from the voluntary National Household Survey, which is commonly treated as less comparable; that needs to be confirmed against Statistics Canada's own guidance before adding or formally excluding those years.

**R2 — Re-check for source updates before each publication.** All files were retrieved 2026-11-11. Population and components for 2025/26 are preliminary and will change.

## Layer by layer

Common to all Statistics Canada layers: licence is the Statistics Canada Open Licence unless noted; geography is Canada, ten provinces, three territories; nothing is interpolated.

### Population layers — table [17-10-0009-01](https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1710000901)
- **Period / frequency:** quarterly estimates 1946–2026 in the file; the explorer uses July 1 of each year, 1971–2026 (56 dates). Annual estimates, not census counts.
- **Why 1971:** earlier estimates are not adjusted for census undercoverage and are rounded to thousands.
- **Boundaries:** Northwest Territories and Nunavut are separate from July 1991 (on today's boundaries, although Nunavut was created in 1999); before that only the combined figure exists and the map shows one combined region.
- **Revisions:** see C7.
- **People:** persons, as published.
- **Change since 1971:** population ÷ July 1971 population − 1. For Northwest Territories and Nunavut the base is July 1991, so their figures are not comparable with the provinces' on the same map (stated in the layer note).
- **Growth in the past year:** July 1 ÷ previous July 1 − 1.
- **People per km²:** population ÷ 2021 Census land area (table [98-10-0001-01](https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=9810000101)). One land area is used for all years. Log colour scale.
- **Share of Canadians:** population ÷ Canada's population.

### Where growth came from — table [17-10-0008-01](https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1710000801)
- **Period / frequency:** annual, July 1 to June 30, 1971/72 to 2025/26. The explorer's year is the year the period ends.
- **Units / denominator:** persons, shown per 1,000 residents using the July 1 population at the start of the period.
- **Layers:** natural increase (births − deaths), immigrants, net non-permanent residents, net emigration, net interprovincial migration. Each matches the source component exactly.
- **Missing:** inflows and outflows of non-permanent residents are unavailable for some years in the source, but the *net* figure used here is present throughout.
- **Comparability:** 2025/26 is preliminary. This audit did not review the source's definitional notes for each component.

### Migration flows — table [17-10-0045-01](https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1710004501)
- **Period / frequency:** quarterly origin-to-destination counts, July 1971–April 2026; summed to July–June years. All 55 periods shown have four quarters.
- **Units:** persons moving (a person who moves twice is counted twice — stated in the panel).
- **Display:** nationally the 12 largest of 156 flows, with the share of all moves stated; all flows for a selected province.

### Federal election seats — Library of Parliament, [ParlInfo elected candidates](https://lop.parl.ca/sites/ParlInfo/default/en_CA/ElectionsRidings/electionsElectedCandidates)
- **Coverage:** 17 general elections, 1972–2025; seats won per party per province. By-elections excluded.
- **Licence:** Library of Parliament terms of use; attribution required.
- **Verified:** all 473 province-party counts match a recount of the file. Seats recorded equal the size of the House in 16 of 17 elections.
- **Issues:** C1, C2. The layer shows seats, not votes (stated).

### Housing starts and completions — CMHC via table [34-10-0126-01](https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3410012601)
- **Period / frequency:** annual, 1955–2025 in the file; shown 1972–2025 (starts) and 1972–2022 (completions). Completions genuinely end in 2022 in the source; nothing is extended.
- **Geography:** Canada and provinces only; the table has no territories (shown as "no published value").
- **Units / denominator:** total units ÷ July 1 population of the same year × 1,000.
- **Licence:** CMHC Licence Agreement for the Use of Data.
- **Comparability:** starts are not completed homes; demolitions are not subtracted (stated).

### Household growth — table [17-10-0159-01](https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1710015901)
- **Period:** annual, July 1, 2006–2025. Change in private households since 2006. 2025 preliminary per the source.

### Rental vacancy and average rent (cities) — CMHC via tables [34-10-0127-01](https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3410012701) and [34-10-0133-01](https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3410013301)
- **Period / frequency:** October survey each year; vacancy 1971–2025, rent 1987–2025.
- **Geography:** 33 census metropolitan areas (30 mapped; three listed only). Sub-parts in the source (Ottawa–Gatineau by province, Montréal excluding Saint-Jérôme) are not used. Metropolitan-area boundaries can change between censuses; this audit did not assess how the source handles that over time.
- **Units:** vacancy % of purpose-built apartments in buildings of 6+ units; rent is the average for two-bedroom units in row and apartment structures of 3+ units, current dollars (not inflation-adjusted, stated).
- **Canada figure:** the source's own "census metropolitan areas" average for vacancy; no national rent figure is shown.
- **Missing:** years a city was not surveyed are blank; see C5.

### Rent prices vs all prices — table [18-10-0005-01](https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1810000501)
- **Period:** annual average CPI (2002 = 100), provinces; shown 2020–2025 only, measured from 2019, because the rent index method changed in 2019.
- **Calculation:** (rent index ÷ its 2019 value) ÷ (all-items ÷ its 2019 value) − 1. Not an affordability measure; covers all tenants including renewals (stated).

### Core housing need — table [39-10-0048-01](https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3910004801)
- **Period:** census years; 2016 and 2021 shown (see R1). Never drawn as a line.
- **Units:** % of persons examined for core housing need (the source's own percentage). 2021 incomes include pandemic support (stated).

### Median after-tax income — table [11-10-0190-01](https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1110019001)
- **Period:** annual, 1976–2024; territories from 2018 only.
- **Units:** 2024 constant dollars, economic families and persons not in an economic family (owners and renters together).
- **Comparability:** survey changes in 1993 and 2012 are marked; the explorer refuses "then and now" differences across them. See C4.

### Map surface and positions (context, not statistics)
- Boundaries, city points, shaded relief: Natural Earth, public domain. Relief is a generalised hillshade and represents no statistic.

## Causation and comparison language

Checked in the build: "does not show that one caused another" on the housing path; "a difference is an observation, not an explanation" on both comparison tools; starts vs households "not a measure of shortage"; rent vs prices "not an affordability ratio". No causal claims found in layer text.

## Corrections applied — `web/explore-release/` (2026-11-11)

The sign-off build and its data files are unchanged. Corrections live in a new build and two new data files (`web/data/release/`), produced by `pipeline/build_release_patches.py`.

| Finding | What changed | How it is verified |
|---|---|---|
| C1 | Vancouver Quadra (Liberal) and Fundy Royal (Conservative) added for 2025 from Elections Canada's Official Voting Results, Table 11. Recorded in `registry/reconciliations/parlinfo_2025_missing_members.json`; the Library of Parliament file is not edited. British Columbia now reads Liberal 20, Conservative 19; national Liberal 169, Conservative 144, of 343. The layer shows "343 seats · 2 from Elections Canada" with an explanation, and the timeline entry is rebuilt from the same counts. | Tests: every election equals the size of the House; only 2025 differs from the source file; raw file hash unchanged. Audit re-run: 0 discrepancies. |
| C2 | A tie for most seats is drawn in neutral grey, labelled "Tied 7–7", named in the legend, finding and panel. Nine province-elections are ties after C1 (British Columbia 2025 is no longer one). | Browser check on Saskatchewan 1980. |
| C3 | Canada's net interprovincial figure is shown only where the source publishes it (0 from 1998/99 on; nothing earlier). No substituted zeros. | Audit re-run: 0 shown-but-not-in-source. |
| C4 | Income panel shows Statistics Canada's quality grade where it is below B (three values, all grade C, "good"). | Test + browser check on Nunavut 2021. |
| C5 | The rent legend shows "suppressed" only when a value in view is suppressed. | Browser check. |
| C6 | Migration flows cites both tables it uses. | Browser check. |
| C7 | Population layers from July 2021 to 2025 carry "Postcensal · will be revised", with an explanation; 2026 stays "Preliminary". Read from the source table's own note. | Browser check on 2019, 2024, 2026. |

Still open: R1 (core housing need 2006 and 2011) and R2 (re-check sources before each publication). C7 is applied to the five population layers only; per-1,000 rates that use population as a denominator are not separately marked.
