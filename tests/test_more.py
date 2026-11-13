"""Economy, government money, immigration and language files: recomputed against the raw files and cross-checked."""
import csv
import io
import json
import sys
import zipfile
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "pipeline"))
from common import sha256  # noqa: E402

REG = yaml.safe_load((ROOT / "registry/sources.yaml").read_text())["sources"]
MORE = {n: json.loads((ROOT / f"web/data/more/{n}.json").read_text()) for n in ("gdp", "lfs", "govt", "language", "npr", "birthplace")}
PR = json.loads((ROOT / "web/data/explorer/pr_citizenship.json").read_text())
EXPLORER_REG = json.loads((ROOT / "web/data/explorer/registry.json").read_text())


def raw_rows(key):
    p = ROOT / REG[key]["raw_file"]
    t = p.name.split("-")[0]
    yield from csv.DictReader(io.TextIOWrapper(zipfile.ZipFile(p).open(f"{t}.csv"), encoding="utf-8-sig"))


def test_every_file_cites_registered_sources_with_matching_hashes():
    keys = [d["source_id"] for d in MORE.values()] + PR["source_ids"]
    for k in keys:
        assert k in REG and k in EXPLORER_REG, k
        p = ROOT / REG[k]["raw_file"]
        if p.exists():  # the 152 MB census file is not committed; when present it must match
            assert sha256(p) == REG[k]["sha256"], k


def test_federal_balance_by_province_adds_to_canada_every_year():
    F = MORE["govt"]["data"]["federal"]
    for y in map(str, range(MORE["govt"]["years"][0], MORE["govt"]["years"][1] + 1)):
        parts = sum(F[g][y]["bal"] for g in F if g != "CAN" and "bal" in F[g].get(y, {}))
        assert abs(parts - F["CAN"][y]["bal"]) <= 2, (y, parts, F["CAN"][y]["bal"])  # $2M tolerance: published rounding


def test_federal_revenue_minus_spending_is_the_published_balance():
    F = MORE["govt"]["data"]["federal"]
    n = 0
    for g, ys in F.items():
        for y, v in ys.items():
            if {"rev", "exp", "bal"} <= set(v):
                assert abs(v["rev"] - v["exp"] - v["bal"]) <= 2, (g, y, v); n += 1
    assert n > 250


def test_gdp_values_match_raw_table():
    G = MORE["gdp"]["data"]
    n = 0
    for r in raw_rows("statcan_36100222"):
        if r["Estimates"] == "Gross domestic product at market prices" and r["Prices"] == "Current prices" and r["GEO"] == "Alberta" and r["VALUE"]:
            assert G["AB"][r["REF_DATE"]]["cur"] == float(r["VALUE"]); n += 1
    assert n >= 45


def test_unemployment_matches_raw_and_territories_absent():
    U = MORE["lfs"]["data"]
    assert not {"YT", "NT", "NU"} & set(U)
    for r in raw_rows("statcan_14100327"):
        if r["GEO"] == "Ontario" and r["Gender"] == "Total - Gender" and r["Age group"] == "15 years and over" and r["Labour force characteristics"] == "Unemployment rate":
            assert U["ON"][r["REF_DATE"]]["ur"] == float(r["VALUE"])


def test_mother_tongue_parts_add_to_total():
    for g, ys in MORE["language"]["data"].items():
        for y, v in ys.items():
            if {"en", "fr", "other", "total"} <= set(v):
                assert abs(v["en"] + v["fr"] + v["other"] - v["total"]) <= 20, (g, y)  # census random rounding of each published cell


def test_temporary_resident_types_add_to_total():
    for g, ys in MORE["npr"]["data"].items():
        for y, v in ys.items():
            parts = sum(v[k] for k in ("asylum", "work", "study", "work_study", "other"))
            assert abs(parts - v["total"]) <= 5, (g, y, parts, v["total"])


def test_birthplace_continents_add_to_born_outside_canada():
    B = MORE["birthplace"]
    for g, d in B["data"].items():
        s = sum((d.get(k) or {}).get("imm") or 0 for k in B["continents"])
        o = d["Outside Canada"]["imm"]
        assert abs(s - o) <= 50 + 0.002 * o, (g, s, o)  # Statistics Canada random rounding of each cell


def test_ircc_suppressed_values_are_not_zero_and_country_rows_track_totals():
    n_supp = sum(v is None for c in PR["countries"].values() for k, v in c.items() if int(k) >= 2015)
    assert n_supp > 50  # '--' kept as missing
    for y, t in PR["total"].items():
        if int(y) >= 2015:
            s = sum(c.get(y) or 0 for c in PR["countries"].values())
            assert abs(s - t) <= 0.001 * t, (y, s, t)  # IRCC rounding to the nearest 5


def test_ircc_vintage_overlap_is_small_and_partial_year_flagged():
    a, b = PR["overlap_2015_2016"]["facts_2016"], PR["overlap_2015_2016"]["monthly"]
    for y in a:
        assert abs(a[y] - b[y]) / b[y] < 0.001
    assert PR["partial_year"] == max(map(int, PR["total"])) and PR["partial_through"]


def test_ircc_province_totals_add_to_canada():
    P = PR["provinces"]
    for y, t in PR["total"].items():
        if int(y) < 2015:
            continue
        s = sum((v["total"].get(y) or 0) for v in P.values())
        assert abs(s - t) <= 0.001 * t, (y, s, t)
