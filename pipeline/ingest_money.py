"""Follow the dollar: federal spending (Public Accounts), grants and contributions, and contracts.

1. Public Accounts, ministerial expenditures by standard object (PSPC), fiscal 2002-03 to 2025-26, thousands of dollars,
   one row per ministry/agency. Kept as published.
2. Proactive disclosure of grants and contributions. One row per agreement or amendment. An agreement is identified by
   (owner_org, ref_number); its value is the agreement_value of its highest amendment_number (the schema says the field is
   the total agreement value, not the change). Its year is the fiscal year of the original agreement's start date.
3. Proactive publication of contracts. One row per contract or amendment. A contract is identified by (owner_org,
   procurement_id) when the id contains a digit, otherwise by (owner_org, reference_number). Its value is the contract_value
   of its latest record (contract_value is cumulative). Its year is the fiscal year of its earliest contract date.

Fiscal years are named by the year they end (2024-25 -> 2025). Agreement and contract values are commitments (totals over
the life of the agreement), not money spent in that year. Nothing is estimated; records with no usable value or date are
counted and left out, and the counts are written to the output.

Output: web/data/money/{public_accounts,grants,contracts}.json
"""
import csv
import hashlib
import json
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ROOT, load_registry, verify_raw  # noqa: E402

OUT = ROOT / "web/data/money"
OBJECTS = ["Personnel", "Transportation and communications", "Information", "Professional and special services", "Rentals",
           "Repair and maintenance", "Utilities, materials and supplies", "Acquisition of land, buildings and works",
           "Acquisition of machinery and equipment", "Transfer payments", "Public debt charges", "Other subsidies and payments"]
PROV = {"NL", "PE", "NS", "NB", "QC", "ON", "MB", "SK", "AB", "BC", "YT", "NT", "NU"}
# first letter of a Canadian postal code -> province or territory (Canada Post forward sortation areas; X is shared by NT and NU)
POSTAL = {"A": "NL", "B": "NS", "C": "PE", "E": "NB", "G": "QC", "H": "QC", "J": "QC", "K": "ON", "L": "ON", "M": "ON", "N": "ON", "P": "ON",
          "R": "MB", "S": "SK", "T": "AB", "V": "BC", "X": "NT+NU", "Y": "YT"}
csv.field_size_limit(1 << 26)


def fy(date):
    """'2024-05-28' -> 2025 (fiscal year April-March, named by the year it ends). None if unusable."""
    m = re.match(r"(\d{4})-(\d{2})-\d{2}", date or "")
    if not m:
        return None
    y, mo = int(m.group(1)), int(m.group(2))
    f = y + 1 if mo >= 4 else y
    return f if 2000 <= f <= 2027 else None


def num(s):
    try:
        v = float(s)
    except (TypeError, ValueError):
        return None
    return v if v == v else None


en = lambda s: re.split(r"[|│]", s or "")[0].strip()   # bilingual "English | French" -> English
key = lambda s: re.sub(r"[^A-Z0-9]+", " ", unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().upper()).strip()   # Québec = Quebec


def public_accounts(reg):
    r = reg["pspc_public_accounts_meso"]
    man = verify_raw(r["raw_file"], r["sha256"])
    files = {}
    for line in man.read_text().splitlines():
        h, name = line.split()
        p = man.parent / name
        assert hashlib.sha256(p.read_bytes()).hexdigest() == h, name
        if name.endswith(".csv"):
            files[name] = p
    years, depts = [], {}
    for name, p in sorted(files.items()):
        rows = list(csv.DictReader(p.open(encoding="utf-8-sig")))
        dn = next(k for k in rows[0] if k.startswith("Dept-name") and k.endswith("eng"))
        pn = next(k for k in rows[0] if k.startswith("Min-portfolio") and k.endswith("eng"))
        fys = {row["Fscl-yr_Ex-fin"] for row in rows}
        assert len(fys) == 1, name
        y = int(fys.pop().split("/")[1])
        years.append(y)
        for row in rows:
            assert row["Amt-units_Mnt-unite"] == "x1000", name
            v = [int(row[f"Std-obj{k}_Art-crnt{k}"] or 0) for k in range(1, 13)]
            d = depts.setdefault(row[dn].strip(), {"portfolio": {}, "v": {}})
            d["portfolio"][y] = row[pn].strip()
            if y in d["v"]:   # a ministry listed twice in one year (two portfolios): keep both rows' amounts
                d["v"][y] = [a + b for a, b in zip(d["v"][y], v)]
            else:
                d["v"][y] = v
    years.sort()
    assert years == list(range(years[0], years[-1] + 1)), years
    out = dict(source_id="pspc_public_accounts_meso", units="thousands of dollars", years=years, objects=OBJECTS,
               notes=["Gross expenditures of each ministry and agency by standard object, as published in the Public Accounts of Canada (Volume II basis). Fiscal years end March 31 and are named by the year they end.",
                      "Ministries are listed under the name used in each year's file; departments that were renamed or reorganized appear under each name."],
               depts=[dict(name=n, portfolio=d["portfolio"][max(d["portfolio"])], v={str(y): d["v"][y] for y in sorted(d["v"])}) for n, d in sorted(depts.items())])
    out["totals"] = {str(y): [sum(d["v"].get(y, [0] * 12)[k] for d in depts.values()) for k in range(12)] for y in years}
    dump("public_accounts.json", out)


BATCH = re.compile(r"\s*batch report", re.I)
GKEEP = ("agreement_value", "owner_org_title", "recipient_province", "recipient_country", "recipient_type", "agreement_type", "recipient_legal_name",
         "recipient_operating_name", "recipient_city", "prog_name_en", "agreement_title_en")


def grants(reg):
    r = reg["tbs_grants_contributions"]
    p = verify_raw(r["raw_file"], r["sha256"])
    agr = {}
    skipped = defaultdict(int)
    with p.open(encoding="utf-8-sig", errors="replace", newline="") as fh:
        for row in csv.DictReader(fh):
            k = (row["owner_org"], row["ref_number"].strip())
            try:
                am = int(float(row["amendment_number"] or 0))
            except ValueError:
                am = 0
            a = agr.get(k)
            if a is None:
                a = agr[k] = dict(am=-1, start=None, row=None)
            if am == 0 or a["start"] is None:
                a["start"] = row["agreement_start_date"] if am == 0 else (a["start"] or row["agreement_start_date"])
            if am >= a["am"]:   # keep only the fields used below (the full rows do not fit in memory)
                a["am"], a["row"] = am, {f: row[f] for f in GKEEP}
    by_prov, by_type, by_dept, by_kind = (defaultdict(lambda: defaultdict(lambda: [0.0, 0])) for _ in range(4))
    rec, city, prog, big = defaultdict(lambda: dict(t=0.0, n=0, by={}, names=defaultdict(int), prov=defaultdict(int), city=defaultdict(int), type=defaultdict(int), dept=defaultdict(float))), \
        defaultdict(lambda: dict(t=0.0, n=0, by={})), defaultdict(lambda: dict(t=0.0, n=0, dept=defaultdict(float))), []
    for (org, ref), a in agr.items():
        row = a["row"]; v = num(row["agreement_value"]); y = fy(a["start"])
        if v is None: skipped["no value"] += 1; continue
        if y is None: skipped["no usable start date"] += 1; continue
        dept = en(row["owner_org_title"]); pv = row["recipient_province"].strip().upper()
        pk = pv if pv in PROV and row["recipient_country"].strip().upper() in ("CA", "") else ("Outside Canada" if row["recipient_country"].strip().upper() not in ("CA", "") else "Not stated")
        batch = bool(BATCH.match(row["recipient_legal_name"]))   # many small payments reported as one line: not a recipient or a place
        if batch: pk = "Batch reports"
        for agg, kk in ((by_prov, pk), (by_type, row["recipient_type"].strip() or "?"), (by_dept, dept), (by_kind, row["agreement_type"].strip() or "?")):
            agg[kk][y][0] += v; agg[kk][y][1] += 1
        nm = en(row["recipient_legal_name"]) or en(row["recipient_operating_name"]) or "(name not disclosed)"
        if batch:
            nm = "Batch reports (many recipients)"
        rk = key(nm)
        R = rec[rk]; R["t"] += v; R["n"] += 1; R["by"][y] = R["by"].get(y, 0) + v; R["names"][nm] += 1; R["prov"][pk] += 1; R["city"][en(row["recipient_city"]).title()] += 1
        R["type"][row["recipient_type"].strip()] += 1; R["dept"][dept] += v
        cn = en(row["recipient_city"])
        if pk in PROV and cn:
            C = city[(pk, key(cn))]; C["t"] += v; C["n"] += 1; C["by"][y] = C["by"].get(y, 0) + v; C.setdefault("name", defaultdict(int))[cn.title()] += 1
        pg = row["prog_name_en"].strip() or "(program not stated)"
        P = prog[pg]; P["t"] += v; P["n"] += 1; P["dept"][dept] += v
        if v >= 5e7: big.append((v, y, nm, dept, pk, row["agreement_title_en"].strip()[:140], pg[:120], row["agreement_type"].strip(), org, ref))
    top = lambda d: max(d, key=d.get) if d else ""
    rows = lambda agg: {k: {str(y): [round(t), n] for y, (t, n) in sorted(ys.items())} for k, ys in agg.items()}
    recips = sorted(rec.values(), key=lambda R: -R["t"])[:400]
    cities = sorted(city.items(), key=lambda kv: -kv[1]["t"])[:600]
    progs = sorted(prog.items(), key=lambda kv: -kv[1]["t"])[:300]
    big.sort(key=lambda b: -b[0])
    out = dict(source_id="tbs_grants_contributions", units="dollars",
               agreements=len(agr), skipped=dict(skipped),
               notes=["Each agreement counted once, at the value of its latest amendment, in the fiscal year its original agreement started.",
                      "Agreement value is the total committed over the life of the agreement (often several years), not money paid in that year.",
                      "Some departments report many small payments as one 'batch report' line; those are kept as their own group, not as a recipient or a province.",
                      "Disclosure covers agreements over $25,000. Departments' reporting expanded over time (much more detail from 2018), so early years are not complete."],
               recipient_types={"A": "Indigenous recipients", "F": "For-profit organizations", "G": "Government", "I": "International (non-government)", "N": "Not-for-profit organizations and charities", "O": "Other", "P": "Individuals and sole proprietorships", "S": "Academia", "?": "Not stated"},
               agreement_types={"C": "Contribution", "G": "Grant", "O": "Other transfer payment", "?": "Not stated"},
               by_prov=rows(by_prov), by_type=rows(by_type), by_dept=rows(by_dept), by_kind=rows(by_kind),
               recipients=[dict(name=top(R["names"]), prov=top(R["prov"]), city=top(R["city"]), type=top(R["type"]), dept=top(R["dept"]), t=round(R["t"]), n=R["n"], by={str(y): round(v) for y, v in sorted(R["by"].items())}) for R in recips],
               cities=[dict(prov=k[0], name=top(C["name"]), t=round(C["t"]), n=C["n"], by={str(y): round(v) for y, v in sorted(C["by"].items())}) for k, C in cities],
               programs=[dict(name=k, dept=top(P["dept"]), t=round(P["t"]), n=P["n"]) for k, P in progs],
               largest=[dict(v=round(b[0]), fy=b[1], name=b[2], dept=b[3], prov=b[4], title=b[5], prog=b[6], kind=b[7], org=b[8], ref=b[9]) for b in big[:150]])
    dump("grants.json", out)


def contracts(reg):
    r = reg["tbs_contracts"]
    p = verify_raw(r["raw_file"], r["sha256"])
    con = {}
    skipped = defaultdict(int)
    with p.open(encoding="utf-8-sig", errors="replace", newline="") as fh:
        for row in csv.DictReader(fh):
            pid = row["procurement_id"].strip()
            k = (row["owner_org"], "P:" + pid) if re.search(r"\d", pid) and pid.upper() != "NULL" else (row["owner_org"], "R:" + row["reference_number"].strip())
            c = con.get(k)
            order = (row["contract_date"] or "", row["reporting_period"] or "")
            if c is None:
                con[k] = dict(first=row["contract_date"] or "9999", last=order, row=row)
            else:
                if row["contract_date"] and row["contract_date"] < c["first"]: c["first"] = row["contract_date"]
                if order >= c["last"]: c["last"], c["row"] = order, row
    by_dept, by_proc, by_obj, by_prov = (defaultdict(lambda: defaultdict(lambda: [0.0, 0])) for _ in range(4))
    ven = defaultdict(lambda: dict(t=0.0, n=0, by={}, names=defaultdict(int), dept=defaultdict(float), prov=defaultdict(int), tn=0.0))
    objn, big = defaultdict(lambda: defaultdict(int)), []
    for (org, _), c in con.items():
        row = c["row"]; v = num(row["contract_value"])
        if v is None:
            o, a = num(row["original_value"]), num(row["amendment_value"]); v = (o or 0) + (a or 0) if o is not None else None
        y = fy(c["first"])
        if v is None: skipped["no value"] += 1; continue
        if y is None: skipped["no usable contract date"] += 1; continue
        dept = en(row["owner_org_title"]); sp = row["solicitation_procedure"].strip() or "?"
        oc = row["economic_object_code"].strip().zfill(4) if row["economic_object_code"].strip() else "?"
        objn[oc][row["description_en"].strip()] += 1
        pc = (row["vendor_postal_code"].strip().upper()[:1]); pv = POSTAL.get(pc, "Outside Canada" if row["country_of_vendor"].strip().upper() not in ("", "CA") else "Not stated")
        for agg, kk in ((by_dept, dept), (by_proc, sp), (by_obj, oc), (by_prov, pv)):
            agg[kk][y][0] += v; agg[kk][y][1] += 1
        nm = row["vendor_name"].strip() or "(vendor not disclosed)"
        V = ven[key(nm) or nm]; V["t"] += v; V["n"] += 1; V["by"][y] = V["by"].get(y, 0) + v; V["names"][nm] += 1; V["dept"][dept] += v; V["prov"][pv] += 1
        if sp == "TN": V["tn"] += v
        if v >= 5e7: big.append((v, y, nm, dept, row["description_en"].strip()[:120], sp, org, row["reference_number"]))
    top = lambda d: max(d, key=d.get) if d else ""
    rows = lambda agg: {k: {str(y): [round(t), n] for y, (t, n) in sorted(ys.items())} for k, ys in agg.items()}
    vendors = sorted(ven.values(), key=lambda V: -V["t"])[:400]
    big.sort(key=lambda b: -b[0])
    out = dict(source_id="tbs_contracts", units="dollars", contracts=len(con), skipped=dict(skipped),
               notes=["Each contract counted once, at the total value of its latest record (contract values include amendments and taxes), in the fiscal year it was first awarded.",
                      "Contract value is the total committed over the life of the contract, not money paid in that year. Disclosure covers contracts over $10,000.",
                      "A contract that a department reported under more than one identifier can appear more than once; amounts are shown as disclosed.",
                      "Vendor province comes from the first letter of the vendor's postal code where one was disclosed."],
               procedures={"TC": "Competitive (traditional)", "OB": "Competitive (open bidding)", "ST": "Competitive (selective tendering)", "AC": "Advance Contract Award Notice", "TN": "Non-competitive", "?": "Not stated"},
               objects={k: top(v) for k, v in objn.items()},
               by_dept=rows(by_dept), by_proc=rows(by_proc), by_obj=rows(by_obj), by_prov=rows(by_prov),
               vendors=[dict(name=top(V["names"]), dept=top(V["dept"]), prov=top(V["prov"]), t=round(V["t"]), n=V["n"], tn=round(V["tn"]), by={str(y): round(v) for y, v in sorted(V["by"].items())}) for V in vendors],
               largest=[dict(v=round(b[0]), fy=b[1], name=b[2], dept=b[3], what=b[4], proc=b[5], org=b[6], ref=b[7]) for b in big[:150]])
    dump("contracts.json", out)


def dump(name, obj):
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / name).write_text(json.dumps(obj, separators=(",", ":"), ensure_ascii=False))
    print(f"web/data/money/{name}", round((OUT / name).stat().st_size / 1e6, 2), "MB")


if __name__ == "__main__":
    reg = load_registry()["sources"]
    which = sys.argv[1:] or ["pa", "grants", "contracts"]
    if "pa" in which: public_accounts(reg)
    if "contracts" in which: contracts(reg)
    if "grants" in which: grants(reg)
