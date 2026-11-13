"""Follow-the-dollar data: carried through from the raw files, each agreement and contract counted once."""
import csv, json
from pathlib import Path
import pytest, yaml

ROOT = Path(__file__).resolve().parent.parent
REG = yaml.safe_load((ROOT / "registry/sources.yaml").read_text())["sources"]
M = ROOT / "web/data/money"
PA = json.loads((M / "public_accounts.json").read_text())
G = json.loads((M / "grants.json").read_text())
C = json.loads((M / "contracts.json").read_text())
tot = lambda agg: sum(t for ys in agg.values() for t, _ in ys.values())
cnt = lambda agg: sum(n for ys in agg.values() for _, n in ys.values())


def test_public_accounts_match_every_raw_cell():
    raw = ROOT / "data/raw/pspc"
    depts = {d["name"]: d for d in PA["depts"]}
    n = 0
    for p in sorted(raw.glob("dmac-meso-*.csv")):
        rows = list(csv.DictReader(p.open(encoding="utf-8-sig")))
        dn = next(k for k in rows[0] if k.startswith("Dept-name") and k.endswith("eng"))
        y = rows[0]["Fscl-yr_Ex-fin"].split("/")[1]
        sums = {}
        for r in rows:
            v = [int(r[f"Std-obj{k}_Art-crnt{k}"] or 0) for k in range(1, 13)]
            sums[r[dn].strip()] = [a + b for a, b in zip(sums.get(r[dn].strip(), [0] * 12), v)]
        for name, v in sums.items():
            assert depts[name]["v"][y] == v, (name, y); n += 1
        assert PA["totals"][y] == [sum(v[k] for v in sums.values()) for k in range(12)]
    assert n > 3000 and PA["years"][0] == 2003 and PA["years"][-1] == 2026


def test_every_grouping_adds_to_the_same_total():
    for d, groups in ((G, ("by_prov", "by_type", "by_dept", "by_kind")), (C, ("by_proc", "by_dept", "by_obj", "by_prov"))):
        totals = {round(tot(d[g])) for g in groups}
        counts = {cnt(d[g]) for g in groups}
        assert max(totals) - min(totals) <= len(d[groups[0]]) * 30, totals   # per-cell rounding only
        assert len(counts) == 1
    assert cnt(G["by_kind"]) == G["agreements"] - sum(G["skipped"].values())
    assert cnt(C["by_proc"]) == C["contracts"] - sum(C["skipped"].values())


@pytest.mark.skipif(not (ROOT / REG["tbs_grants_contributions"]["raw_file"]).exists(), reason="raw grants file not present")
def test_largest_grant_is_its_latest_amendment_counted_once():
    want = {}
    with (ROOT / REG["tbs_grants_contributions"]["raw_file"]).open(encoding="utf-8-sig", errors="replace", newline="") as fh:
        for r in csv.DictReader(fh):
            if r["owner_org"] == "ic" and r["ref_number"].strip() in ("033-2023-2024-Q2-515482", "033-2023-2024-Q1-515483"):
                want.setdefault(r["ref_number"].strip(), []).append((int(r["amendment_number"] or 0), float(r["agreement_value"])))
    big = {g["ref"]: g["v"] for g in G["largest"]}
    for ref, rows in want.items():
        assert big[ref] == round(max(rows)[1])
    assert [g["name"] for g in G["recipients"]].count("NEXTSTAR ENERGY INC.") == 1


def test_batch_reports_are_not_a_province_or_a_recipient_city():
    assert "Batch reports" in G["by_prov"]
    assert not any(c["name"].lower().startswith("batch report") for c in G["cities"])   # (Batchewana First Nation is a real place)
    assert all("|" not in c["name"] and "│" not in c["name"] for c in G["cities"])


def test_contract_reported_twice_is_counted_once():
    sky = [v for v in C["vendors"] if v["name"].startswith("SkyAlyne")]
    assert len(sky) == 1 and sky[0]["n"] == 1 and 11.2e9 < sky[0]["t"] < 11.3e9
