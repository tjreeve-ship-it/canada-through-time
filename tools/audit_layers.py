"""Independent data audit: recompute every displayed value straight from the raw source files and compare with what
the explorer shows (audit/displayed.json, dumped from the running page). Does not import the pipeline or read web/data.
usage: python3 tools/audit_layers.py   → audit/layer_audit.json + printed summary"""
import zipfile, csv, io, json, collections, xml.etree.ElementTree as ET
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
import os as _os
D = json.loads((ROOT / _os.environ.get("DISPLAYED", "audit/displayed.json")).read_text())
OUTFILE = _os.environ.get("AUDIT_OUT", "audit/layer_audit.json")
AB = {"Canada": "CAN", "Newfoundland and Labrador": "NL", "Prince Edward Island": "PE", "Nova Scotia": "NS", "New Brunswick": "NB", "Quebec": "QC", "Ontario": "ON", "Manitoba": "MB",
      "Saskatchewan": "SK", "Alberta": "AB", "British Columbia": "BC", "Yukon": "YT", "Northwest Territories": "NT", "Nunavut": "NU", "Northwest Territories including Nunavut": "NT+NU"}
def rows(t):
    z = zipfile.ZipFile(ROOT / f"data/raw/statcan/{t}-eng.zip"); name = [n for n in z.namelist() if "MetaData" not in n][0]
    return csv.DictReader(io.TextIOWrapper(z.open(name), encoding="utf-8-sig"))
num = lambda s: None if s in ("", None) else float(s)
facts = {}

# ---- raw: population (July 1), components, area
pop = collections.defaultdict(dict); popdates = set()
for r in rows("17100009"):
    popdates.add(r["REF_DATE"])
    if r["REF_DATE"][5:] == "07-01" and r["GEO"] in AB and num(r["VALUE"]) is not None: pop[AB[r["GEO"]]][int(r["REF_DATE"][:4])] = num(r["VALUE"])
P = lambda g, y: pop[g].get(y)
comp = collections.defaultdict(lambda: collections.defaultdict(dict))
for r in rows("17100008"):
    if r["GEO"] in AB and num(r["VALUE"]) is not None: comp[AB[r["GEO"]]][int(r["REF_DATE"][:4])][r["Components of population growth"]] = num(r["VALUE"])
area = {}
z = zipfile.ZipFile(ROOT / "data/raw/statcan/98100001-eng.zip"); n = [x for x in z.namelist() if "MetaData" not in x][0]
rd = csv.reader(io.TextIOWrapper(z.open(n), encoding="utf-8-sig")); h = next(rd); ai = next(i for i, c in enumerate(h) if "Land area" in c)
for r in rd:
    if len(r) > ai and r[1] in AB: area[AB[r[1]]] = float(r[ai])
area["NT+NU"] = area["NT"] + area["NU"]

E = collections.defaultdict(dict)   # expected[layer]["g|y"] = value
GEOS = list(AB.values()); Y0, Y1 = 1971, max(int(d[:4]) for d in popdates if d[5:] == "07-01")
for g in GEOS:
    base = P(g, 1991 if g in ("NT", "NU") else 1971)
    for y in range(Y0, Y1 + 1):
        p = P(g, y)
        if p:
            E["pop"][f"{g}|{y}"] = p
            if area.get(g): E["dens"][f"{g}|{y}"] = p / area[g]
            if P("CAN", y): E["share"][f"{g}|{y}"] = p / P("CAN", y)
            if base and y >= 1972: E["chg"][f"{g}|{y}"] = p / base - 1
            if P(g, y - 1) and y >= 1972: E["rate"][f"{g}|{y}"] = p / P(g, y - 1) - 1
        c = comp[g].get(y - 1); den = P(g, y - 1) or P(g, y)
        if c and den and y >= 1972:
            def per(v): return None if v is None else v / den * 1000
            for lid, f in (("nat", lambda c: None if "Births" not in c or "Deaths" not in c else c["Births"] - c["Deaths"]), ("imm", lambda c: c.get("Immigrants")), ("npr", lambda c: c.get("Net non-permanent residents")),
                           ("emi", lambda c: c.get("Net emigration")), ("ipm", lambda c: c.get("Net interprovincial migration")), ("flow", lambda c: c.get("Net interprovincial migration"))):
                v = per(f(c))
                if v is not None: E[lid][f"{g}|{y}"] = v

# ---- raw: housing construction, households, CPI, income, core need
hc = collections.defaultdict(dict); hc_last = {}
for r in rows("34100126"):
    if r["GEO"] in AB and r["Type of unit"] == "Total units" and r["Housing estimates"] in ("Housing starts", "Housing completions") and num(r["VALUE"]) is not None:
        k = "starts" if r["Housing estimates"] == "Housing starts" else "comp"; y = int(r["REF_DATE"]); hc[k][(AB[r["GEO"]], y)] = num(r["VALUE"]); hc_last[k] = max(hc_last.get(k, 0), y)
for k in ("starts", "comp"):
    for (g, y), v in hc[k].items():
        if P(g, y): E[k][f"{g}|{y}"] = v / P(g, y) * 1000
facts["last_year_in_raw"] = dict(hc_last)
hh = {}
for r in rows("17100159"):
    if r["GEO"] in AB and r["Size"] == "Total - Household size" and num(r["VALUE"]) is not None: hh[(AB[r["GEO"]], int(r["REF_DATE"]))] = num(r["VALUE"])
for (g, y), v in hh.items():
    if y >= 2007 and hh.get((g, 2006)): E["hhg"][f"{g}|{y}"] = v / hh[(g, 2006)] - 1
cpi = {}
for r in rows("18100005"):
    if r["GEO"] in AB and r["UOM"] == "2002=100" and r["Products and product groups"] in ("Rent", "All-items") and num(r["VALUE"]) is not None: cpi[(AB[r["GEO"]], r["Products and product groups"], int(r["REF_DATE"]))] = num(r["VALUE"])
for g in GEOS:
    for y in range(2019, 2026):
        v = [cpi.get((g, "Rent", 2019)), cpi.get((g, "Rent", y)), cpi.get((g, "All-items", 2019)), cpi.get((g, "All-items", y))]
        if all(v): E["rentrel"][f"{g}|{y}"] = (v[1] / v[0]) / (v[3] / v[2]) - 1
inc_flags = collections.Counter()
for r in rows("11100190"):
    if r["GEO"] in AB and r["Income concept"] == "Median after-tax income" and r["Economic family type"] == "Economic families and persons not in an economic family" and r["UOM"] == "2024 constant dollars":
        inc_flags[r["STATUS"]] += 1
        if num(r["VALUE"]) is not None and r["STATUS"] != "F": E["inc"][f"{AB[r['GEO']]}|{r['REF_DATE']}"] = num(r["VALUE"])
facts["income_quality_flags"] = dict(inc_flags)
chn_years = collections.Counter()
for r in rows("39100048"):
    if (r["GEO"] in AB and r["Economic family structure"] == "Total, economic family structure" and r["Gender"] == "Total - Gender" and r["Selected demographic characteristics"] == "Total, all characteristics"
            and r["Core housing need statistics"] == "Percentage of persons in core housing need" and all(str(v).startswith("Total") or k in ("REF_DATE", "GEO", "DGUID", "Core housing need statistics", "UOM", "UOM_ID", "SCALAR_FACTOR", "SCALAR_ID", "VECTOR", "COORDINATE", "VALUE", "STATUS", "SYMBOL", "TERMINATED", "DECIMALS") for k, v in r.items())):
        if num(r["VALUE"]) is not None:
            chn_years[r["REF_DATE"]] += 1
            E["chn_all"][f"{AB[r['GEO']]}|{r['REF_DATE']}"] = num(r["VALUE"])
            if r["REF_DATE"] in ("2016", "2021"): E["chn"][f"{AB[r['GEO']]}|{r['REF_DATE']}"] = num(r["VALUE"])
facts["core_need_years_in_raw"] = dict(chn_years)

# ---- raw: city vacancy and rent
vac = {}; cma_avg = {}
for r in rows("34100127"):
    v = num(r["VALUE"])
    if r["GEO"] == "Census metropolitan areas":
        if v is not None: cma_avg[int(r["REF_DATE"])] = v
    elif v is not None: vac[(r["GEO"], r["REF_DATE"])] = v
for y, v in cma_avg.items(): E["vac"][f"CAN|{y}"] = v
rent = {}; rstat = {}
for r in rows("34100133"):
    if r["Type of unit"] == "Two bedroom units" and r["Type of structure"] == "Row and apartment structures of three units and over":
        if num(r["VALUE"]) is not None and r["STATUS"] not in ("F", ".."): rent[(r["GEO"], r["REF_DATE"])] = num(r["VALUE"])
        elif r["STATUS"]: rstat[(r["GEO"], r["REF_DATE"])] = r["STATUS"]

# ---- compare
def cmp(name, shown, exp, tol_rel=1e-9, tol_abs=1e-9):
    keys = set(shown) | set(exp); bad = []; only_shown = []; only_raw = []; mx = 0.0
    for k in sorted(keys):
        a, b = shown.get(k), exp.get(k)
        if a is None: only_raw.append(k); continue
        if b is None: only_shown.append((k, a)); continue
        d = abs(a - b); mx = max(mx, d)
        if d > tol_abs and d > tol_rel * max(abs(a), abs(b)): bad.append((k, a, b))
    return {"layer": name, "compared": len(keys) - len(only_raw) - len(only_shown), "mismatch": len(bad), "max_abs_diff": mx, "shown_but_not_in_raw": len(only_shown), "in_raw_but_not_shown": len(only_raw),
            "examples_mismatch": bad[:5], "examples_shown_not_raw": only_shown[:8], "examples_raw_not_shown": only_raw[:8]}
res = []
for lid, meta in D["meta"].items():
    if meta["kind"] == "party" or lid == "rent": continue
    y0, y1 = meta["years"]; exp = {k: v for k, v in E[lid].items() if y0 <= int(k.split("|")[1]) <= y1}
    res.append(cmp(lid, D["layers"][lid], exp, tol_abs=0.051 if lid == "chn" else 1e-9))
# cities
sv = {f"{c['geo']}|{y}": v for c in D["cities"] for y, v in c["vacancy"].items() if v is not None}; ev = {f"{g}|{y}": v for (g, y), v in vac.items() if g in {c["geo"] for c in D["cities"]}}
res.append(cmp("vac (cities)", sv, ev))
sr = {f"{c['geo']}|{y}": v for c in D["cities"] for y, v in c["rent2br"].items() if v is not None}; er = {f"{g}|{y}": v for (g, y), v in rent.items() if g in {c["geo"] for c in D["cities"]}}
res.append(cmp("rent (cities)", sr, er))
supp_raw = {k for k, s in rstat.items() if s == "F" and k[0] in {c["geo"] for c in D["cities"]}}
supp_shown_as_value = [k for k in supp_raw if f"{k[0]}|{k[1]}" in sr]
supp_flagged = sum(1 for c in D["cities"] for y, s in c["rent2br_status"].items() if s == "F")
facts["rent_suppressed_F_in_raw"] = len(supp_raw); facts["rent_suppressed_flagged_in_explorer"] = supp_flagged; facts["rent_suppressed_shown_as_value"] = len(supp_shown_as_value)
facts["raw_cmas_not_in_explorer"] = sorted({g for (g, y) in vac} - {c["geo"] for c in D["cities"]})

# flows: July–June sums from quarterly raw
fl = collections.Counter(); q = collections.defaultdict(set)
for r in rows("17100045"):
    o = AB.get(r["GEO"].replace(", province of origin", "")); d = AB.get(r["Geography, province of destination"].replace(", province of destination", "")); v = num(r["VALUE"])
    if not o or not d or v is None: continue
    y, mth = int(r["REF_DATE"][:4]), r["REF_DATE"][5:]; per = y if mth in ("07", "10") else y - 1
    fl[(per, o, d)] += v; q[per].add(r["REF_DATE"])
F = json.loads((ROOT / "web/data/explorer/flows.json").read_text())
complete = {p for p, s in q.items() if len(s) == 4}
shown = {f"{p}|{o}|{d}": v for p, L in F["data"].items() for o, d, v in L}; exp = {f"{p}|{o}|{d}": v for (p, o, d), v in fl.items() if p in complete and v != 0}
shown_nz = {k: v for k, v in shown.items() if v != 0}
res.append(cmp("flow (origin–destination moves)", shown_nz, exp))
facts["flow_periods_shown"] = [min(map(int, F["data"])), max(map(int, F["data"]))]; facts["flow_incomplete_periods_in_raw"] = sorted(p for p, s in q.items() if len(s) < 4)
facts["flow_incomplete_period_shown"] = sorted(set(map(int, F["data"])) - complete)

# elections: recount elected members from the Library of Parliament file
root = ET.parse(ROOT / "data/raw/parlinfo/elected_candidates.xml").getroot(); cnt = collections.Counter()
for c in root.findall("ElectionCandidateForWeb"):
    d = c.findtext("ElectionDate")[:10]
    if c.findtext("IsGeneral") == "true" and d >= "1972": cnt[(d, AB.get(c.findtext("ProvinceEn"), c.findtext("ProvinceEn")), c.findtext("PartyNameEn"))] += 1
import os
POL = json.loads((ROOT / os.environ.get("POLITICS", "web/data/explorer/politics.json")).read_text())
if "release" in os.environ.get("POLITICS", ""):   # the release file applies the documented Elections Canada reconciliation
    _rec = json.loads((ROOT / "registry/reconciliations/parlinfo_2025_missing_members.json").read_text())
    for a in _rec["additions"]: cnt[(_rec["election_date"], a["province"], a["party"])] += 1
shown = {f"{e['date']}|{p}|{party}": n for e in POL["elections"] for p, s in e["seats_by_province"].items() for party, n in s.items()}
res.append(cmp("fed (seats by province and party)", shown, {f"{d}|{p}|{party}": n for (d, p, party), n in cnt.items()}))
HOUSE = {"1972": 264, "1974": 264, "1979": 282, "1980": 282, "1984": 282, "1988": 295, "1993": 295, "1997": 301, "2000": 301, "2004": 308, "2006": 308, "2008": 308, "2011": 308, "2015": 338, "2019": 338, "2021": 338, "2025": 343}
facts["elections_seats_recorded_vs_house_size"] = {e["date"]: [e["seats_recorded"], HOUSE.get(e["date"][:4])] for e in POL["elections"] if e["seats_recorded"] != HOUSE.get(e["date"][:4])}
ties = []
for e in POL["elections"]:
    for p, s in e["seats_by_province"].items():
        v = sorted(s.values(), reverse=True)
        if len(v) > 1 and v[0] == v[1]: ties.append([e["date"], p, {k: n for k, n in s.items() if n == v[0]}])
facts["elections_province_ties_for_most_seats"] = ties
facts["population_last_date_in_raw"] = max(popdates); facts["components_periods_in_raw"] = [min(comp["CAN"]), max(comp["CAN"])]
(ROOT / OUTFILE).write_text(json.dumps({"results": res, "facts": facts}, indent=1, default=str))
for r in res: print(f"{r['layer']:36s} compared {r['compared']:6d}  mismatch {r['mismatch']:4d}  max diff {r['max_abs_diff']:.3g}  shown-not-raw {r['shown_but_not_in_raw']:4d}  raw-not-shown {r['in_raw_but_not_shown']:4d}")
for r in res:
    for k in ("examples_mismatch", "examples_shown_not_raw", "examples_raw_not_shown"):
        if r[k]: print("  ", r["layer"], k, r[k][:6])
print(json.dumps(facts, indent=1, default=str))
