"""Climate data: every published value carried through exactly; missing stays missing; the trend unit is what we say it is."""
import csv, io, json, statistics, zipfile
from pathlib import Path
import pytest, yaml

ROOT = Path(__file__).resolve().parent.parent
REG = yaml.safe_load((ROOT / "registry/sources.yaml").read_text())["sources"]
A = json.loads((ROOT / "web/data/climate/ahccd.json").read_text())
G = json.loads((ROOT / "web/data/climate/glaciers.json").read_text())
RAW = json.loads((ROOT / REG["eccc_ahccd_annual"]["raw_file"]).read_text())["features"]


def unpack(p):
    return {} if not p else {p[0] + i: v for i, v in enumerate(p[1]) if v is not None}


def test_every_station_year_matches_the_raw_api_records():
    st = {s["id"]: (unpack(s["t"]), unpack(s["p"])) for s in A["stations"]}
    n = 0
    for f in RAW:
        p = f["properties"]; sid, y = p["station_id__id_station"], p["year__annee"]
        t, pr = p["temp_mean__temp_moyenne"], p["total_precip__precip_totale"]
        T, P = st.get(sid, ({}, {}))
        if t is None or t <= -9000: assert y not in T
        else: assert T[y] == t; n += 1
        if pr is None or pr <= -9000: assert y not in P
        else: assert P[y] == pr
    assert n > 45000   # 49,431 station-years of temperature at retrieval
    assert all(v > -9000 for s in A["stations"] for v in unpack(s["t"]).values())


def test_published_trend_is_change_over_the_record():
    # ECCC's trend value equals the Theil-Sen slope times the number of years in year_range (checked on stations with full records)
    checked = 0
    for s in A["stations"]:
        tr = s["trend"].get("total_precip")
        if not tr or not tr[1] or checked >= 3: continue
        a, b = map(int, tr[1].split("-")); xs = [(y, v) for y, v in unpack(s["p"]).items() if a <= y <= b]
        if len(xs) < (b - a + 1) * 0.95: continue
        sl = statistics.median((xs[j][1] - xs[i][1]) / (xs[j][0] - xs[i][0]) for i in range(len(xs)) for j in range(i + 1, len(xs)))
        assert abs(sl * (b - a + 1) - tr[0]) <= max(1.0, abs(tr[0]) * 0.03), (s["name"], sl * (b - a + 1), tr[0]); checked += 1
    assert checked == 3


def test_station_coordinates_land_in_canada_on_the_explorer_projection():
    for s in A["stations"]:
        x, y = s["xy"]
        assert 3500 < x < 9300 and 200 < y < 5400, s["name"]   # Alert, NU is near 5,215


@pytest.mark.skipif(not (ROOT / REG["wgms_fog_2026_02_10"]["raw_file"]).exists(), reason="WGMS zip not present")
def test_glacier_balances_match_wgms():
    z = zipfile.ZipFile(ROOT / REG["wgms_fog_2026_02_10"]["raw_file"])
    raw = {}
    for r in csv.DictReader(io.TextIOWrapper(z.open("data/mass_balance.csv"), encoding="utf-8")):
        if r["annual_balance"] != "": raw[(r["glacier_id"], int(r["year"]))] = float(r["annual_balance"])
    for g in G["glaciers"]:
        got = unpack(g["b"]); assert got and len(got) == g["n"]
        for y, v in got.items(): assert raw[(g["id"], y)] == v
        assert sum(1 for (gid, _) in raw if gid == g["id"]) == g["n"]
    peyto = next(g for g in G["glaciers"] if g["name"] == "Peyto")
    assert peyto["b"][0] == 1966 and sum(unpack(peyto["b"]).values()) < -40
