# Release acceptance checklist

Status as of 2026-11-12, for `web/explore-studio/`. "Checked" means run or viewed in this project, with how. "Not checked" means nobody has verified it yet. Nothing here is assumed.

Legend: ✅ checked and passing · ⚠️ checked, has a known limit · ⬜ not checked yet

## Screens
| Item | Status | Evidence |
|---|---|---|
| Desktop 1440 × 900: all layer types render, no clipping | ✅ | Browser checks; screenshots viewed in the sign-off pass |
| Tablet 834 × 1112: map fits, no crash | ✅ | Browser check (820 px) + screenshots viewed |
| Phone 390 × 844: country fits width; selected place stays above the sheet | ✅ | Browser checks |
| Phone people map readability | ⚠️ | Readable but crowded (eight values at 390 px) |
| Real devices (an actual iPhone, Android phone, iPad) | ⬜ | Only headless Chrome has been used |
| Other browsers (Safari, Firefox, Edge) | ⬜ | Chrome only |

## Performance and loading
| Item | Status | Evidence |
|---|---|---|
| Page loads with no script errors | ✅ | Every capture and check run asserts this |
| Load time and frame rate on a normal computer or phone | ⬜ | Only measured in a no-graphics-card test machine, which is not representative |
| Single-file size (5.7 MB) acceptable on mobile data | ⬜ | Your call |

## Layer accuracy
| Item | Status | Evidence |
|---|---|---|
| Every displayed value equals its raw source | ✅ | Independent audit, about 19,900 values, 0 discrepancies (`docs/DATA_INTEGRITY_AUDIT.md`) |
| No interpolated or filled values | ✅ | Audit, both directions |
| Election seats complete (343 in 2025) and ties shown as ties | ✅ | 5 data tests + browser checks |
| Sources unchanged since retrieval (2026-11-11) | ⬜ | Re-check before each publication |
| Core housing need 2006/2011 decision | ⬜ | Open (audit item R1) |

## Selection, timeline, comparison
| Item | Status | Evidence |
|---|---|---|
| Select province, territory, city; search city list | ✅ | Browser checks |
| Timeline play, drag, arrow keys; census layers stop only on census years | ✅ | Browser checks |
| Place vs place and then-and-now comparisons; no difference across method changes | ✅ | Browser checks |
| Links restore layer, year, place and comparison | ✅ | Browser checks |

## Source inspection
| Item | Status | Evidence |
|---|---|---|
| Source & method reachable from every layer, with publisher, table, licence, date, limitations | ✅ | Browser checks; registry tests |
| Preliminary, postcensal, quality-grade, over-scale and no-value states marked | ✅ | Browser checks |
| Every source link opens the right page | ⬜ | Links were not clicked through |

## Story
| Item | Status | Evidence |
|---|---|---|
| Ten chapters, each with a caveat; numbers generated from data | ✅ | Browser checks; chapter 1 compared with the raw file |
| Urban concentration and age structure | ⬜ | Not built; needs new tables |
| Story on phone | ⬜ | Not viewed |

## Export
| Item | Status | Evidence |
|---|---|---|
| 1080p landscape export from a saved configuration | ✅ | `people-1971-2026` rendered: 1920 × 1080, 30 fps, 41.1 s, H.264 |
| Frames reproducible; on-screen figure equals raw file | ✅ | Browser checks |
| Export package has configuration, per-frame text log, sources and code revision | ✅ | Files present in the export folder |
| Video watched start to finish by a person | ⬜ | I inspected sampled frames only. **Please watch it.** |
| Vertical (Shorts) and square formats | ⬜ | Not built |
| Export from a button, without the command line | ⬜ | Not built |

## Accessibility and readability
| Item | Status | Evidence |
|---|---|---|
| Text contrast (main ≥ 14:1, quiet ≥ 4.8:1), colour-blind separation of ramps | ✅ | Computed in the palette study |
| Keyboard: timeline, chart readout, comparison slider | ✅ | Browser checks |
| Screen reader pass; full keyboard path through nav, panel and dialogs | ⬜ | Not done |
| Map data available without the map (lists, rankings, panel) | ⚠️ | Rankings and city list exist; no full data-table view |

## Offline
| Item | Status | Evidence |
|---|---|---|
| Single-file build opens from disk with data, fonts, relief | ✅ | Opened from `file://` with no errors |
| Timelapse preview from the single-file build | ⬜ | Not tested from `file://` |
