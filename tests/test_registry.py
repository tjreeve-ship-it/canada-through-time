"""Every raw file matches its registry fingerprint, and every data file names a registered source."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
from common import load_registry, sha256  # noqa: E402

REG = load_registry()["sources"]


def test_raw_fingerprints():
    for sid, s in REG.items():
        if s.get("raw_file") and s.get("sha256"):
            assert sha256(ROOT / s["raw_file"]) == s["sha256"], sid


def test_required_fields():
    for sid, s in REG.items():
        for f in ("title", "publisher", "landing_url", "retrieved", "licence"):
            assert s.get(f), f"{sid} missing {f}"


def test_housing_files_cite_registered_sources():
    for p in (ROOT / "web/data/housing").glob("*.json"):
        if p.name == "registry.json":
            continue
        d = json.loads(p.read_text())
        for sid in [d["source"]] if "source" in d else d.get("sources", []):
            assert sid in REG, f"{p.name}: {sid}"


def test_explorer_registry_matches_yaml():
    exp = json.loads((ROOT / "web/data/explorer/registry.json").read_text())
    assert set(exp) == set(REG)
    for sid in REG:
        assert exp[sid].get("sha256") == REG[sid].get("sha256"), sid


def test_core_need_census_years_only():
    d = json.loads((ROOT / "web/data/housing/core_need.json").read_text())["data"]
    assert all(set(v) <= {"2016", "2021"} for v in d.values())
