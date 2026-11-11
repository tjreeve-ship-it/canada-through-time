"""Story text must be supported by the data and must not imply causation without evidence."""
import csv
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STORIES = sorted((ROOT / "web/stories").glob("*.json"))
CAUSAL = re.compile(r"\b(caus(e|ed|es|ing)|led to|lead to|drove|driven by|because of|thanks to|due to|result(ed)? in|blame[sd]?)\b", re.I)
PROVINCES = ["NL", "PE", "NS", "NB", "QC", "ON", "MB", "SK", "AB", "BC"]


def texts(story):
    v2 = story.get("v2", {})
    yield "title", story.get("title", "")
    yield "subtitle", story.get("subtitle", "")
    yield "v2.headline", v2.get("headline", "")
    for a in story.get("annotations", []):
        if a.get("kind") != "evidence_of_effect":  # the only tag allowed causal wording, and it must cite a source
            yield f"annotation {a['date']}", a.get("text", "") + " " + a.get("short", "")


def test_no_causal_language_without_evidence_tag():
    for p in STORIES:
        story = json.loads(p.read_text())
        for where, t in texts(story):
            assert not CAUSAL.search(t), f"{p.name} {where}: causal wording needs an 'evidence_of_effect' annotation with a source: {t!r}"
        for a in story.get("annotations", []):
            if a.get("kind") == "evidence_of_effect":
                assert a.get("source_url"), f"{p.name}: evidence_of_effect annotation without source_url"


def test_population_headline_claims_hold():
    story = json.loads((ROOT / "web/stories/population-provinces-1971-2026.json").read_text())
    by = defaultdict(dict)
    for r in csv.DictReader((ROOT / "data/processed/population_quarterly.csv").open()):
        by[r["ref_date"]][r["geo_abbr"]] = int(r["value"])
    s, e = by[story["start"]], by[story["end"]]
    growth = {k: e[k] / s[k] - 1 for k in PROVINCES}
    top2 = sorted(growth, key=growth.get, reverse=True)[:2]
    head = story["v2"]["headline"]
    # "Canada nearly doubled": +80% to +100%
    assert "nearly doubled" in head and 0.80 <= e["CAN"] / s["CAN"] - 1 < 1.0
    # "Alberta and B.C. led the provinces": the two fastest-growing provinces (territories excluded on purpose)
    assert "Alberta and B.C. led the provinces" in head and set(top2) == {"AB", "BC"}
