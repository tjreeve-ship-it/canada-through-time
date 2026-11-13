"""2021 Census Profile for census metropolitan areas, tracted census agglomerations and census tracts (98-401-X2021007).

Streams the 2.6 GB CSV once and keeps a fixed list of characteristics (chosen by CHARACTERISTIC_ID, checked against the
names at run time). Values as published: count (C1) and rate (C10, where Statistics Canada publishes one). Suppressed or
not-available cells ('x', '..', 'F', '...', blank) become None, never zero. Statistics Canada rounds counts randomly and
suppresses areas with low response; each area keeps its published data-quality flag and non-response rates.

Output: web/data/cities/ct_profile.json  {fields, areas: {DGUID: {name, level, cma, q, tnr, v: [..]}}}
"""
import csv
import io
import json
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ROOT, load_registry, verify_raw  # noqa: E402

# (key, id, expected name start, which value: 'n' count or 'r' rate)
FIELDS = [
    ("pop", 1, "Population, 2021", "n"), ("pop16", 2, "Population, 2016", "n"), ("dens", 6, "Population density per square kilometre", "n"),
    ("area", 7, "Land area in square kilometres", "n"), ("u15", 35, "0 to 14 years", "n"), ("o65", 37, "65 years and over", "n"),
    ("age", 40, "Median age of the population", "n"),
    ("hhinc", 243, "Median total income of household in 2020 ($)", "n"), ("hhinc_at", 244, "Median after-tax income of household in 2020 ($)", "n"),
    ("lim", 345, "Prevalence of low income based on the Low-income measure, after tax (LIM-AT) (%)", "n"),
    ("en", 396, "English", "r"), ("fr", 397, "French", "r"), ("nonoff", 398, "Non-official languages", "r"),
    ("indig", 1403, "Indigenous identity", "r"),
    ("own", 1415, "Owner", "r"), ("rent", 1416, "Renter", "r"),
    ("shelter30", 1467, "Spending 30% or more of income on shelter costs", "r"), ("homeval", 1488, "Median value of dwellings ($)", "n"),
    ("ph", 1527, "Total - Immigrant status and period of immigration for the population in private households", "n"),
    ("imm", 1529, "Immigrants", "r"), ("imm_new", 1536, "2016 to 2021", "r"), ("npr", 1537, "Non-permanent residents", "r"),
    ("vm", 1684, "Total visible minority population", "r"), ("vm_sa", 1685, "South Asian", "r"), ("vm_cn", 1686, "Chinese", "r"),
    ("vm_bl", 1687, "Black", "r"), ("vm_fi", 1688, "Filipino", "r"), ("vm_ar", 1689, "Arab", "r"), ("vm_la", 1690, "Latin American", "r"),
    ("vm_sea", 1691, "Southeast Asian", "r"), ("vm_wa", 1692, "West Asian", "r"), ("vm_ko", 1693, "Korean", "r"), ("vm_ja", 1694, "Japanese", "r"),
    ("degree", 2008, "Bachelor's degree or higher", "r"), ("ur", 2230, "Unemployment rate", "n"),
    ("imm_n", 1544, "Total - Place of birth for the immigrant population", "n"),
]
POB = range(1545, 1604)          # places of birth of immigrants (continents and countries, counts)
BAD = {"x", "..", "...", "F", "E", ""}


def num(s):
    s = (s or "").strip()
    if s in BAD:
        return None
    return float(s)


def main():
    reg = load_registry()["sources"]["statcan_98401X2021007"]
    p = verify_raw(reg["raw_file"], reg["sha256"])
    z = zipfile.ZipFile(p)
    want = {f[1]: f for f in FIELDS}
    names_seen, pob_names = {}, {}
    areas = {}
    with z.open("98-401-X2021007_English_CSV_data.csv") as fh:
        r = csv.reader(io.TextIOWrapper(fh, encoding="latin-1"))
        h = next(r)
        I = {k: h.index(k) for k in ("DGUID", "GEO_LEVEL", "GEO_NAME", "TNR_SF", "TNR_LF", "DATA_QUALITY_FLAG", "CHARACTERISTIC_ID", "CHARACTERISTIC_NAME", "C1_COUNT_TOTAL", "C10_RATE_TOTAL")}
        sym1 = I["C1_COUNT_TOTAL"] + 1
        cma = None
        for row in r:
            cid = int(row[I["CHARACTERISTIC_ID"]])
            if cid != 1 and cid not in want and cid not in POB:
                continue
            g = row[I["DGUID"]]
            if g not in areas:
                lvl = row[I["GEO_LEVEL"]]
                if lvl != "Census tract":
                    cma = g
                areas[g] = dict(name=row[I["GEO_NAME"]], level=lvl, cma=cma if lvl == "Census tract" else None, q=row[I["DATA_QUALITY_FLAG"]],
                                tnr=[num(row[I["TNR_SF"]]), num(row[I["TNR_LF"]])], v=[None] * len(FIELDS), pob={})
            a = areas[g]
            name = row[I["CHARACTERISTIC_NAME"]].strip()
            cnt = None if row[sym1].strip() in BAD - {""} else num(row[I["C1_COUNT_TOTAL"]])
            rate = num(row[I["C10_RATE_TOTAL"]])
            if cid in want:
                key, _, expect, which = want[cid]
                if not name.startswith(expect):
                    raise SystemExit(f"characteristic {cid} is '{name}', expected '{expect}'")
                names_seen[key] = name
                a["v"][FIELDS.index(want[cid])] = cnt if which == "n" else rate
            if cid in POB:
                pob_names[cid] = name
                if cnt is not None:   # a published zero is kept as 0; suppressed stays absent
                    a["pob"][cid] = int(cnt)
    pob_ids = sorted(pob_names)
    for a in areas.values():   # compact: one list per area in pob_ids order (None = suppressed), omitted when all are suppressed
        row = [a["pob"].get(k) for k in pob_ids]
        a["pob"] = row if any(v is not None for v in row) else None
    out = dict(pob_ids=[str(k) for k in pob_ids], source_id="statcan_98401X2021007", year=2021, fields=[f[0] for f in FIELDS], field_names=names_seen,
               pob_names={str(k): v for k, v in sorted(pob_names.items())},
               notes=["2021 Census of Population. Income is for 2020 (pandemic benefits included). Most measures are from the 25% long-form sample; Statistics Canada rounds counts randomly.",
                      "Suppressed or unavailable values are kept as missing, never zero. Data-quality flag and global non-response rates (short form, long form) are kept per area.",
                      "Rates are Statistics Canada's published percentages."],
               areas=areas)
    dst = ROOT / "web/data/cities/ct_profile.json"; dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(json.dumps(out, separators=(",", ":"), ensure_ascii=False))
    idx = {g[-3:]: [a["name"], a["v"][0]] for g, a in areas.items() if a["level"] != "Census tract"}   # small index for search
    (ROOT / "web/data/cities/cma_index.json").write_text(json.dumps(dict(source_id="statcan_98401X2021007", cities=idx, pob_names={str(k): v for k, v in sorted(pob_names.items())}), ensure_ascii=False))
    lv = {}
    for a in areas.values(): lv[a["level"]] = lv.get(a["level"], 0) + 1
    print(dst.relative_to(ROOT), round(dst.stat().st_size / 1e6, 1), "MB", lv)


if __name__ == "__main__":
    main()
