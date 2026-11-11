# Architecture decisions

## Session 1 (2026-11-11)

**Rendering: deck.gl (WebGL) with an orbit camera, not CesiumJS (for now).**
Cesium's value is global terrain and imagery streamed from Cesium ion. That service isn't reachable from the build environment, and the renderer has to be deterministic and work offline. deck.gl gives 3D extrusion, lighting, an orbit camera and good performance with large datasets, all from a local bundle. The data model is engine-agnostic: geometry is GeoJSON, values are series keyed by StatCan codes, and stories are JSON. A Cesium terrain view can be added later as a separate visualization mode.

**Projection: Statistics Canada Lambert Conformal Conic (EPSG:3347 parameters).**
Web Mercator inflates the Arctic badly. Statistics Canada's own projection keeps Canada's shape honest, and prism footprints keep their relative areas.

**Video: frame-exact capture.** `render.py` loads the real page in headless Chrome. It calls `CTT.renderFrame(n)` for every frame, waits for paint, takes a screenshot and pipes it into ffmpeg (H.264, CRF 18, yuv420p, faststart). Nothing depends on wall-clock time, so renders are reproducible. 4K output uses `--scale 2`.

**Data: files plus a registry first, PostgreSQL/PostGIS next.**
With one table, a database adds nothing yet. The processed CSVs already use the long schema the database will use (`ref_date, geo_code, value, status, source_id`). PostGIS comes in when boundaries vary over time (municipal amalgamations, census subdivisions).

**Boundaries: Natural Earth 1:10m for provinces.**
These are public domain and fine at national scale. Statistics Canada cartographic boundary files (by census year) will replace them for CMA, CSD and other sub-provincial layers. That's also when boundary versioning by date starts to matter.

## Planned modules

ingest → validate → store (PostGIS) → analytical engine → visualization → timelapse → render → publication.
The source registry runs through all of them: every displayed number carries its `source_id`.

## US expansion hooks

Geography codes, projections and source registries are already parameters, not constants. A country config (`countries/ca.yaml`) is the next refactor, once a second Canadian layer exists to generalize from.
