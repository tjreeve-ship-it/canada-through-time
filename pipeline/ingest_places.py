"""Place names for the neighbourhood maps, so people can tell where they are (Mississauga, St. Albert, Laval…).

Source: Natural Resources Canada's Canadian Geographical Names Database (official names only):
  - municipalities: cities, towns, villages and other municipalities (concise types CITY, TOWN, VILG, MUN2; counties and upper-tier regions are left out);
  - urban communities: separately named areas inside a municipality (concise UNP, generic 200 "Urban Community").
A name is kept for a city when its point falls inside one of that city's census tracts. Points are the database's
official locations; nothing is moved or invented. Duplicate names within 3 km in one city are kept once.

Output: web/data/cities/places.json  {cma DGUID: [[name, x_km, y_km, rank], ...]}  rank 1 city, 2 town or municipality,
3 village, 4 urban community (lower ranks are shown only when zoomed in).
"""
import json
import sys
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import Point, shape
from shapely.strtree import STRtree

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ROOT, load_registry, verify_raw  # noqa: E402

RANK = {"CITY": 1, "TOWN": 2, "MUN2": 2, "VILG": 3, "UNP": 4}   # MUN1 (upper-tier regions and counties) left out: their point is an office, not a place people mean
LCC = Transformer.from_crs("EPSG:4326", "EPSG:3347", always_xy=True)


def main():
    reg = load_registry()["sources"]
    items = []
    for sid in ("nrcan_cgndb_municipalities", "nrcan_cgndb_urban_communities"):
        r = reg[sid]
        items += json.loads(verify_raw(r["raw_file"], r["sha256"]).read_text())["items"]
    keep = [i for i in items if i["status"]["code"] == "official" and i["concise"]["code"] in RANK and (i["concise"]["code"] != "UNP" or i["generic"]["code"] == "200")
            and not i["name"].endswith((" County", " District", " Region"))]
    P = json.loads((ROOT / "web/data/cities/ct_profile.json").read_text())
    shapes = json.loads((ROOT / "web/data/cities/ct_shapes.geojson").read_text())["features"]   # EPSG:3347 metres
    geoms = [shape(f["geometry"]) for f in shapes]
    cmas = [P["areas"][f["properties"]["DGUID"]]["cma"] for f in shapes]
    tree = STRtree(geoms)
    out, seen = {}, set()
    for i in sorted(keep, key=lambda i: RANK[i["concise"]["code"]]):
        x, y = LCC.transform(i["longitude"], i["latitude"])
        pt = Point(x, y)
        hits = [k for k in tree.query(pt) if geoms[k].contains(pt)]
        if not hits:
            continue
        cma = cmas[hits[0]]
        name = i["name"]
        lst = out.setdefault(cma, [])
        if any(n == name and (abs(px - x / 1e3) < 3 and abs(py - y / 1e3) < 3) for n, px, py, _ in lst):
            continue
        if i["id"] in seen:
            continue
        seen.add(i["id"])
        lst.append([name, round(x / 1e3, 2), round(y / 1e3, 2), RANK[i["concise"]["code"]]])
    dst = ROOT / "web/data/cities/places.json"
    dst.write_text(json.dumps(dict(sources=["nrcan_cgndb_municipalities", "nrcan_cgndb_urban_communities"], places=out), separators=(",", ":"), ensure_ascii=False))
    names = {P["areas"][c]["name"]: len(v) for c, v in out.items()}
    print(dst.relative_to(ROOT), round(dst.stat().st_size / 1e3), "KB;", sum(len(v) for v in out.values()), "names in", len(out), "cities;",
          ", ".join(f"{k} {v}" for k, v in sorted(names.items(), key=lambda kv: -kv[1])[:6]))


if __name__ == "__main__":
    main()
