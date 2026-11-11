"""The claims checker must pass the real ledger and fail clearly on each kind of corruption."""
import copy
import sys
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
import check_ledger as CK  # noqa: E402
import ledger as LG  # noqa: E402

STORY = ROOT / "stories/population-provinces-1971-2026"
BASE = LG.load(STORY)


def run_mutant(tmp_path, mutate):
    L = copy.deepcopy(BASE)
    L["story"]["id"] = "test-mutant"  # keeps the real exports out of the run
    mutate(L)
    (tmp_path / "ledger.yaml").write_text(yaml.safe_dump(L, allow_unicode=True, sort_keys=False))
    return CK.run(tmp_path)


def claim(L, cid):
    return next(c for c in L["claims"] if c["id"] == cid)


def val(L, cid, vid):
    return next(v for v in claim(L, cid)["values"] if v["id"] == vid)


def test_real_ledger_passes(tmp_path):
    R = run_mutant(tmp_path, lambda L: None)
    assert R.fail == [], R.fail
    assert any("Nunavut" in x or "nunavut" in x for x in R.review), "external claim must be flagged for human review"


@pytest.mark.parametrize("name,mutate,expect", [
    ("value", lambda L: val(L, "canada_growth", "end").__setitem__("expected", 41798408), "VALUE MISMATCH"),
    ("display", lambda L: val(L, "canada_growth", "pct").__setitem__("display", "+91%"), "DISPLAY MISMATCH"),
    ("date", lambda L: val(L, "canada_growth", "end")["compute"].__setitem__("date", "2027-07-01"), "cannot compute"),
    ("date range", lambda L: claim(L, "yukon_growth")["period"].__setitem__("end", "2025-07-01"), "DATE"),
    ("formula", lambda L: val(L, "yukon_growth", "pct")["compute"].__setitem__("from", "1981-07-01"), "FORMULA"),
    ("geography", lambda L: val(L, "atlantic_share", "start")["compute"].__setitem__("geos", ["NL", "PE", "NS", "QC"]), "GEOGRAPHY"),
    ("rank", lambda L: val(L, "fastest_provinces", "first").__setitem__("expected", "BC"), "VALUE MISMATCH"),
    ("source field", lambda L: L["external_sources"]["external_nunavut_act"].pop("licence"), "missing licence"),
    ("unknown source", lambda L: claim(L, "yukon_growth")["sources"].append("nope"), "not declared"),
    ("method", lambda L: claim(L, "yukon_growth").pop("method"), "missing fields"),
    ("preliminary", lambda L: claim(L, "yukon_growth").__setitem__("caveats", []), "PRELIMINARY"),
    ("stray number", lambda L: claim(L, "yukon_growth")["wording"].__setitem__("package", "Yukon grew +170%."), "not among"),
    ("causal", lambda L: claim(L, "fastest_provinces")["wording"].__setitem__("package", "Oil jobs drove Alberta's growth (+206%)."), "CAUSAL"),
    ("headline", lambda L: L["story"].__setitem__("headline", "Canada nearly doubled because of immigration."), "CAUSAL"),
    ("level", lambda L: claim(L, "yukon_growth").__setitem__("level", "proof"), "unknown evidence level"),
])
def test_mutations_fail(tmp_path, name, mutate, expect):
    R = run_mutant(tmp_path, mutate)
    assert any(expect in f for f in R.fail), f"{name}: expected a failure containing {expect!r}, got {R.fail}"


def test_non_observation_goes_to_human_review(tmp_path):
    R = run_mutant(tmp_path, lambda L: claim(L, "west_share").__setitem__("level", "association"))
    assert any("west_share" in x and "association" in x for x in R.review)


def test_outputs_reject_unledgered_numbers_and_missing_caveats():
    L = LG.load(STORY)
    allowed = LG.allowed_numbers(L)
    R = CK.Report()
    CK.check_text_output("post", "x_post", "Canada grew 93% since 1971.", L, R, allowed)
    assert any("not in the ledger" in f for f in R.fail)
    assert any("CAVEAT 'preliminary'" in f for f in R.fail)
    R = CK.Report()
    CK.check_text_output("post", "x_post", LG.x_post(L), L, R, allowed)
    assert R.fail == [], R.fail


def test_x_post_fits():
    assert CK.x_length(LG.x_post(LG.load(STORY))) <= 280
