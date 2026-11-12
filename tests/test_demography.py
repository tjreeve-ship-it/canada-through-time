"""Age structure and urban concentration files."""
import json
from pathlib import Path
import yaml
ROOT = Path(__file__).resolve().parents[1]
D = ROOT / "web/data/demography"
AGE = json.loads((D / "age.json").read_text()); METRO = json.loads((D / "metro.json").read_text()); URB = json.loads((D / "urban_census.json").read_text())
POP = json.loads((ROOT / "web/data/population.json").read_text())

def test_files_cite_registered_sources():
    reg = yaml.safe_load((ROOT / "registry/sources.yaml").read_text())["sources"]
    for d in (AGE, METRO, URB): assert d["source"] in reg

def test_age_totals_equal_the_population_table():
    # two different Statistics Canada tables of the same vintage must agree on every July 1 total
    i = {d[:4]: k for k, d in enumerate(POP["dates"]) if d[5:] == "07-01"}
    n = 0
    for g, ys in AGE["data"].items():
        for y, v in ys.items():
            p = POP["series"].get(g, [None] * 999)[i[y]] if y in i else None
            if p is not None: assert v["total"] == p, (g, y); n += 1
    assert n > 700

def test_age_groups_are_parts_of_the_total_and_complete():
    for g, ys in AGE["data"].items():
        for y, v in ys.items():
            assert v["median"] is not None and 0 < v["u15"] < v["total"] and 0 < v["o65"] < v["total"], (g, y)

def test_territories_split_in_1991_with_no_overlap():
    assert max(AGE["data"]["NT+NU"]) == "1990" and min(AGE["data"]["NU"]) == "1991" and min(AGE["data"]["NT"]) == "1991"

def test_metro_provinces_sum_to_canada_every_year():
    for y, c in METRO["data"]["CAN"].items():
        assert sum(v[y]["total"] for g, v in METRO["data"].items() if g != "CAN") == c["total"], y
        assert sum(v[y]["cma"] or 0 for g, v in METRO["data"].items() if g != "CAN") == c["cma"], y

def test_places_without_a_metropolitan_area_have_no_value_not_zero():
    assert METRO["no_cma"] == ["PE", "YT", "NT", "NU"]
    for g in METRO["no_cma"]: assert all(v["cma"] is None for v in METRO["data"][g].values())

def test_metro_series_is_2001_to_2025_and_has_41_areas():
    assert METRO["years"] == [2001, 2025] and len(METRO["cmas"]) == 41

def test_urban_census_series_is_census_years_only_and_ends_2006():
    assert URB["years"] == [1971, 1976, 1981, 1986, 1991, 1996, 2001, 2006]
    for g, ys in URB["data"].items(): assert set(map(int, ys)) <= set(URB["years"]) and all(0 <= v <= 100 for v in ys.values())
