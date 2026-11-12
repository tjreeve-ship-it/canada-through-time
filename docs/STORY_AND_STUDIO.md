# Flagship story and Timelapse Studio

Build: `web/explore-studio/` (copy of the corrected `explore-release`; earlier builds and the frozen checkpoint are unchanged). Visual identity is unchanged: Field Paper · Ember, shaded relief, Source Serif 4 + Public Sans.

## 1. Flagship story — "How Canada's population changed, 1971–2026"

**Where:** "Start here" → the first, outlined entry. Or add `?story=0` to the address.

**What it is:** ten chapters. Each one switches the map to a layer, year and (sometimes) place, and shows a short card: what the data says, a "keep in mind" caveat, Back / Next. Picking any other layer leaves the story.

| # | Chapter | Layer | Figures computed from |
|---|---|---|---|
| 1 | From 22 million to 42 million | People | July 1 estimates, 1971 and latest |
| 2 | Growth was uneven | Change since 1971 | fastest and slowest province; count above the national rate |
| 3 | The balance between provinces shifted | Share of Canadians | largest gain and loss in share |
| 4 | A large country, thinly settled on average | People per km² | highest, lowest, Canada |
| 5 | Not every year was growth | Growth in the past year | number of province-years of decline; largest one-year fall |
| 6 | Moving between provinces | Migration flows | total moves and largest stream, latest year; Alberta's years of gain and loss |
| 7 | Arrivals from other countries | Immigrants | highest, lowest and latest national rate |
| 8 | Temporary residents | Temporary residents (net) | highest, lowest and latest national rate |
| 9 | Births minus deaths | Natural increase | first and latest national rate; provinces where deaths exceed births |
| 10 | What this story does not cover yet | People | — |

**How accuracy is protected**
- No number in the story is typed by hand. Each sentence is generated from the loaded data when the card is drawn, so it cannot drift from the map or from a future data refresh.
- A browser check compares chapter 1's figures with the raw Statistics Canada file, and checks every chapter for broken numbers and a caveat.
- Annual estimates are described as estimates; census-based layers are not used in this story. Preliminary and postcensal status is stated in chapter 1 and marked on the layers.
- The story describes change. It makes no causal statements, and chapter 10 says so.

**Not covered (stated in chapter 10):** urban concentration and age structure. Both need tables that are not yet in the project (metropolitan-area population; population by age). They should be added through the registry and audited before they appear.

## 2. Timelapse Studio

**What exists now, end to end**

| Step | How |
|---|---|
| Select a layer and geography | Use the explorer normally; the Studio takes the current layer and selected place. |
| Open the Studio | "Make a timelapse" chip beside the date and source chips (desktop). |
| Select the period | From / To, limited to the layer's published range. Census layers only ever use census dates. |
| Camera | Slow push-in, still, pan west to east, gentle turn. |
| Titles and notes | Title, subtitle, and on-screen notes ("year: text"). Defaults are generated from the data (population milestones, the 1991 territorial split, method changes, preliminary status). |
| Legend | The layer's own legend is carried into the frame. |
| Preview | "Preview" opens the timelapse in a new tab, playing in real time with a scrubber. |
| Save | "Download configuration" saves one JSON file that fully describes the timelapse. |
| Export | `python3 render/timelapse.py <configuration>.json` → 1920 × 1080, 30 fps, H.264 MP4. |
| Sources and method | Every frame carries a source line. The last five seconds show a sources-and-method card. The export folder includes `sources.json`. |

**What an export contains** (`exports/timelapses/<id>/`)
- `<id>_1080p.mp4`
- `config.json` — the exact configuration used
- `<id>.frames.json` — for every frame: year, phase, title, the finding sentence and any note on screen (so on-screen claims can be checked)
- `sources.json` — registry entries, licences, raw-file fingerprints, code revision and build-file hashes
- `poster.png`

**Honesty rules built in**
- A frame shows the published value for one year. Nothing is interpolated between years; columns and colours step from year to year. The only continuous motion is the camera.
- Missing values stay missing; the same "no published value" stipple and over-scale markers appear in video.
- Frames are deterministic: the same configuration and frame number give the same picture (checked).

**Limits today**
- Export runs from the command line, not from a button in the browser. Preview and configuration work in the browser, including the offline single-file build.
- Rendering is slow in this environment (about 1.5 seconds per frame without a graphics card; roughly half an hour for a 41-second video).
- One format: 1080p landscape. Vertical (Shorts) and square are not built yet.
- Camera choices are four presets, not free keyframes. No narration, music or captions track.
- Phone layout has no Studio entry point.

## 3. First export

`timelapses/people-1971-2026.json` → "Where Canadians live", People layer, all of Canada, 1971–2026, slow push-in, 56 years at 0.6 s each, about 41 seconds.

**Result:** `exports/timelapses/people-1971-2026/people-1971-2026_1080p.mp4` — 1920 × 1080, 30 fps, 1,233 frames, 41.1 seconds, H.264, 20.6 MB. Rendered from commit `042e76e` (the build-file hashes in the export's `sources.json` match that commit; the "uncommitted" flag in that file is true because the commit was made straight after the render).

The first render was discarded: it showed the explorer's red history pins on the map with no explanation, and the intro subtitle overlapped the date. Both were fixed and the video was rendered again.

**Inspected:** frames sampled at 1, 9, 27, 33 and 39 seconds, plus the per-frame text log (all six notes appear; every frame's year and finding recorded). The video has not been watched in motion by anyone yet.

**After the render** one change was made to the build: while a story chapter is open, the reading block hides the long legend notes so the card no longer runs into the timeline on desktop. It does not affect video frames.
