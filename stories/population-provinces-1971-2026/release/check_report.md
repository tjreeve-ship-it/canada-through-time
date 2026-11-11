# Ledger check — Where Canadians live, 1971–2026

**Result: PASS** · 447 checks passed · 0 failed · 3 items need human review

## Needs human review (not machine-verifiable)

- nunavut_created.date: 'April 1999' comes from external_nunavut_act and cannot be recomputed from project data. Confirm the in-force date against the Justice Laws page before each release.
- headline wording and emphasis: “Canada nearly doubled. Alberta and B.C. led the provinces.” (arithmetic verified; framing is a human call)
- scope statement: “This story shows where Canada's population changed. It does not show why.”
- Legibility, attribution placement and mobile-safe layout of the rendered frames (inspect stills).

## Notes

- video 16x9: no frame log yet (render first)
- video 9x16: no frame log yet (render first)

## Values recomputed

| Claim | Value | Computed | Display | Revision status |
|---|---|---|---|---|
| canada_growth | start | 21962032 | 21,962,032 | final intercensal |
| canada_growth | end | 41798407 | 41,798,407 | preliminary postcensal (will be revised) |
| canada_growth | change | 19836375 | 19.8 million | final intercensal; preliminary postcensal (will be revised) |
| canada_growth | pct | 0.903212 | +90% | final intercensal; preliminary postcensal (will be revised) |
| canada_growth | start_m | 21962032 | 22.0 million | final intercensal |
| canada_growth | end_m | 41798407 | 41.8 million | preliminary postcensal (will be revised) |
| fastest_provinces | first | AB | Alberta | final intercensal; preliminary postcensal (will be revised) |
| fastest_provinces | second | BC | B.C. | final intercensal; preliminary postcensal (will be revised) |
| fastest_provinces | ab_pct | 2.062375 | +206% | final intercensal; preliminary postcensal (will be revised) |
| fastest_provinces | bc_pct | 1.548839 | +155% | final intercensal; preliminary postcensal (will be revised) |
| yukon_growth | pct | 1.651572 | +165% | final intercensal; preliminary postcensal (will be revised) |
| yukon_growth | start | 18991 | 18,991 | final intercensal |
| yukon_growth | end | 50356 | 50,356 | preliminary postcensal (will be revised) |
| slowest_province | last | NL | Newfoundland and Labrador | final intercensal; preliminary postcensal (will be revised) |
| slowest_province | pct | 0.040704 | +4% | final intercensal; preliminary postcensal (will be revised) |
| slowest_province | start | 530854 | 530,854 | final intercensal |
| slowest_province | end | 552462 | 552,462 | preliminary postcensal (will be revised) |
| ontario_gain | abs | 8413094 | 8.4 million | final intercensal; preliminary postcensal (will be revised) |
| ontario_gain | rank_abs | ON | Ontario | final intercensal; preliminary postcensal (will be revised) |
| ontario_gain | share_start | 0.357391 | 35.7% | final intercensal |
| ontario_gain | share_end | 0.389061 | 38.9% | preliminary postcensal (will be revised) |
| atlantic_share | start | 0.094855 | 9.5% | final intercensal |
| atlantic_share | end | 0.065131 | 6.5% | preliminary postcensal (will be revised) |
| west_share | start | 0.265781 | 26.6% | final intercensal |
| west_share | end | 0.325549 | 32.6% | preliminary postcensal (will be revised) |
| nunavut_growth | start | 22154 | 22,154 | final intercensal |
| nunavut_growth | end | 43091 | 43,091 | preliminary postcensal (will be revised) |
| nunavut_growth | pct | 0.945066 | +95% | final intercensal; preliminary postcensal (will be revised) |
| ntnu_split_date | first_nt | 1991-07-01 | July 1991 | final intercensal |
| nunavut_created | date | (external source) | April 1999 | — |
| milestone_25m | date | 1982-04-01 | April 1982 | final intercensal |
| milestone_25m | value | 25042069 | 25,042,069 | final intercensal |
| milestone_30m | date | 1998-01-01 | January 1998 | final intercensal |
| milestone_30m | value | 30028506 | 30,028,506 | final intercensal |
| milestone_35m | date | 2013-07-01 | July 2013 | final intercensal |
| milestone_35m | value | 35080992 | 35,080,992 | final intercensal |
| milestone_40m | date | 2023-07-01 | July 2023 | final postcensal |
| milestone_40m | value | 40022704 | 40,022,704 | final postcensal |

<details><summary>All 447 passing checks</summary>

- ✓ story.id present
- ✓ story.title present
- ✓ story.headline present
- ✓ story.period present
- ✓ story.geography present
- ✓ story.scope_statement present
- ✓ source statcan_17100009 found
- ✓ source statcan_17100009: publisher present
- ✓ source statcan_17100009: url present
- ✓ source statcan_17100009: retrieved present
- ✓ source statcan_17100009: licence present
- ✓ source statcan_17100009: raw file SHA-256 matches registry
- ✓ source naturalearth_admin1 found
- ✓ source naturalearth_admin1: publisher present
- ✓ source naturalearth_admin1: url present
- ✓ source naturalearth_admin1: retrieved present
- ✓ source naturalearth_admin1: licence present
- ✓ source external_nunavut_act found
- ✓ source external_nunavut_act: publisher present
- ✓ source external_nunavut_act: url present
- ✓ source external_nunavut_act: retrieved present
- ✓ source external_nunavut_act: licence present
- ✓ revision boundary 1971-07-01 found in StatCan table note
- ✓ revision boundary 2021-04-01 found in StatCan table note
- ✓ revision boundary 2021-07-01 found in StatCan table note
- ✓ revision boundary 2023-07-01 found in StatCan table note
- ✓ revision boundary 2023-10-01 found in StatCan table note
- ✓ revision boundary 2026-04-01 found in StatCan table note
- ✓ revision boundary 2026-07-01 found in StatCan table note
- ✓ caveat preliminary: match phrase is in its text
- ✓ caveat ntnu_split: match phrase is in its text
- ✓ caveat rounding: match phrase is in its text
- ✓ caveat spike_placement: match phrase is in its text
- ✓ caveat not_why: match phrase is in its text
- ✓ caveat method_break_1971: match phrase is in its text
- ✓ caveat boundaries: match phrase is in its text
- ✓ claim ids unique
- ✓ canada_growth: required fields present
- ✓ canada_growth: evidence level 'observation'
- ✓ canada_growth: source statcan_17100009 declared
- ✓ canada_growth: wording keys valid
- ✓ canada_growth: caveat preliminary defined
- ✓ canada_growth: caveat method_break_1971 defined
- ✓ canada_growth.start: fields present
- ✓ canada_growth.start: value 21962032 = expected
- ✓ canada_growth.start: display '21,962,032'
- ✓ canada_growth.start: date 1971-07-01 within claim period
- ✓ canada_growth.start: geography ['CAN'] ⊆ claim geography
- ✓ canada_growth.end: fields present
- ✓ canada_growth.end: value 41798407 = expected
- ✓ canada_growth.end: display '41,798,407'
- ✓ canada_growth.end: date 2026-07-01 within claim period
- ✓ canada_growth.end: geography ['CAN'] ⊆ claim geography
- ✓ canada_growth.end: preliminary value carries caveat
- ✓ canada_growth.change: fields present
- ✓ canada_growth.change: value 19836375 = expected
- ✓ canada_growth.change: display '19.8 million'
- ✓ canada_growth.change: date 1971-07-01 within claim period
- ✓ canada_growth.change: date 2026-07-01 within claim period
- ✓ canada_growth.change: change measured over the claim period
- ✓ canada_growth.change: geography ['CAN'] ⊆ claim geography
- ✓ canada_growth.change: preliminary value carries caveat
- ✓ canada_growth.pct: fields present
- ✓ canada_growth.pct: value 0.9032121891089131 = expected
- ✓ canada_growth.pct: display '+90%'
- ✓ canada_growth.pct: date 1971-07-01 within claim period
- ✓ canada_growth.pct: date 2026-07-01 within claim period
- ✓ canada_growth.pct: change measured over the claim period
- ✓ canada_growth.pct: geography ['CAN'] ⊆ claim geography
- ✓ canada_growth.pct: preliminary value carries caveat
- ✓ canada_growth.start_m: fields present
- ✓ canada_growth.start_m: value 21962032 = expected
- ✓ canada_growth.start_m: display '22.0 million'
- ✓ canada_growth.start_m: date 1971-07-01 within claim period
- ✓ canada_growth.start_m: geography ['CAN'] ⊆ claim geography
- ✓ canada_growth.end_m: fields present
- ✓ canada_growth.end_m: value 41798407 = expected
- ✓ canada_growth.end_m: display '41.8 million'
- ✓ canada_growth.end_m: date 2026-07-01 within claim period
- ✓ canada_growth.end_m: geography ['CAN'] ⊆ claim geography
- ✓ canada_growth.end_m: preliminary value carries caveat
- ✓ canada_growth.text: every number traces to its values
- ✓ canada_growth.text: no causal wording
- ✓ canada_growth.wording.video: every number traces to its values
- ✓ canada_growth.wording.video: no causal wording
- ✓ canada_growth.wording.short: every number traces to its values
- ✓ canada_growth.wording.short: no causal wording
- ✓ canada_growth.wording.x: every number traces to its values
- ✓ canada_growth.wording.x: no causal wording
- ✓ canada_growth.wording.package: every number traces to its values
- ✓ canada_growth.wording.package: no causal wording
- ✓ fastest_provinces: required fields present
- ✓ fastest_provinces: evidence level 'observation'
- ✓ fastest_provinces: source statcan_17100009 declared
- ✓ fastest_provinces: wording keys valid
- ✓ fastest_provinces: caveat preliminary defined
- ✓ fastest_provinces.first: fields present
- ✓ fastest_provinces.first: value 'AB' = expected
- ✓ fastest_provinces.first: display 'Alberta' names AB
- ✓ fastest_provinces.first: date 1971-07-01 within claim period
- ✓ fastest_provinces.first: date 2026-07-01 within claim period
- ✓ fastest_provinces.first: change measured over the claim period
- ✓ fastest_provinces.first: geography ['NL', 'PE', 'NS', 'NB', 'QC', 'ON', 'MB', 'SK', 'AB', 'BC'] ⊆ claim geography
- ✓ fastest_provinces.first: ranked result AB in claim geography
- ✓ fastest_provinces.first: preliminary value carries caveat
- ✓ fastest_provinces.second: fields present
- ✓ fastest_provinces.second: value 'BC' = expected
- ✓ fastest_provinces.second: display 'B.C.' names BC
- ✓ fastest_provinces.second: date 1971-07-01 within claim period
- ✓ fastest_provinces.second: date 2026-07-01 within claim period
- ✓ fastest_provinces.second: change measured over the claim period
- ✓ fastest_provinces.second: geography ['NL', 'PE', 'NS', 'NB', 'QC', 'ON', 'MB', 'SK', 'AB', 'BC'] ⊆ claim geography
- ✓ fastest_provinces.second: ranked result BC in claim geography
- ✓ fastest_provinces.second: preliminary value carries caveat
- ✓ fastest_provinces.ab_pct: fields present
- ✓ fastest_provinces.ab_pct: value 2.0623749412415195 = expected
- ✓ fastest_provinces.ab_pct: display '+206%'
- ✓ fastest_provinces.ab_pct: date 1971-07-01 within claim period
- ✓ fastest_provinces.ab_pct: date 2026-07-01 within claim period
- ✓ fastest_provinces.ab_pct: change measured over the claim period
- ✓ fastest_provinces.ab_pct: geography ['AB'] ⊆ claim geography
- ✓ fastest_provinces.ab_pct: preliminary value carries caveat
- ✓ fastest_provinces.bc_pct: fields present
- ✓ fastest_provinces.bc_pct: value 1.5488393060384653 = expected
- ✓ fastest_provinces.bc_pct: display '+155%'
- ✓ fastest_provinces.bc_pct: date 1971-07-01 within claim period
- ✓ fastest_provinces.bc_pct: date 2026-07-01 within claim period
- ✓ fastest_provinces.bc_pct: change measured over the claim period
- ✓ fastest_provinces.bc_pct: geography ['BC'] ⊆ claim geography
- ✓ fastest_provinces.bc_pct: preliminary value carries caveat
- ✓ fastest_provinces.text: every number traces to its values
- ✓ fastest_provinces.text: no causal wording
- ✓ fastest_provinces.wording.video: every number traces to its values
- ✓ fastest_provinces.wording.video: no causal wording
- ✓ fastest_provinces.wording.short: every number traces to its values
- ✓ fastest_provinces.wording.short: no causal wording
- ✓ fastest_provinces.wording.x: every number traces to its values
- ✓ fastest_provinces.wording.x: no causal wording
- ✓ fastest_provinces.wording.package: every number traces to its values
- ✓ fastest_provinces.wording.package: no causal wording
- ✓ yukon_growth: required fields present
- ✓ yukon_growth: evidence level 'observation'
- ✓ yukon_growth: source statcan_17100009 declared
- ✓ yukon_growth: wording keys valid
- ✓ yukon_growth: caveat preliminary defined
- ✓ yukon_growth.pct: fields present
- ✓ yukon_growth.pct: value 1.6515717971670791 = expected
- ✓ yukon_growth.pct: display '+165%'
- ✓ yukon_growth.pct: date 1971-07-01 within claim period
- ✓ yukon_growth.pct: date 2026-07-01 within claim period
- ✓ yukon_growth.pct: change measured over the claim period
- ✓ yukon_growth.pct: geography ['YT'] ⊆ claim geography
- ✓ yukon_growth.pct: preliminary value carries caveat
- ✓ yukon_growth.start: fields present
- ✓ yukon_growth.start: value 18991 = expected
- ✓ yukon_growth.start: display '18,991'
- ✓ yukon_growth.start: date 1971-07-01 within claim period
- ✓ yukon_growth.start: geography ['YT'] ⊆ claim geography
- ✓ yukon_growth.end: fields present
- ✓ yukon_growth.end: value 50356 = expected
- ✓ yukon_growth.end: display '50,356'
- ✓ yukon_growth.end: date 2026-07-01 within claim period
- ✓ yukon_growth.end: geography ['YT'] ⊆ claim geography
- ✓ yukon_growth.end: preliminary value carries caveat
- ✓ yukon_growth.text: every number traces to its values
- ✓ yukon_growth.text: no causal wording
- ✓ yukon_growth.wording.video: every number traces to its values
- ✓ yukon_growth.wording.video: no causal wording
- ✓ yukon_growth.wording.package: every number traces to its values
- ✓ yukon_growth.wording.package: no causal wording
- ✓ slowest_province: required fields present
- ✓ slowest_province: evidence level 'observation'
- ✓ slowest_province: source statcan_17100009 declared
- ✓ slowest_province: wording keys valid
- ✓ slowest_province: caveat preliminary defined
- ✓ slowest_province.last: fields present
- ✓ slowest_province.last: value 'NL' = expected
- ✓ slowest_province.last: display 'Newfoundland and Labrador' names NL
- ✓ slowest_province.last: date 1971-07-01 within claim period
- ✓ slowest_province.last: date 2026-07-01 within claim period
- ✓ slowest_province.last: change measured over the claim period
- ✓ slowest_province.last: geography ['NL', 'PE', 'NS', 'NB', 'QC', 'ON', 'MB', 'SK', 'AB', 'BC'] ⊆ claim geography
- ✓ slowest_province.last: ranked result NL in claim geography
- ✓ slowest_province.last: preliminary value carries caveat
- ✓ slowest_province.pct: fields present
- ✓ slowest_province.pct: value 0.04070422376020533 = expected
- ✓ slowest_province.pct: display '+4%'
- ✓ slowest_province.pct: date 1971-07-01 within claim period
- ✓ slowest_province.pct: date 2026-07-01 within claim period
- ✓ slowest_province.pct: change measured over the claim period
- ✓ slowest_province.pct: geography ['NL'] ⊆ claim geography
- ✓ slowest_province.pct: preliminary value carries caveat
- ✓ slowest_province.start: fields present
- ✓ slowest_province.start: value 530854 = expected
- ✓ slowest_province.start: display '530,854'
- ✓ slowest_province.start: date 1971-07-01 within claim period
- ✓ slowest_province.start: geography ['NL'] ⊆ claim geography
- ✓ slowest_province.end: fields present
- ✓ slowest_province.end: value 552462 = expected
- ✓ slowest_province.end: display '552,462'
- ✓ slowest_province.end: date 2026-07-01 within claim period
- ✓ slowest_province.end: geography ['NL'] ⊆ claim geography
- ✓ slowest_province.end: preliminary value carries caveat
- ✓ slowest_province.text: every number traces to its values
- ✓ slowest_province.text: no causal wording
- ✓ slowest_province.wording.video: every number traces to its values
- ✓ slowest_province.wording.video: no causal wording
- ✓ slowest_province.wording.package: every number traces to its values
- ✓ slowest_province.wording.package: no causal wording
- ✓ ontario_gain: required fields present
- ✓ ontario_gain: evidence level 'observation'
- ✓ ontario_gain: source statcan_17100009 declared
- ✓ ontario_gain: wording keys valid
- ✓ ontario_gain: caveat preliminary defined
- ✓ ontario_gain.abs: fields present
- ✓ ontario_gain.abs: value 8413094 = expected
- ✓ ontario_gain.abs: display '8.4 million'
- ✓ ontario_gain.abs: date 1971-07-01 within claim period
- ✓ ontario_gain.abs: date 2026-07-01 within claim period
- ✓ ontario_gain.abs: change measured over the claim period
- ✓ ontario_gain.abs: geography ['ON'] ⊆ claim geography
- ✓ ontario_gain.abs: preliminary value carries caveat
- ✓ ontario_gain.rank_abs: fields present
- ✓ ontario_gain.rank_abs: value 'ON' = expected
- ✓ ontario_gain.rank_abs: display 'Ontario' names ON
- ✓ ontario_gain.rank_abs: date 1971-07-01 within claim period
- ✓ ontario_gain.rank_abs: date 2026-07-01 within claim period
- ✓ ontario_gain.rank_abs: change measured over the claim period
- ✓ ontario_gain.rank_abs: geography ['NL', 'PE', 'NS', 'NB', 'QC', 'ON', 'MB', 'SK', 'AB', 'BC'] ⊆ claim geography
- ✓ ontario_gain.rank_abs: ranked result ON in claim geography
- ✓ ontario_gain.rank_abs: preliminary value carries caveat
- ✓ ontario_gain.share_start: fields present
- ✓ ontario_gain.share_start: value 0.35739074599290266 = expected
- ✓ ontario_gain.share_start: display '35.7%'
- ✓ ontario_gain.share_start: date 1971-07-01 within claim period
- ✓ ontario_gain.share_start: geography ['ON'] ⊆ claim geography
- ✓ ontario_gain.share_end: fields present
- ✓ ontario_gain.share_end: value 0.389060784062895 = expected
- ✓ ontario_gain.share_end: display '38.9%'
- ✓ ontario_gain.share_end: date 2026-07-01 within claim period
- ✓ ontario_gain.share_end: geography ['ON'] ⊆ claim geography
- ✓ ontario_gain.share_end: preliminary value carries caveat
- ✓ ontario_gain.text: every number traces to its values
- ✓ ontario_gain.text: no causal wording
- ✓ ontario_gain.wording.package: every number traces to its values
- ✓ ontario_gain.wording.package: no causal wording
- ✓ atlantic_share: required fields present
- ✓ atlantic_share: evidence level 'observation'
- ✓ atlantic_share: source statcan_17100009 declared
- ✓ atlantic_share: wording keys valid
- ✓ atlantic_share: caveat preliminary defined
- ✓ atlantic_share.start: fields present
- ✓ atlantic_share.start: value 0.09485506623430838 = expected
- ✓ atlantic_share.start: display '9.5%'
- ✓ atlantic_share.start: date 1971-07-01 within claim period
- ✓ atlantic_share.start: geography ['NL', 'PE', 'NS', 'NB'] ⊆ claim geography
- ✓ atlantic_share.end: fields present
- ✓ atlantic_share.end: value 0.06513147737903026 = expected
- ✓ atlantic_share.end: display '6.5%'
- ✓ atlantic_share.end: date 2026-07-01 within claim period
- ✓ atlantic_share.end: geography ['NL', 'PE', 'NS', 'NB'] ⊆ claim geography
- ✓ atlantic_share.end: preliminary value carries caveat
- ✓ atlantic_share.text: every number traces to its values
- ✓ atlantic_share.text: no causal wording
- ✓ atlantic_share.wording.video: every number traces to its values
- ✓ atlantic_share.wording.video: no causal wording
- ✓ atlantic_share.wording.short: every number traces to its values
- ✓ atlantic_share.wording.short: no causal wording
- ✓ atlantic_share.wording.x: every number traces to its values
- ✓ atlantic_share.wording.x: no causal wording
- ✓ atlantic_share.wording.package: every number traces to its values
- ✓ atlantic_share.wording.package: no causal wording
- ✓ west_share: required fields present
- ✓ west_share: evidence level 'observation'
- ✓ west_share: source statcan_17100009 declared
- ✓ west_share: wording keys valid
- ✓ west_share: caveat preliminary defined
- ✓ west_share.start: fields present
- ✓ west_share.start: value 0.2657814632088688 = expected
- ✓ west_share.start: display '26.6%'
- ✓ west_share.start: date 1971-07-01 within claim period
- ✓ west_share.start: geography ['MB', 'SK', 'AB', 'BC'] ⊆ claim geography
- ✓ west_share.end: fields present
- ✓ west_share.end: value 0.32554898563478746 = expected
- ✓ west_share.end: display '32.6%'
- ✓ west_share.end: date 2026-07-01 within claim period
- ✓ west_share.end: geography ['MB', 'SK', 'AB', 'BC'] ⊆ claim geography
- ✓ west_share.end: preliminary value carries caveat
- ✓ west_share.text: every number traces to its values
- ✓ west_share.text: no causal wording
- ✓ west_share.wording.package: every number traces to its values
- ✓ west_share.wording.package: no causal wording
- ✓ nunavut_growth: required fields present
- ✓ nunavut_growth: evidence level 'observation'
- ✓ nunavut_growth: source statcan_17100009 declared
- ✓ nunavut_growth: wording keys valid
- ✓ nunavut_growth: caveat preliminary defined
- ✓ nunavut_growth: caveat ntnu_split defined
- ✓ nunavut_growth.start: fields present
- ✓ nunavut_growth.start: value 22154 = expected
- ✓ nunavut_growth.start: display '22,154'
- ✓ nunavut_growth.start: date 1991-07-01 within claim period
- ✓ nunavut_growth.start: geography ['NU'] ⊆ claim geography
- ✓ nunavut_growth.end: fields present
- ✓ nunavut_growth.end: value 43091 = expected
- ✓ nunavut_growth.end: display '43,091'
- ✓ nunavut_growth.end: date 2026-07-01 within claim period
- ✓ nunavut_growth.end: geography ['NU'] ⊆ claim geography
- ✓ nunavut_growth.end: preliminary value carries caveat
- ✓ nunavut_growth.pct: fields present
- ✓ nunavut_growth.pct: value 0.945066353705877 = expected
- ✓ nunavut_growth.pct: display '+95%'
- ✓ nunavut_growth.pct: date 1991-07-01 within claim period
- ✓ nunavut_growth.pct: date 2026-07-01 within claim period
- ✓ nunavut_growth.pct: change measured over the claim period
- ✓ nunavut_growth.pct: geography ['NU'] ⊆ claim geography
- ✓ nunavut_growth.pct: preliminary value carries caveat
- ✓ nunavut_growth.text: every number traces to its values
- ✓ nunavut_growth.text: no causal wording
- ✓ nunavut_growth.wording.package: every number traces to its values
- ✓ nunavut_growth.wording.package: no causal wording
- ✓ ntnu_split_date: required fields present
- ✓ ntnu_split_date: evidence level 'observation'
- ✓ ntnu_split_date: source statcan_17100009 declared
- ✓ ntnu_split_date: wording keys valid
- ✓ ntnu_split_date: caveat ntnu_split defined
- ✓ ntnu_split_date.first_nt: fields present
- ✓ ntnu_split_date.first_nt: value '1991-07-01' = expected
- ✓ ntnu_split_date.first_nt: display 'July 1991'
- ✓ ntnu_split_date.first_nt: derived date equals claim period
- ✓ ntnu_split_date.first_nt: geography ['NT'] ⊆ claim geography
- ✓ ntnu_split_date.text: every number traces to its values
- ✓ ntnu_split_date.text: no causal wording
- ✓ ntnu_split_date.wording.short: every number traces to its values
- ✓ ntnu_split_date.wording.short: no causal wording
- ✓ ntnu_split_date.wording.package: every number traces to its values
- ✓ ntnu_split_date.wording.package: no causal wording
- ✓ nunavut_created: required fields present
- ✓ nunavut_created: evidence level 'observation'
- ✓ nunavut_created: source external_nunavut_act declared
- ✓ nunavut_created: wording keys valid
- ✓ nunavut_created.date: fields present
- ✓ nunavut_created.text: every number traces to its values
- ✓ nunavut_created.text: no causal wording
- ✓ nunavut_created.wording.short: every number traces to its values
- ✓ nunavut_created.wording.short: no causal wording
- ✓ nunavut_created.wording.package: every number traces to its values
- ✓ nunavut_created.wording.package: no causal wording
- ✓ milestone_25m: required fields present
- ✓ milestone_25m: evidence level 'observation'
- ✓ milestone_25m: source statcan_17100009 declared
- ✓ milestone_25m: wording keys valid
- ✓ milestone_25m.date: fields present
- ✓ milestone_25m.date: value '1982-04-01' = expected
- ✓ milestone_25m.date: display 'April 1982'
- ✓ milestone_25m.date: derived date equals claim period
- ✓ milestone_25m.date: geography ['CAN'] ⊆ claim geography
- ✓ milestone_25m.value: fields present
- ✓ milestone_25m.value: value 25042069 = expected
- ✓ milestone_25m.value: display '25,042,069'
- ✓ milestone_25m.value: date 1982-04-01 within claim period
- ✓ milestone_25m.value: geography ['CAN'] ⊆ claim geography
- ✓ milestone_25m.text: every number traces to its values
- ✓ milestone_25m.text: no causal wording
- ✓ milestone_25m.wording.short: every number traces to its values
- ✓ milestone_25m.wording.short: no causal wording
- ✓ milestone_25m.wording.package: every number traces to its values
- ✓ milestone_25m.wording.package: no causal wording
- ✓ milestone_30m: required fields present
- ✓ milestone_30m: evidence level 'observation'
- ✓ milestone_30m: source statcan_17100009 declared
- ✓ milestone_30m: wording keys valid
- ✓ milestone_30m.date: fields present
- ✓ milestone_30m.date: value '1998-01-01' = expected
- ✓ milestone_30m.date: display 'January 1998'
- ✓ milestone_30m.date: derived date equals claim period
- ✓ milestone_30m.date: geography ['CAN'] ⊆ claim geography
- ✓ milestone_30m.value: fields present
- ✓ milestone_30m.value: value 30028506 = expected
- ✓ milestone_30m.value: display '30,028,506'
- ✓ milestone_30m.value: date 1998-01-01 within claim period
- ✓ milestone_30m.value: geography ['CAN'] ⊆ claim geography
- ✓ milestone_30m.text: every number traces to its values
- ✓ milestone_30m.text: no causal wording
- ✓ milestone_30m.wording.short: every number traces to its values
- ✓ milestone_30m.wording.short: no causal wording
- ✓ milestone_30m.wording.package: every number traces to its values
- ✓ milestone_30m.wording.package: no causal wording
- ✓ milestone_35m: required fields present
- ✓ milestone_35m: evidence level 'observation'
- ✓ milestone_35m: source statcan_17100009 declared
- ✓ milestone_35m: wording keys valid
- ✓ milestone_35m.date: fields present
- ✓ milestone_35m.date: value '2013-07-01' = expected
- ✓ milestone_35m.date: display 'July 2013'
- ✓ milestone_35m.date: derived date equals claim period
- ✓ milestone_35m.date: geography ['CAN'] ⊆ claim geography
- ✓ milestone_35m.value: fields present
- ✓ milestone_35m.value: value 35080992 = expected
- ✓ milestone_35m.value: display '35,080,992'
- ✓ milestone_35m.value: date 2013-07-01 within claim period
- ✓ milestone_35m.value: geography ['CAN'] ⊆ claim geography
- ✓ milestone_35m.text: every number traces to its values
- ✓ milestone_35m.text: no causal wording
- ✓ milestone_35m.wording.short: every number traces to its values
- ✓ milestone_35m.wording.short: no causal wording
- ✓ milestone_35m.wording.package: every number traces to its values
- ✓ milestone_35m.wording.package: no causal wording
- ✓ milestone_40m: required fields present
- ✓ milestone_40m: evidence level 'observation'
- ✓ milestone_40m: source statcan_17100009 declared
- ✓ milestone_40m: wording keys valid
- ✓ milestone_40m.date: fields present
- ✓ milestone_40m.date: value '2023-07-01' = expected
- ✓ milestone_40m.date: display 'July 2023'
- ✓ milestone_40m.date: derived date equals claim period
- ✓ milestone_40m.date: geography ['CAN'] ⊆ claim geography
- ✓ milestone_40m.value: fields present
- ✓ milestone_40m.value: value 40022704 = expected
- ✓ milestone_40m.value: display '40,022,704'
- ✓ milestone_40m.value: date 2023-07-01 within claim period
- ✓ milestone_40m.value: geography ['CAN'] ⊆ claim geography
- ✓ milestone_40m.text: every number traces to its values
- ✓ milestone_40m.text: no causal wording
- ✓ milestone_40m.wording.short: every number traces to its values
- ✓ milestone_40m.wording.short: no causal wording
- ✓ milestone_40m.wording.package: every number traces to its values
- ✓ milestone_40m.wording.package: no causal wording
- ✓ headline: no causal wording
- ✓ headline 'nearly doubled': growth 90.321% in [80%, 100%)
- ✓ headline 'led the provinces': top two are AB, BC and both are named
- ✓ release/x_post.txt: every number is in the ledger
- ✓ release/x_post.txt: caveat 'preliminary' present
- ✓ release/x_post.txt: every link is a ledger/registry link
- ✓ x_post: 280/280 characters (links count 23)
- ✓ x_post: identical to ledger template
- ✓ release/README.md: every number is in the ledger
- ✓ release/README.md: caveat 'preliminary' present
- ✓ release/README.md: caveat 'ntnu_split' present
- ✓ release/README.md: caveat 'rounding' present
- ✓ release/README.md: caveat 'spike_placement' present
- ✓ release/README.md: caveat 'not_why' present
- ✓ release/README.md: caveat 'method_break_1971' present
- ✓ release/README.md: caveat 'boundaries' present
- ✓ release/README.md: every link is a ledger/registry link
- ✓ release/explorer_links.md: every number is in the ledger
- ✓ release/explorer_links.md: every link is a ledger/registry link

</details>
