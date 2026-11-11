"""Validation of the population pipeline output against its own source."""
import csv
import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
from common import load_registry, sha256  # noqa: E402

PROV = ["NL", "PE", "NS", "NB", "QC", "ON", "MB", "SK", "AB", "BC", "YT"]


def load():
    rows = list(csv.DictReader((ROOT / "data/processed/population_quarterly.csv").open()))
    by = defaultdict(dict)
    for r in rows:
        by[r["ref_date"]][r["geo_abbr"]] = int(r["value"])
    return by


def test_raw_files_match_registry():
    reg = load_registry()["sources"]["statcan_17100009"]
    assert sha256(ROOT / reg["raw_file"]) == reg["sha256"]


def test_series_starts_on_consistent_methodology():
    by = load()
    assert min(by) == "1971-07-01"


def test_quarters_are_contiguous():
    dates = sorted(load())
    for a, b in zip(dates, dates[1:]):
        ya, ma = int(a[:4]), int(a[5:7])
        yb, mb = int(b[:4]), int(b[5:7])
        assert (yb * 12 + mb) - (ya * 12 + ma) == 3, (a, b)


def test_provinces_and_territories_sum_to_canada():
    for d, v in load().items():
        terr = v["NT"] + v["NU"] if "NT" in v else v["NT+NU"]
        assert sum(v[k] for k in PROV) + terr == v["CAN"], d


def test_ntnu_split_is_consistent_where_both_exist():
    for d, v in load().items():
        if "NT" in v and "NT+NU" in v:
            assert v["NT"] + v["NU"] == v["NT+NU"], d
        if d < "1991-07-01":
            assert "NT" not in v and "NU" not in v, d


def test_known_values_spot_check():
    # Values read directly from the published table (17-10-0009-01).
    v = load()
    assert v["1971-07-01"]["CAN"] == 21962032
    assert v["1991-07-01"]["NU"] == 22154
    assert v["2026-07-01"]["CAN"] == 41798407


def test_web_json_matches_processed_csv():
    web = json.loads((ROOT / "web/data/population.json").read_text())
    by = load()
    for i, d in enumerate(web["dates"]):
        assert web["series"]["CAN"][i] == by[d]["CAN"]
