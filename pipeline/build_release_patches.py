"""Release-build data that corrects findings from docs/DATA_INTEGRITY_AUDIT.md without touching earlier builds' files.
  web/data/release/politics.json       election seats with the documented 2025 reconciliation applied (C1)
  web/data/release/income_grades.json  Statistics Canada quality grades C–E for the income series shown (C4)
"""
import json, zipfile, csv, io, xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "web/data/release"
AB = {"Canada": "CAN", "Newfoundland and Labrador": "NL", "Prince Edward Island": "PE", "Nova Scotia": "NS", "New Brunswick": "NB", "Quebec": "QC", "Ontario": "ON", "Manitoba": "MB",
      "Saskatchewan": "SK", "Alberta": "AB", "British Columbia": "BC", "Yukon": "YT", "Northwest Territories": "NT", "Nunavut": "NU"}

def politics():
    base = json.loads((ROOT / "web/data/explorer/politics.json").read_text())        # ministries and structure
    root = ET.parse(ROOT / "data/raw/parlinfo/elected_candidates.xml").getroot()
    seats = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
    for c in root.findall("ElectionCandidateForWeb"):
        d = c.findtext("ElectionDate")[:10]
        if c.findtext("IsGeneral") == "true" and d >= "1972": seats[d][AB[c.findtext("ProvinceEn")]][c.findtext("PartyNameEn")] += 1
    rec = json.loads((ROOT / "registry/reconciliations/parlinfo_2025_missing_members.json").read_text())
    in_file = {d: sum(n for p in v.values() for n in p.values()) for d, v in seats.items()}
    for a in rec["additions"]: seats[rec["election_date"]][a["province"]][a["party"]] += 1
    elections = []
    for d in sorted(seats):
        prov = {p: dict(sorted(v.items(), key=lambda kv: (-kv[1], kv[0]))) for p, v in seats[d].items()}
        total = defaultdict(int)
        for v in prov.values():
            for party, n in v.items(): total[party] += n
        e = {"date": d, "seats_by_province": prov, "seats_total": dict(sorted(total.items(), key=lambda kv: (-kv[1], kv[0]))), "seats_recorded": sum(total.values()), "seats_in_source_file": in_file[d]}
        if d == rec["election_date"]: e["reconciled"] = {"source_id": rec["source_id"], "additions": rec["additions"], "note": rec["resolution"]}
        elections.append(e)
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "politics.json").write_text(json.dumps({"sources": base["sources"] + [rec["source_id"]], "ministries": base["ministries"], "elections": elections}, separators=(",", ":")))
    e = elections[-1]; print("2025:", e["seats_recorded"], "seats;", e["seats_by_province"]["BC"], e["seats_by_province"]["NB"], list(e["seats_total"].items())[:2])

def income_grades():
    z = zipfile.ZipFile(ROOT / "data/raw/statcan/11100190-eng.zip"); name = [n for n in z.namelist() if "MetaData" not in n][0]
    g = defaultdict(dict)
    for r in csv.DictReader(io.TextIOWrapper(z.open(name), encoding="utf-8-sig")):
        if (r["GEO"] in AB and r["Income concept"] == "Median after-tax income" and r["Economic family type"] == "Economic families and persons not in an economic family"
                and r["UOM"] == "2024 constant dollars" and r["STATUS"] in ("C", "D", "E") and r["VALUE"]):
            g[AB[r["GEO"]]][r["REF_DATE"]] = r["STATUS"]
    (OUT / "income_grades.json").write_text(json.dumps({"source": "statcan_11100190", "meaning": "Statistics Canada data-quality indicator based on the coefficient of variation: A excellent, B very good, C good, D acceptable, E use with caution. Only C–E are listed.", "data": g}, indent=1))
    print("grades:", dict(g))

if __name__ == "__main__":
    politics(); income_grades()
