# Session log

## Session 1 — 2026-11-11

**Built**
- Source registry (`registry/sources.yaml`), with hash-verified raw files.
- Population pipeline for Statistics Canada Table 17-10-0009-01: 221 quarters (July 1971 to July 2026), 13 provinces and territories plus Canada, and NT+NU combined before July 1991.
- Geography pipeline: Natural Earth boundaries in Statistics Canada Lambert, a dissolved NT+NU region for the years before the split, and context countries, lakes and rivers.
- 3D map (deck.gl): extruded prisms (height = population, colour = change), lighting, labels, orbit camera, timeline, ranking, legend, annotation cards, source credits. Layouts for 16:9, 9:16 and 1:1.
- Interactive explorer: play/pause, scrub, format switch, free camera.
- Frame-exact video renderer (headless Chrome → ffmpeg) and a publication package generator.
- 7 validation tests, all passing.

**Data incorporated**
- Statistics Canada 17-10-0009-01 (retrieved 2026-11-11, file dated 2026-09-23).
- Natural Earth admin-1, countries, lakes, rivers (public domain).

**Notes**
- Statistics Canada isn't reachable from the build server's shell, so data is fetched through the user's desktop browser and verified by SHA-256. Automated source monitoring will need either a desktop-side job or a widened network allowlist.

**Rendered**
- 16:9 1920×1080, 9:16 1080×1920 and 1:1 1080×1080 at 30 fps, 34 s each, about 19 min per render on 2 CPUs (software WebGL).

**Known issues for session 2**
- Annotation cards stay on screen too long (about 6 years of playback). Cut to about 2.5 s and add short pauses at key events.
- Atlantic labels (NB/PE/NS) crowd each other. Needs leader lines or an inset.
- The vertical layout's Canada total slightly overlaps the map's top-left edge.

**Next**
1. Components of growth (17-10-0008 annual; 17-10-0040 international; 17-10-0020/0045 interprovincial), shown as animated flow arcs. Second story: "Where Canada's growth came from".
2. PostgreSQL/PostGIS store, plus a `make` target that runs every pipeline and test.
3. Statistics Canada census-division and CMA boundaries for city-scale stories.
4. A story catalogue page and a batch-render queue.
