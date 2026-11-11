# Canada Through Time

An interactive 3D historical map of Canada, plus a studio that renders sourced, publication-ready timelapse videos from it.

**Status: session 1.** One complete story runs from start to finish: the population of every province and territory, 1971–2026. It goes from Statistics Canada's own file to the 3D map to MP4s in 16:9, 9:16 and 1:1, with a publication package for each.

## Quick start

```bash
npm install                      # deck.gl, mapshaper
pip install pyyaml pytest playwright

python3 pipeline/ingest_population.py   # raw StatCan zip -> processed CSV + web JSON
bash pipeline/build_geography.sh        # Natural Earth -> projected boundaries
python3 -m pytest -q tests              # data validation

# interactive explorer
python3 -m http.server -d web 8000      # open http://localhost:8000/?fmt=16x9

# render videos (headless Chrome + ffmpeg)
python3 render/render.py --story population-provinces-1971-2026 --fmt 16x9
python3 render/render.py --story population-provinces-1971-2026 --fmt 9x16
python3 render/render.py --story population-provinces-1971-2026 --fmt 1x1
python3 render/render.py --story population-provinces-1971-2026 --fmt 16x9 --scale 2   # 3840x2160
python3 render/package.py --story population-provinces-1971-2026                    # post, stats, sources
```

## Layout

| Path | Role |
|---|---|
| `registry/sources.yaml` | Source registry. Every dataset has its publisher, table, DOI, URL, SHA-256, licence, methodology notes and limitations. |
| `data/raw/` | Original downloads, never modified. Pipelines refuse to run if a hash changes. |
| `data/processed/` | Long-format tables with provenance columns (`source_id`, `vector`, `status`). |
| `pipeline/` | Ingestion and geography builds. |
| `web/` | The map. `app.js` is a pure function of (story, format, frame), and the explorer and the renderer both use it. |
| `web/stories/*.json` | Story or project configs: dates, camera keyframes, annotations, formats. Re-render any time the data changes. |
| `render/` | `render.py` drives headless Chrome frame by frame into ffmpeg. `package.py` builds the publication package. |
| `tests/` | Data validation (hashes, contiguity, provinces sum to Canada, spot checks against the published table). |
| `exports/` | Videos and packages. Ignored by git. |

## Integrity rules built into the code

- Raw files are hash-verified on every run. Changed data must be registered as a new version.
- Numbers on screen are always a published value. Animation interpolates geometry only, and every frame states which quarter's estimate is shown.
- Boundary changes are explicit. Before July 1991 the Northwest Territories and Nunavut are shown as one region, because that is all Statistics Canada publishes for those dates.
- Series start at July 1971. Earlier estimates are on a different methodology (not adjusted for census undercoverage).
- Milestones are derived from the data and labelled as derived.

See `docs/ARCHITECTURE.md` and `docs/SESSION_LOG.md`.
