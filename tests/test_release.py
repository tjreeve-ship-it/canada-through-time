"""Release-build corrections: the 2025 election reconciliation and income quality grades."""
import json, hashlib
from pathlib import Path
import yaml
ROOT = Path(__file__).resolve().parents[1]
POL = json.loads((ROOT / "web/data/release/politics.json").read_text())
HOUSE = {"1972": 264, "1974": 264, "1979": 282, "1980": 282, "1984": 282, "1988": 295, "1993": 295, "1997": 301, "2000": 301, "2004": 308, "2006": 308, "2008": 308, "2011": 308, "2015": 338, "2019": 338, "2021": 338, "2025": 343}

def test_every_election_has_a_full_house():
    for e in POL["elections"]:
        assert e["seats_recorded"] == HOUSE[e["date"][:4]], e["date"]

def test_2025_reconciliation_is_documented_and_minimal():
    e = POL["elections"][-1]
    assert e["seats_in_source_file"] == 341 and len(e["reconciled"]["additions"]) == 2
    assert e["seats_by_province"]["BC"] == {"Liberal Party of Canada": 20, "Conservative Party of Canada": 19, "New Democratic Party": 3, "Green Party of Canada": 1}
    assert e["seats_by_province"]["NB"] == {"Liberal Party of Canada": 6, "Conservative Party of Canada": 4}
    assert e["reconciled"]["source_id"] in yaml.safe_load((ROOT / "registry/sources.yaml").read_text())["sources"]

def test_only_2025_differs_from_the_source_file():
    for e in POL["elections"][:-1]:
        assert e["seats_in_source_file"] == e["seats_recorded"] and "reconciled" not in e

def test_raw_election_file_is_untouched():
    reg = yaml.safe_load((ROOT / "registry/sources.yaml").read_text())["sources"]["parlinfo_elected"]
    assert hashlib.sha256((ROOT / reg["raw_file"]).read_bytes()).hexdigest() == reg["sha256"]

def test_income_grades_are_c_or_lower_only():
    g = json.loads((ROOT / "web/data/release/income_grades.json").read_text())["data"]
    assert g == {"NU": {"2020": "C", "2021": "C"}, "NT": {"2021": "C"}}
