"""Age structure and urban concentration.

  web/data/demography/age.json          median age, share aged 65+, share under 15 (table 17-10-0005-01, annual July 1, 1971-)
  web/data/demography/metro.json        share of people living in census metropolitan areas, and each CMA's population
                                        (table 17-10-0148-01, annual July 1, 2001-, 2021 boundaries)
  web/data/demography/urban_census.json urban share at each census 1971-2006 (table 17-10-0118-01; series ends 2006)

Values are taken as published. Shares are published counts divided by published totals from the same table and year.
Nothing is interpolated, extended or filled.
"""
import csv, io, json, re, zipfile
from collections import defaultdict
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "web/data/demography"
AB = {"Canada": "CAN", "Newfoundland and Labrador": "NL", "Prince Edward Island": "PE", "Nova Scotia": "NS", "New Brunswick": "NB", "Quebec": "QC", "Ontario": "ON", "Manitoba": "MB",
      "Saskatchewan": "SK", "Alberta": "AB", "British Columbia": "BC", "Yukon": "YT", "Northwest Territories": "NT", "Nunavut": "NU", "Northwest Territories including Nunavut": "NT+NU"}

def table(t):
    z = zipfile.ZipFile(ROOT / f"data/raw/statcan/{t}-eng.zip")
    rows = csv.DictReader(io.TextIOWrapper(z.open(f"{t}.csv"), encoding="utf-8-sig"))
    meta = z.read(f"{t}_MetaData.csv").decode("utf-8-sig")
    return rows, meta
num = lambda s: None if s in ("", None) else float(s)

def age():
    rows, meta = table("17100005"); raw = defaultdict(lambda: defaultdict(dict))
    want = {"All ages": "total", "0 to 14 years": "u15", "65 years and older": "o65", "Median age": "median"}
    for r in rows:
        if r["Gender"] == "Total - gender" and r["Age group"] in want and r["GEO"] in AB and num(r["VALUE"]) is not None:
            raw[AB[r["GEO"]]][r["REF_DATE"]][want[r["Age group"]]] = num(r["VALUE"])
    data = {}
    for g, ys in raw.items():
        data[g] = {}
        for y, v in sorted(ys.items()):
            if "total" not in v: continue
            data[g][y] = {"total": int(v["total"]), "median": v.get("median"),
                          "u15": int(v["u15"]) if "u15" in v else None, "o65": int(v["o65"]) if "o65" in v else None}
    m = re.search(r"preliminary postcensal for (\d{4})", meta); m2 = re.search(r"final postcensal for (\d{4})", meta)
    return {"source": "statcan_17100005", "prelim_from": int(m.group(1)) if m else None, "postcensal_from": int(m2.group(1)) if m2 else None, "data": data}

def metro():
    rows, meta = table("17100148"); v = defaultdict(dict)
    for r in rows:
        if r["Gender"] == "Total - gender" and r["Age group"] == "All ages" and num(r["VALUE"]) is not None: v[r["GEO"]][r["REF_DATE"]] = int(num(r["VALUE"]))
    years = sorted(v["Canada"]); data = {"CAN": {y: {"cma": v["All census metropolitan areas, Canada"][y], "total": v["Canada"][y]} for y in years}}; no_cma = []
    for name, ab in AB.items():
        if ab in ("CAN", "NT+NU"): continue
        both = v.get(f"All census metropolitan areas and census agglomerations, {name}") or v.get(f"All census agglomerations, {name}") or {}
        outside = v.get(f"Area outside census metropolitan areas and census agglomerations, {name}", {}); cma = v.get(f"All census metropolitan areas, {name}")
        if cma is None: no_cma.append(ab)
        # a territory with no CMA or CA (Nunavut) has only the "area outside" row; that row is then its whole population
        data[ab] = {y: {"cma": cma[y] if cma else None, "total": both.get(y, 0) + outside[y]} for y in years if y in outside and (y in both or not both)}
    cmas = {}
    for geo, ys in v.items():
        mm = re.match(r"^(.*) \(CMA\), (.*)$", geo)
        if mm and "part" not in geo: cmas[mm.group(1)] = {"province": mm.group(2), "pop": ys}
    p = re.search(r"preliminary postcensal for (\d{4})", meta)
    return {"source": "statcan_17100148", "boundaries": "2021 Standard Geographical Classification", "prelim_from": int(p.group(1)) if p else None, "no_cma": no_cma, "years": [int(years[0]), int(years[-1])], "data": data, "cmas": cmas}

def urban_census():
    rows, _ = table("17100118"); data = defaultdict(dict); years = set()
    for r in rows:
        if r["Population characteristics"] == "Urban population as a share of total population" and r["GEO"] in AB and num(r["VALUE"]) is not None:
            data[AB[r["GEO"]]][r["REF_DATE"]] = num(r["VALUE"]); years.add(int(r["REF_DATE"]))
    return {"source": "statcan_17100118", "years": sorted(years), "data": data}

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, fn in (("age", age), ("metro", metro), ("urban_census", urban_census)):
        d = fn(); (OUT / f"{name}.json").write_text(json.dumps(d, separators=(",", ":"), ensure_ascii=False))
        print(name, {k: (x if not isinstance(x, (dict, list)) or k in ("years", "no_cma") else len(x)) for k, x in d.items()})

if __name__ == "__main__":
    main()
