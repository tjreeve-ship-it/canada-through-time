"""Housing bundle: processed series reconcile with the published totals and keep gaps as gaps."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
H = ROOT / "web/data/housing"
PROV = ["NL", "PE", "NS", "NB", "QC", "ON", "MB", "SK", "AB", "BC"]


def load(n):
    return json.loads((H / f"{n}.json").read_text())


def test_starts_provinces_sum_to_canada():
    d = load("construction")["data"]
    for y in range(1972, 2026):
        tot = d["CAN"]["starts_total"][str(y)]
        s = sum(d[p]["starts_total"][str(y)] for p in PROV)
        assert abs(s - tot) <= 2, (y, s, tot)   # CMHC rounding


def test_unit_types_sum_to_total():
    d = load("construction")["data"]["CAN"]
    for y in range(1972, 2026):
        parts = d["starts_single"][str(y)] + d["starts_multiples"][str(y)]
        assert abs(parts - d["starts_total"][str(y)]) <= 2, y


def test_completions_end_2022_and_are_not_filled():
    d = load("construction")["data"]["CAN"]
    assert max(map(int, d["completions_total"])) == 2022
    assert max(map(int, d["starts_total"])) == 2025


def test_households_sum_to_canada():
    d = load("households")["data"]
    for y in range(2006, 2026):
        s = sum(d[g][str(y)] for g in PROV + ["YT", "NT", "NU"])
        assert abs(s - d["CAN"][str(y)]) <= 5, y


def test_suppressed_rents_stay_blank():
    for c in load("cities")["cities"]:
        for y in c["rent2br_status"]:
            assert y not in c["rent2br"], (c["name"], y)


def test_cpi_base_2002():
    d = load("cpi")["data"]
    for g in ["CAN", "AB", "ON"]:
        assert abs(d[g]["all"]["2002"] - 100) < 0.05 and abs(d[g]["rent"]["2002"] - 100) < 0.05
