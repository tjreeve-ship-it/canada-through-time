# Where Canadians live, 1971–2026

**Canada nearly doubled. Alberta and B.C. led the provinces.**

_This story shows where Canada's population changed. It does not show why._

Period: July 1, 1971 to July 1, 2026 · Geography: Canada, 10 provinces and 3 territories (current boundaries; NT and NU combined before July 1991)

## Key statistics

Every figure is recomputed from the source table by `pipeline/check_ledger.py`. Evidence level for all: **observation** (a measured value or a change computed directly from it).

- Canada: 21,962,032 (July 1, 1971) → 41,798,407 (July 1, 2026, preliminary), +90% (+19.8 million).
- Fastest-growing provinces since 1971: Alberta +206%, British Columbia +155%.
- Yukon grew +165% (18,991 → 50,356).
- Slowest-growing province: Newfoundland and Labrador +4% (530,854 → 552,462).
- Largest absolute gain: Ontario, +8.4 million. Ontario's share of Canadians: 35.7% → 38.9%.
- Atlantic provinces' share of Canadians: 9.5% → 6.5% (all four grew in number).
- Western provinces (MB, SK, AB, BC): 26.6% → 32.6% of Canadians.
- Nunavut (separate estimates from July 1991): 22,154 → 43,091, +95%.

## Timeline events shown in the video

- **April 1982** — Canada's first quarterly estimate above 25 million: April 1, 1982 (25,042,069). _[Derived from the data; First quarterly estimate ≥ 25,000,000: 25,042,069]_
- **July 1991** — From July 1991, Statistics Canada reports the Northwest Territories and Nunavut separately (on today's boundaries); before that, only a combined figure exists. _[Data note; StatCan Table 17-10-0009-01, notes 4–5]_
- **January 1998** — Canada's first quarterly estimate above 30 million: January 1, 1998 (30,028,506). _[Derived from the data; First quarterly estimate ≥ 30,000,000: 30,028,506]_
- **April 1999** — Nunavut became a territory on April 1, 1999 (Nunavut Act). _[Historical fact; Nunavut Act, S.C. 1993, c. 28 (in force April 1, 1999)]_
- **July 2013** — Canada's first quarterly estimate above 35 million: July 1, 2013 (35,080,992). _[Derived from the data; First quarterly estimate ≥ 35,000,000: 35,080,992]_
- **July 2023** — Canada's first quarterly estimate above 40 million: July 1, 2023 (40,022,704). _[Derived from the data; First quarterly estimate ≥ 40,000,000: 40,022,704]_

## Revision status

Statistics Canada revises these estimates. Status by reference date (table note 3):

- July 1, 1971 to April 1, 2021: final intercensal
- July 1, 2021 to July 1, 2023: final postcensal
- October 1, 2023 to April 1, 2026: updated postcensal (may be revised)
- July 1, 2026 onward: preliminary postcensal (will be revised)

The end point of this story (July 1, 2026) is **preliminary**; every change to 2026 will move when it is revised. Per-value status is in `claims.csv`.

## Caveats and limitations

- July 2026 estimates are preliminary and will be revised.
- Northwest Territories and Nunavut were reported as one figure before July 1991; their change is measured from July 1991.
- Values on the map and share bar are rounded to 3 significant figures.
- Spikes sit inside each province, not at its population centre.
- This shows where population changed, not why.
- Estimates before July 1971 use a different method (not adjusted for census undercoverage), so the series starts in July 1971.
- Boundaries are generalized (Natural Earth, 1:10m), current boundaries, in Statistics Canada's Lambert projection.
- Estimates are revised as new census and component data arrive; preliminary values may change.

## Methodology

- `canada_growth`: Population on July 1 of each year from Table 17-10-0009-01; change = end − start; percent = end ÷ start − 1.
- `fastest_provinces`: Percent change July 1971 → July 2026 for each of the 10 provinces, ranked. Territories are excluded from the ranking and reported separately.
- `yukon_growth`: Percent change July 1971 → July 2026.
- `slowest_province`: Lowest percent change among the 10 provinces, July 1971 → July 2026.
- `ontario_gain`: Absolute change and share of Canada's population (province ÷ Canada, same date).
- `atlantic_share`: Sum of NL, PE, NS and NB ÷ Canada, same date. A share can fall while the population still grows: all four grew in number.
- `west_share`: Sum of MB, SK, AB and BC ÷ Canada, same date. 'Western provinces' here includes Manitoba.
- `nunavut_growth`: Measured from July 1991, the first date Statistics Canada reports Nunavut separately.
- `ntnu_split_date`: First date with a non-empty Northwest Territories value in Table 17-10-0009-01 (table notes 4–5).
- `nunavut_created`: Historical fact from the statute; not computable from project data.
- `milestone_25m`: Derived: earliest quarterly estimate ≥ 25,000,000 from July 1971 on. Quarterly estimates only: the true crossing date falls within the preceding quarter.
- `milestone_30m`: Derived: earliest quarterly estimate ≥ 30,000,000.
- `milestone_35m`: Derived: earliest quarterly estimate ≥ 35,000,000.
- `milestone_40m`: Derived: earliest quarterly estimate ≥ 40,000,000.
- Video: spike height is population on each quarterly reference date; spike colour is the change since July 1971 (since July 1991 for the Northwest Territories and Nunavut). Changes within ±2% are shown in the neutral colour. Between quarters the spike height is interpolated for smooth motion; every number on screen is the most recent published quarter.
- Statistics Canada methodology notes for this table:
  - Estimates are final intercensal from July 1, 1971 to April 1, 2021; final postcensal July 1, 2021 to July 1, 2023; updated postcensal Oct 1, 2023 to Apr 1, 2026; preliminary postcensal from July 1, 2026 (StatCan table note 3).
  - Before July 1, 1971 estimates are unadjusted for census net undercoverage and rounded to the thousand. This platform starts population series at 1971-07-01 to avoid that methodological break.
  - Northwest Territories and Nunavut are presented separately from July 1, 1991, on current boundaries, although Nunavut was legally created April 1, 1999 (table notes 4 and 5). Before July 1991 only the combined figure exists; the map shows the two territories as one combined region for those dates.
  - Quarterly estimates reflect components of change from the preceding quarter (table note 2).

## Sources

- **Population estimates, quarterly** · Statistics Canada · Table 17-10-0009-01 · https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1710000901 · https://doi.org/10.25318/1710000901-eng · retrieved 2026-11-11 · licence: Statistics Canada Open Licence
- **Admin 1 – States, Provinces (1:10m), plus lakes, countries, rivers (1:50m)** · Natural Earth · https://www.naturalearthdata.com/ · retrieved 2026-11-11 · licence: Public domain
- **Nunavut Act, S.C. 1993, c. 28** · Government of Canada, Justice Laws Website · https://laws-lois.justice.gc.ca/eng/acts/n-28.6/ · retrieved 2026-11-11 · licence: Crown copyright; reproduction of federal law permitted (Reproduction of Federal Law Order)

Attribution: Source: Statistics Canada. Table 17-10-0009-01 Population estimates, quarterly. Licence: https://www.statcan.gc.ca/en/reference/licence

## Explore it yourself

- [Population, July 2026](https://claude.ai/artifact/CZheZU7u2wtcgkGNiDSSk9#pop-2026)
- [Change since 1971, by province](https://claude.ai/artifact/CZheZU7u2wtcgkGNiDSSk9#chg-2026)
- [Share of Canadians, 2026](https://claude.ai/artifact/CZheZU7u2wtcgkGNiDSSk9#share-2026)
- [Alberta's population since 1971](https://claude.ai/artifact/CZheZU7u2wtcgkGNiDSSk9#pop-2026-ab)
- [Newfoundland and Labrador's share](https://claude.ai/artifact/CZheZU7u2wtcgkGNiDSSk9#share-2026-nl)
- [Population, July 1971](https://claude.ai/artifact/CZheZU7u2wtcgkGNiDSSk9#pop-1971)

## Files in this package

- `x_post.txt` — social post (generated from the ledger)
- `explorer_links.md` — deep links
- `claims.csv` — every claim value, its computation and revision status
- `data_july1.csv` — July 1 population by province and territory (supporting data)
- `check_report.md` — automated check result and the items that need human review
- Videos: `exports/population-provinces-1971-2026/population-provinces-1971-2026_16x9_1080p.mp4`, `population-provinces-1971-2026_9x16_1920p.mp4`

## Ledger

Generated from `stories/population-provinces-1971-2026/ledger.yaml` (version 1, 2026-11-11). Do not edit this file by hand; change the ledger and run `pipeline/build_story.py`.
