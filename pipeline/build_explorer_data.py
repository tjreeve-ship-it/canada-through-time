"""Build the explorer's data files from raw sources (all hash-verified against the registry).

Outputs (web/data/explorer/):
  components.json  annual components of growth by province (July–June periods), StatCan 17-10-0008
  flows.json       interprovincial migrants origin→destination, summed to July–June periods, StatCan 17-10-0045
  area.json        land area (km², 2021 Census), StatCan 98-10-0001
  politics.json    federal ministries (ParlInfo) and federal general election seats by province × party (ParlInfo)
  events.json      dated, located, evidence-tagged events
"""
from __future__ import annotations

import csv
import io
import json
import xml.etree.ElementTree as ET
import zipfile
from collections import defaultdict
from pathlib import Path

from common import ROOT, load_registry, verify_raw

OUT = ROOT / "web/data/explorer"
NAME2ABBR = {
    "Canada": "CAN", "Newfoundland and Labrador": "NL", "Prince Edward Island": "PE", "Nova Scotia": "NS", "New Brunswick": "NB",
    "Quebec": "QC", "Ontario": "ON", "Manitoba": "MB", "Saskatchewan": "SK", "Alberta": "AB", "British Columbia": "BC",
    "Yukon": "YT", "Northwest Territories": "NT", "Nunavut": "NU", "Northwest Territories including Nunavut": "NT+NU",
}


def read_zip_csv(rel: str, sha: str, member: str) -> list[dict]:
    with zipfile.ZipFile(verify_raw(rel, sha)) as z:
        return list(csv.DictReader(io.StringIO(z.read(member).decode("utf-8-sig"))))


def dump(name: str, obj) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / name).write_text(json.dumps(obj, separators=(",", ":"), ensure_ascii=False))
    print(f"{name}: {(OUT / name).stat().st_size / 1024:.0f} KB")


def components(reg):
    s = reg["statcan_17100008"]
    rows = read_zip_csv(s["raw_file"], s["sha256"], "17100008.csv")
    keep = {"Births": "births", "Deaths": "deaths", "Immigrants": "immigrants", "Net emigration": "net_emigration",
            "Emigrants": "emigrants", "Returning emigrants": "returning_emigrants", "Net temporary emigration": "net_temporary_emigration",
            "Net non-permanent residents": "net_npr", "Net interprovincial migration": "net_interprovincial", "Residual deviation": "residual"}
    data = defaultdict(lambda: defaultdict(dict))
    status = {}
    for r in rows:
        k = keep.get(r["Components of population growth"])
        if not k or r["VALUE"] == "":
            continue
        y = int(r["REF_DATE"][:4])  # "1971/1972" → period starting July 1, 1971
        data[NAME2ABBR[r["GEO"]]][y][k] = int(float(r["VALUE"]))
        if r["STATUS"]:
            status[f"{r['REF_DATE']}"] = r["STATUS"]
    dump("components.json", {"source_id": "statcan_17100008", "period": "July 1 of year Y to June 30 of year Y+1",
                             "data": {g: {str(y): v for y, v in sorted(ys.items())} for g, ys in data.items()}})


def flows(reg):
    s = reg["statcan_17100045"]
    rows = read_zip_csv(s["raw_file"], s["sha256"], "17100045.csv")
    agg = defaultdict(int)
    for r in rows:
        if r["VALUE"] == "":
            continue
        o = NAME2ABBR[r["GEO"].replace(", province of origin", "")]
        d = NAME2ABBR[r["Geography, province of destination"].replace(", province of destination", "")]
        if o == d:
            continue
        y, m = int(r["REF_DATE"][:4]), int(r["REF_DATE"][5:7])
        period = y if m >= 7 else y - 1  # quarters Jul, Oct of Y and Jan, Apr of Y+1 → period Y/Y+1
        agg[(period, o, d)] += int(float(r["VALUE"]))
    by = defaultdict(list)
    for (p, o, d), v in sorted(agg.items()):
        if v > 0:
            by[str(p)].append([o, d, v])
    # the latest period may be incomplete (fewer than 4 quarters)
    quarters = defaultdict(set)
    for r in rows:
        y, m = int(r["REF_DATE"][:4]), int(r["REF_DATE"][5:7])
        quarters[y if m >= 7 else y - 1].add(m)
    complete = sorted(int(p) for p in by if len(quarters[int(p)]) == 4)
    dump("flows.json", {"source_id": "statcan_17100045", "period": "July 1 of year Y to June 30 of year Y+1 (sum of four quarters)",
                        "complete_periods": complete, "data": {p: v for p, v in by.items() if int(p) in complete}})


def area(reg):
    s = reg["statcan_98100001"]
    rows = read_zip_csv(s["raw_file"], s["sha256"], "98100001.csv")
    col = next(k for k in rows[0] if "Land area in square kilometres" in k)
    dump("area.json", {"source_id": "statcan_98100001", "year": 2021, "units": "km²",
                       "data": {NAME2ABBR[r["GEO"]]: float(r[col]) for r in rows}})


def politics(reg):
    s = reg["parlinfo_elected"]
    root = ET.parse(verify_raw(s["raw_file"], s["sha256"])).getroot()
    seats = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
    for c in root.findall("ElectionCandidateForWeb"):
        if c.findtext("IsGeneral") != "true":
            continue
        d = c.findtext("ElectionDate")[:10]
        if d < "1972":
            continue
        seats[d][NAME2ABBR[c.findtext("ProvinceEn")]][c.findtext("PartyNameEn")] += 1
    elections = []
    for d in sorted(seats):
        prov = {p: dict(sorted(v.items(), key=lambda kv: -kv[1])) for p, v in seats[d].items()}
        total = defaultdict(int)
        for v in prov.values():
            for party, n in v.items():
                total[party] += n
        elections.append({"date": d, "seats_by_province": prov, "seats_total": dict(sorted(total.items(), key=lambda kv: -kv[1])),
                          "seats_recorded": sum(total.values())})
    pms = json.loads((ROOT / "data/raw/parlinfo/prime_ministers_since_1968.json").read_text())
    dump("politics.json", {"sources": ["parlinfo_elected", "parlinfo_prime_ministers"], "ministries": pms["ministries"], "elections": elections})


def lcc(lon: float, lat: float) -> tuple[float, float]:
    """Lambert Conformal Conic 2SP on GRS80 with Statistics Canada's EPSG:3347 parameters → km (matches the map geometry)."""
    import math
    a, f = 6378137.0, 1 / 298.257222101
    e = math.sqrt(2 * f - f * f)
    p1, p2, p0, l0 = map(math.radians, (49.0, 77.0, 63.390675, -91.86666666666666))
    m = lambda p: math.cos(p) / math.sqrt(1 - (e * math.sin(p)) ** 2)  # noqa: E731
    t = lambda p: math.tan(math.pi / 4 - p / 2) / ((1 - e * math.sin(p)) / (1 + e * math.sin(p))) ** (e / 2)  # noqa: E731
    n = (math.log(m(p1)) - math.log(m(p2))) / (math.log(t(p1)) - math.log(t(p2)))
    F = m(p1) / (n * t(p1) ** n)
    r = lambda p: a * F * t(p) ** n  # noqa: E731
    th = n * (math.radians(lon) - l0)
    x = 6200000 + r(math.radians(lat)) * math.sin(th)
    y = 3000000 + r(p0) - r(math.radians(lat)) * math.cos(th)
    return round(x / 1000, 1), round(y / 1000, 1)


def events(reg):
    cur = json.loads((ROOT / "registry/events_curated.json").read_text())["events"]
    out = []
    for e in cur:
        out.append({**e, "xy": lcc(e["lon"], e["lat"])})
    ottawa = lcc(-75.7009, 45.4236)
    pol = json.loads((OUT / "politics.json").read_text())
    for m in pol["ministries"]:
        if m["start"] >= "1971-07-01":
            out.append({"date": m["start"], "title": f"{m['pm']} becomes Prime Minister", "body": f"{m['ministry']}th Ministry; {m['party']}.",
                        "tag": "historical_fact", "places": [], "xy": ottawa, "where": "Ottawa", "kind": "ministry",
                        "source": "Library of Parliament, ParlInfo — Prime Ministers of Canada", "source_url": reg["parlinfo_prime_ministers"]["landing_url"]})
    for el in pol["elections"]:
        top = list(el["seats_total"].items())
        lead, n = top[0]
        out.append({"date": el["date"], "title": f"Federal election: {lead} wins {n} seats", "kind": "election",
                    "body": " · ".join(f"{p}: {v}" for p, v in top[:5]) + f" (of {el['seats_recorded']} recorded)",
                    "tag": "official_statistic", "places": [], "xy": ottawa, "where": "Ottawa",
                    "source": "Library of Parliament, ParlInfo — Elections and Elected Candidates", "source_url": reg["parlinfo_elected"]["landing_url"]})
    out.sort(key=lambda e: e["date"])
    dump("events.json", {"events": out})


def registry(reg):
    keep = ("title", "publisher", "table_id", "doi", "landing_url", "reporting_period", "retrieved", "licence", "attribution",
            "quality_class", "methodology_notes", "limitations", "sha256", "units")
    dump("registry.json", {k: {f: v[f] for f in keep if f in v} for k, v in reg.items()})


def main():
    reg = load_registry()["sources"]
    components(reg); flows(reg); area(reg); politics(reg); events(reg); registry(reg)


if __name__ == "__main__":
    main()
