"""Climate: ECCC homogenized station records (AHCCD) and WGMS glacier mass balance for Canada.

AHCCD (Environment and Climate Change Canada): annual mean temperature (homogenized) and total precipitation (adjusted) for
every station, as published; -9999.9 and null are missing, never zero. Station trends as published (Theil-Sen over the
station's record, expressed as change over that record). Anomalies against 1961-1990 are computed in the explorer.

WGMS Fluctuations of Glaciers: glacier-wide annual mass balance (m w.e.) for Canadian glaciers with 10 or more years.

Output: web/data/climate/ahccd.json, web/data/climate/glaciers.json
"""
import csv
import io
import json
import sys
import zipfile
from pathlib import Path

from pyproj import Transformer

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ROOT, load_registry, verify_raw  # noqa: E402

LCC = Transformer.from_crs("EPSG:4326", "EPSG:3347", always_xy=True)   # Statistics Canada Lambert, same as the explorer's map
km = lambda lon, lat: [round(v / 1e3, 2) for v in LCC.transform(lon, lat)]
MISSING = -9000
KEEP_UPPER = {"A", "CDA", "RCS", "CS", "UA", "AUT", "NW", "NE", "SW", "SE", "N", "S", "E", "W", "BC", "ON", "QC", "UBC", "MB", "AB", "SK", "NS", "NB", "PE", "NL", "YT", "NT", "NU", "II", "III", "TCPL", "CFB", "JCT", "H.", "I."}


def title(name):
    """Station and glacier names are published in capitals; title-case them but keep codes (CDA, RCS, A, NW...) as published."""
    return " ".join(w if w in KEEP_UPPER else w.capitalize() if not w[:1].isdigit() else w for w in name.replace("_", " ").split())


def clean(v):
    return None if v is None or v <= MISSING else v


def ahccd(reg):
    A = json.loads(verify_raw(reg["eccc_ahccd_annual"]["raw_file"], reg["eccc_ahccd_annual"]["sha256"]).read_text())["features"]
    S = json.loads(verify_raw(reg["eccc_ahccd_stations"]["raw_file"], reg["eccc_ahccd_stations"]["sha256"]).read_text())["features"]
    T = json.loads(verify_raw(reg["eccc_ahccd_trends"]["raw_file"], reg["eccc_ahccd_trends"]["sha256"]).read_text())["features"]
    meta = {}
    for f in S:
        p = f["properties"]
        if p["measurement_type__type_mesure"] == "temp_mean":
            meta[p["station_id__id_station"]] = dict(name=p["station_name__nom_station"], prov=p["province__province"], elev=p["elevation__elevation"],
                                                    lon=f["geometry"]["coordinates"][0], lat=f["geometry"]["coordinates"][1])
    series = {}
    for f in A:
        p = f["properties"]; sid = p["station_id__id_station"]
        s = series.setdefault(sid, {"t": {}, "p": {}, "lon": p["lon__long"], "lat": p["lat__lat"], "prov": p["province__province"]})
        y = p["year__annee"]
        assert y not in s["t"] or s["t"][y] is None, (sid, y)
        t, pr = clean(p["temp_mean__temp_moyenne"]), clean(p["total_precip__precip_totale"])
        if t is not None: s["t"][y] = t
        if pr is not None: s["p"][y] = pr
    trends, tnames = {}, {}
    for f in T:
        p = f["properties"]
        tnames.setdefault(p["station_id__id_station"], p["station_name__nom_station"])   # precipitation stations are named only here
        if p["trend_value__valeur_tendance"] is None or p["measurement_type__type_mesure"] not in ("temp_mean", "total_precip"):
            continue
        trends.setdefault(p["station_id__id_station"], {})[p["measurement_type__type_mesure"]] = [p["trend_value__valeur_tendance"], p["year_range__annees"]]
    out = []
    for sid, s in sorted(series.items()):
        if not s["t"] and not s["p"]:
            continue
        m = meta.get(sid, {})
        def pack(d):
            if not d: return None
            y0, y1 = min(d), max(d)
            return [y0, [d.get(y) for y in range(y0, y1 + 1)]]
        out.append(dict(id=sid, name=title(m.get("name") or tnames.get(sid) or sid), prov=s["prov"], elev=m.get("elev"), lon=s["lon"], lat=s["lat"],
                        xy=km(s["lon"], s["lat"]), t=pack(s["t"]), p=pack(s["p"]), trend=trends.get(sid, {})))
    years = [y for s in series.values() for y in s["t"]]
    pyears = [y for s in series.values() for y in s["p"]]
    doc = dict(sources=["eccc_ahccd_annual", "eccc_ahccd_stations", "eccc_ahccd_trends"], t_years=[min(years), max(years)], p_years=[min(pyears), max(pyears)],
               notes=["Homogenized annual mean temperature (°C) and adjusted annual total precipitation (mm), as published by ECCC. Missing years stay missing.",
                      "Trend: ECCC's Theil-Sen trend over each station's record, expressed as the change over that record."],
               stations=out)
    dst = ROOT / "web/data/climate/ahccd.json"; dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(json.dumps(doc, separators=(",", ":"), ensure_ascii=False))
    print(dst.relative_to(ROOT), round(dst.stat().st_size / 1e6, 2), "MB", len(out), "stations", doc["t_years"], doc["p_years"])


def glaciers(reg):
    r = reg["wgms_fog_2026_02_10"]
    z = zipfile.ZipFile(verify_raw(r["raw_file"], r["sha256"]))
    rd = lambda n: csv.DictReader(io.TextIOWrapper(z.open(n), encoding="utf-8"))
    ca = {g["id"]: g for g in rd("data/glacier.csv") if g["country"] == "CA"}
    by = {}
    for m in rd("data/mass_balance.csv"):
        if m["glacier_id"] in ca and m["annual_balance"] != "":
            d = by.setdefault(m["glacier_id"], {})
            y = int(m["year"])
            assert y not in d, (ca[m["glacier_id"]]["short_name"], y)   # one glacier-wide value per year
            d[y] = float(m["annual_balance"])
    out = []
    for gid, d in by.items():
        if len(d) < 10:
            continue
        g = ca[gid]; lon, lat = float(g["longitude"]), float(g["latitude"])
        y0, y1 = min(d), max(d)
        out.append(dict(id=gid, name=title(g["short_name"]), region=g["gtng_region"], lon=lon, lat=lat, xy=km(lon, lat),
                        b=[y0, [d.get(y) for y in range(y0, y1 + 1)]], n=len(d)))
    out.sort(key=lambda g: -g["n"])
    doc = dict(source_id="wgms_fog_2026_02_10", units="m w.e. per year", notes=["Glacier-wide annual mass balance as reported to WGMS. Negative means the glacier lost ice that year.",
               "Cumulative balance is the running sum of published annual values from each glacier's first year; gaps break the sum."], glaciers=out)
    dst = ROOT / "web/data/climate/glaciers.json"
    dst.write_text(json.dumps(doc, separators=(",", ":"), ensure_ascii=False))
    print(dst.relative_to(ROOT), len(out), "glaciers:", ", ".join(f"{g['name']} {g['b'][0]}-{g['b'][0] + len(g['b'][1]) - 1} ({g['n']})" for g in out))


if __name__ == "__main__":
    reg = load_registry()["sources"]
    ahccd(reg); glaciers(reg)
