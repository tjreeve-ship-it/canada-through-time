"""Neighbourhood data (2021 Census tract profile): checked against the raw Statistics Canada file and for internal consistency."""
import csv, io, json, zipfile
from pathlib import Path
import pytest

ROOT = Path(__file__).resolve().parent.parent
P = json.loads((ROOT / "web/data/cities/ct_profile.json").read_text())
X = {f: i for i, f in enumerate(P["fields"])}
RAW = ROOT / "data/raw/census2021/98-401-X2021007_eng_CSV.zip"
CITIES = {g: a for g, a in P["areas"].items() if a["level"] != "Census tract"}
TRACTS = {g: a for g, a in P["areas"].items() if a["level"] == "Census tract"}
for a in P["areas"].values():   # expand the compact place-of-birth lists
    a["pob"] = {k: v for k, v in zip(P["pob_ids"], a["pob"] or []) if v is not None}


def test_fifty_cities_and_every_tract_has_a_city_and_a_shape():
    assert len(CITIES) == 50 and len(TRACTS) == 6247
    assert all(a["cma"] in CITIES for a in TRACTS.values())
    shapes = json.loads((ROOT / "web/data/cities/ct_shapes.geojson").read_text())["features"]
    ids = {f["properties"]["DGUID"] for f in shapes}
    assert ids == set(TRACTS)


def test_tract_populations_sum_to_city_totals():
    tot = {}
    for a in TRACTS.values(): tot[a["cma"]] = tot.get(a["cma"], 0) + (a["v"][X["pop"]] or 0)
    for g, a in CITIES.items(): assert tot[g] == a["v"][X["pop"]], a["name"]


def test_rates_are_percentages_and_missing_is_none_not_zero():
    for k in ("rent", "own", "imm", "vm", "lim", "degree", "ur", "shelter30", "imm_new", "npr", "en", "fr", "nonoff", "indig"):
        vals = [a["v"][X[k]] for a in P["areas"].values()]
        assert all(v is None or 0 <= v <= 100 for v in vals), k
    # some tracts are suppressed (e.g. reserves, low response): those stay None
    assert sum(a["v"][X["hhinc"]] is None for a in TRACTS.values()) > 50


def test_places_of_birth_never_exceed_immigrants():
    conts = [k for k, n in P["pob_names"].items() if n in ("Americas", "Europe", "Africa", "Asia", "Oceania and other places of birth")]
    for a in P["areas"].values():
        imm = a["v"][X["imm_n"]]
        # tiny tracts can publish 0 for every place of birth after random rounding (e.g. 8350104.56: 40 immigrants, all cells 0)
        if imm is None or imm < 500 or not all(k in a["pob"] for k in conts): continue   # place of birth suppressed for the area
        s = sum(a["pob"].get(k, 0) for k in conts)
        assert abs(s - imm) <= max(40, 0.03 * imm), (a["name"], s, imm)   # each cell is randomly rounded


def test_cma_index_matches_profile():
    idx = json.loads((ROOT / "web/data/cities/cma_index.json").read_text())["cities"]
    assert {g[-3:]: a["name"] for g, a in CITIES.items()} == {k: v[0] for k, v in idx.items()}


@pytest.mark.skipif(not RAW.exists(), reason="raw census file not present")
def test_first_city_matches_raw_file_cell_by_cell():
    first = next(iter(P["areas"]))
    want = {}
    with zipfile.ZipFile(RAW).open("98-401-X2021007_English_CSV_data.csv") as fh:
        r = csv.reader(io.TextIOWrapper(fh, encoding="latin-1")); h = next(r)
        I = {k: h.index(k) for k in ("DGUID", "CHARACTERISTIC_ID", "C1_COUNT_TOTAL", "C10_RATE_TOTAL")}
        for row in r:
            if row[I["DGUID"]] != first: break
            want[int(row[I["CHARACTERISTIC_ID"]])] = (row[I["C1_COUNT_TOTAL"]], row[I["C10_RATE_TOTAL"]])
    a = P["areas"][first]
    assert a["v"][X["pop"]] == float(want[1][0])
    assert a["v"][X["hhinc"]] == float(want[243][0])
    assert a["v"][X["rent"]] == float(want[1416][1])
    assert a["v"][X["vm_sa"]] == float(want[1685][1])
    assert a["v"][X["ph"]] == float(want[1527][0])
    assert a["pob"]["1599"] == int(want[1599][0])
