# Field Atlas design system (draft, pending approval)

The full rationale, critique and roadmap are in the review doc linked from `docs/SESSION_LOG.md`. This file holds the rules code must follow. Tokens live in `web/theme.css`.

## Principles
1. One question per frame; the headline states the finding, and a test checks the claim (`tests/test_story_claims.py`).
2. The map is a quiet stage: land, water and boundaries are neutral. Only data marks carry colour.
3. Honest geometry: Statistics Canada Lambert. Counts are spikes or symbols, never extruded areas. Rates are fills.
4. Show the seams: preliminary values, rounding, boundary changes, gaps and series breaks appear in the frame.
5. Canadian through care, not symbols: no flags, maple leaves or red-and-white branding.

## Colour jobs (one job per colour)
| Job | Tokens | Rule |
|---|---|---|
| Change | `--grow-1..4`, `--neutral`, `--decline-1..3` | Teal up, ochre down. Within ±2% is neutral. |
| Magnitude | single blue ramp (to add when first needed) | Never reuse the change ramp. |
| Identity | at most 5 fixed-order hues, always labelled | Components of growth and similar. |
| Accent | `--accent` | Events, selection, focus. Never a data value. |
| Party colours | election layers only | Labelled and patterned. |

All ramps were checked with the dataviz palette validator (ordinal: monotone lightness, step gaps, light-end contrast). Change poles and the accent separate under CVD simulation (ΔE ≥ 10) and normal vision (ΔE ≥ 15).

## Type
Source Serif 4 (finding headline, date numeral, cartographic water names). IBM Plex Sans with tabular figures (values, labels, UI). IBM Plex Mono (sources, IDs, evidence tags). All are SIL OFL and bundled in `web/fonts/`.

## Numbers and labels
- Use 3 significant figures everywhere (16.3M, 883K, 43.1K) and say so in the frame. The hero total may be exact.
- Map labels use Canada Post codes; prose uses full names. Small provinces get offshore callouts with leader lines.
- Always show units and denominators.

## Motion
- One steady time rate per story. Pause 0.9 s at each event; cards stay 2.6 s.
- Numbers show the last published value, never an interpolated one.
- One camera move per shot, and it must do work. No moves during a card.

## 9:16 safe zones (1080 × 1920)
Leave empty: top 150 px, bottom 340 px, and the right 140 px between y 1000 and 1580 (Reels and TikTok buttons). Margins are 64 px. Minimum text: 26 px for primary values, 22 px for labels, 19 px for sources. Preview with `?safe=1`.

## Evidence tags (shape + word; never colour alone)
■ Official statistic · ▲ Derived · ◇ Estimate · ● Historical fact · ◆ Research finding · ⟷ Moves together · → Evidence of effect · ? Contested · ∅ No data.
Causal verbs are allowed only on "Evidence of effect" items that cite a source. This is enforced by a test.
