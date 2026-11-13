"""IRCC open data on admissions of permanent residents (PR), January 2015 onward, plus the
Facts and Figures 2016 file for 2007-2016.

Rules (see registry/sources.yaml):
- Only published calendar-year totals ("YYYY Total" columns) are read; no month or quarter is summed by us.
- IRCC publishes 0-5 as "--": that becomes None (suppressed), never zero.
- IRCC rounds every other value to the nearest 5, so parts may not add to published totals; shares of all
  admissions use the published Total row as the denominator.
- The final year is partial (through the month in the file title) and is flagged, not compared with full years.
- 2007-2014 come from the older Facts and Figures file (unrounded, different vintage). 2015 and 2016, which both
  files cover, are taken from the current monthly file only; the overlap is kept for the vintage check in tests.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import openpyxl
import xlrd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ROOT, load_registry, verify_raw  # noqa: E402

CATS = {"Economic - Total": "economic", "Sponsored Family - Total": "family",
        "Resettled Refugee & Protected Person in Canada - Total": "refugee", "All Other Immigration - Total": "other"}
PROV = {"Newfoundland and Labrador": "NL", "Prince Edward Island": "PE", "Nova Scotia": "NS", "New Brunswick": "NB", "Quebec": "QC",
        "Ontario": "ON", "Manitoba": "MB", "Saskatchewan": "SK", "Alberta": "AB", "British Columbia": "BC", "Yukon": "YT",
        "Northwest Territories": "NT", "Nunavut": "NU", "Province/Territory not stated": "unstated", "Total": "CAN"}


def num(v):
    if isinstance(v, str):
        v = v.strip()
        if v == "--":
            return None  # suppressed 0-5
        if v == "":
            raise ValueError("blank cell in a total column")
        return int(v.replace(",", ""))
    if v is None:
        raise ValueError("empty cell in a total column")
    return int(v)


def _sheet(path):
    rows = [list(r) for r in openpyxl.load_workbook(path, read_only=True).worksheets[0].iter_rows(values_only=True)]
    title = rows[0][0]
    m = re.search(r"January (\d{4}) - (\w+) (\d{4})", title)
    assert m, title
    cols = {int(c.split()[0]): i for i, c in enumerate(rows[3]) if isinstance(c, str) and re.fullmatch(r"\d{4} Total", c)}
    assert int(m.group(3)) in cols, "no total column for the final year"
    src = next(r[0] for r in rows if r and isinstance(r[0], str) and r[0].startswith("Source:"))
    return rows, cols, dict(title=title, partial_year=int(m.group(3)), partial_through=m.group(2), source_line=src)


def flat(path):
    """Country of citizenship -> {year: count}; plus the published Total row."""
    rows, cols, meta = _sheet(path)
    out, total = {}, None
    for r in rows[5:]:
        name = r[0] if r else None
        if not isinstance(name, str) or not name.strip() or name.startswith(("Notes", "Source")):
            continue
        vals = {y: num(r[i]) for y, i in cols.items()}
        if name == "Total":
            total = vals
        else:
            out[name] = vals
    assert total
    return dict(meta, years=sorted(cols), rows=out, total=total)


def blocked(path):
    """Files where each entity is a block of category rows followed by '<entity> - Total'.
    Returns entity -> {'total': {year: n}, 'cats': {economic|family|refugee|other: {year: n}}}."""
    rows, cols, meta = _sheet(path)
    out, pend, grand = {}, {}, None
    for r in rows[5:]:
        if not r:
            continue
        c0, c1 = (r[0] if len(r) > 0 else None), (r[1] if len(r) > 1 else None)
        if isinstance(c1, str) and c1 in CATS:
            pend[CATS[c1]] = {y: num(r[i]) for y, i in cols.items()}
        elif isinstance(c0, str) and c0.endswith(" - Total"):
            name = c0[: -len(" - Total")]
            out[name] = dict(total={y: num(r[i]) for y, i in cols.items()}, cats=pend)
            pend = {}
        elif c0 == "Total":
            grand = {y: num(r[i]) for y, i in cols.items()}
    assert grand and not pend
    return dict(meta, years=sorted(cols), rows=out, total=grand)


def facts_2016(path):
    s = xlrd.open_workbook(path).sheet_by_index(0)
    hdr = s.row_values(4)
    assert hdr[0] == "Source country"
    years = [int(y) for y in hdr[1:] if y != ""]
    out, total = {}, None
    for i in range(5, s.nrows):
        r = s.row_values(i)
        if not r[0] or str(r[0]).startswith("Note"):
            continue
        vals = {y: int(r[1 + k]) for k, y in enumerate(years)}
        if r[0] == "Total":
            total = vals
        else:
            out[r[0]] = vals
    assert total
    note = next(s.row_values(i)[0] for i in range(s.nrows) if str(s.row_values(i)[0]).startswith("Note"))
    return dict(years=years, rows=out, total=total, note=note)


# Facts and Figures 2016 names that differ from the monthly file's names (same country of citizenship).
FF_NAME = {"China": "China, People's Republic of", "United States": "United States of America", "Iran": "Iran",
           "Korea, Republic of": "Korea, Republic of", "Cameroon": "Cameroon, Federal Republic of", "Viet Nam": "Vietnam",
           "Hong Kong": "Hong Kong SAR", "United Kingdom and Colonies": "United Kingdom and Overseas Territories",
           "Country of citizenship not stated": "Country not stated"}
# "Serbia and Montenegro" (a former state) is kept as its own row, not merged into either successor.


def main():
    reg = load_registry()["sources"]
    get = lambda k: verify_raw(reg[k]["raw_file"], reg[k]["sha256"])
    citz = flat(get("ircc_pr_citizenship"))
    cat = blocked(get("ircc_pr_citizenship_category"))
    prov = blocked(get("ircc_pr_province_category"))
    ff = facts_2016(get("ircc_facts_2016_source_country"))

    names = set(citz["rows"])
    ff_rows = {FF_NAME.get(k, k): v for k, v in ff["rows"].items()}
    unmatched = sorted(k for k in ff_rows if k not in names and sum(ff_rows[k].values()) > 1000)
    countries = {}
    for k in sorted(names | set(ff_rows)):
        early = {y: v for y, v in ff_rows.get(k, {}).items() if y < 2015}
        countries[k] = {**early, **citz["rows"].get(k, {})}
    total = {**{y: v for y, v in ff["total"].items() if y < 2015}, **citz["total"]}

    out = dict(
        source_ids=["ircc_pr_citizenship", "ircc_pr_citizenship_category", "ircc_pr_province_category", "ircc_facts_2016_source_country"],
        what="Admissions of permanent residents by country of citizenship, calendar years",
        partial_year=citz["partial_year"], partial_through=citz["partial_through"], source_line=citz["source_line"],
        early_years=[y for y in ff["years"] if y < 2015], vintage_break=2015,
        years=sorted(total), total=total, countries=countries,
        by_category={k: v["cats"] for k, v in cat["rows"].items()},
        provinces={PROV[k]: v for k, v in prov["rows"].items() if k in PROV},
        overlap_2015_2016=dict(facts_2016={y: ff["total"][y] for y in (2015, 2016)}, monthly={y: citz["total"][y] for y in (2015, 2016)}),
        unmatched_early_names=unmatched,
        notes=["Counts are admissions by country of citizenship, not country of birth.",
               "From 2015: IRCC rounds to the nearest 5 and shows 0-5 as suppressed; 2007-2014: IRCC Facts and Figures 2016 (unrounded, earlier vintage).",
               f"{citz['partial_year']} covers January to {citz['partial_through']} only.",
               "Preliminary and subject to change (IRCC)."])
    dst = ROOT / "web/data/explorer/pr_citizenship.json"
    dst.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    print(dst.relative_to(ROOT), len(countries), "countries", out["years"][0], "-", out["years"][-1], "| unmatched early names >1000:", unmatched)


if __name__ == "__main__":
    main()
