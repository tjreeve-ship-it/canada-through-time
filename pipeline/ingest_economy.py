"""Economy, government finance, language, temporary residents and 2021 place of birth.

  web/data/more/gdp.json       GDP at market prices, current and chained (2017) dollars, $ millions (36-10-0222-01), 1981-
  web/data/more/lfs.json       unemployment, employment and participation rates, 15+, both genders (14-10-0327-01), 1976-
  web/data/more/govt.json      revenue, expenditure, balance, interest, and selected federal flows by province,
                               $ millions, calendar years (36-10-0450-01), 2007-
  web/data/more/language.json  mother tongue (distributed), census years 1951-2021 (15-10-0031-01)
  web/data/more/npr.json       non-permanent residents by type, July 1 each year (17-10-0121-01), 2021-
  web/data/more/birthplace.json  immigrants by place of birth, 2021 Census, by province (98-10-0302-01)

All values as published; '..'/'x'/'F' and blank become None (no value), never zero. Nothing is filled or extended.
Rows are selected by the table's own COORDINATE member ids where labels repeat under different parents.
"""
from __future__ import annotations

import csv
import io
import json
import sys
import zipfile
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ROOT, load_registry, verify_raw  # noqa: E402

OUT = ROOT / "web/data/more"
AB = {"Canada": "CAN", "Newfoundland and Labrador": "NL", "Prince Edward Island": "PE", "Nova Scotia": "NS", "New Brunswick": "NB", "Quebec": "QC",
      "Ontario": "ON", "Manitoba": "MB", "Saskatchewan": "SK", "Alberta": "AB", "British Columbia": "BC", "Yukon": "YT",
      "Northwest Territories": "NT", "Nunavut": "NU", "Northwest Territories including Nunavut": "NT+NU", "Outside Canada": "OUT"}
REG = load_registry()["sources"]


def rows(key):
    p = verify_raw(REG[key]["raw_file"], REG[key]["sha256"])
    t = p.name.split("-")[0]
    z = zipfile.ZipFile(p)
    yield from csv.DictReader(io.TextIOWrapper(z.open(f"{t}.csv"), encoding="utf-8-sig"))


def val(r):
    v = r["VALUE"]
    return None if v in ("", None) or r["STATUS"] in ("..", "x", "F", "...") else float(v)


def nest():
    return defaultdict(lambda: defaultdict(dict))


def plain(d):
    return json.loads(json.dumps(d))


def gdp():
    out = nest()
    for r in rows("statcan_36100222"):
        if r["Estimates"] != "Gross domestic product at market prices" or r["GEO"] not in AB:
            continue
        k = {"Current prices": "cur", "Chained (2017) dollars": "real"}.get(r["Prices"])
        if k and (v := val(r)) is not None:
            out[AB[r["GEO"]]][int(r["REF_DATE"])][k] = v
    years = sorted({y for g in out.values() for y in g})
    return dict(source_id="statcan_36100222", units="$ millions", years=[years[0], years[-1]], data=plain(out),
                notes=["Current prices: nominal dollars of each year. Chained (2017) dollars remove price change and are not additive across provinces.",
                       "Northwest Territories and Nunavut are combined before 1999."])


def lfs():
    out = nest()
    want = {"Unemployment rate": "ur", "Employment rate": "er", "Participation rate": "pr"}
    for r in rows("statcan_14100327"):
        if r["Gender"] == "Total - Gender" and r["Age group"] == "15 years and over" and r["Labour force characteristics"] in want and r["GEO"] in AB:
            if (v := val(r)) is not None:
                out[AB[r["GEO"]]][int(r["REF_DATE"])][want[r["Labour force characteristics"]]] = v
    years = sorted({y for g in out.values() for y in g})
    return dict(source_id="statcan_14100327", units="%", years=[years[0], years[-1]], data=plain(out),
                notes=["Annual averages of the monthly Labour Force Survey, people 15 and over. Territories are not in this table.",
                       "Use caution comparing before and after 2006 (Statistics Canada processing change)."])


# member id (third part of COORDINATE) -> key, for 36-10-0450-01. Checked against the labels at run time.
GOV_ITEMS = {1: ("rev", "General governments revenue"), 76: ("exp", "General governments expenditure"),
             138: ("bal", "General governments surplus or deficit"), 137: ("int", "Interest on debt"),
             108: ("to_pt", "To provincial and territorial general governments"), 109: ("tax_agr", "Taxation agreements"),
             116: ("cht", "Canada Health Transfer"), 117: ("cst", "Canada Social Transfer"),
             86: ("ei", "Employment Insurance benefits"), 87: ("oas", "Old Age Security"), 146: ("ccb", "Canada Child Benefit"),
             79: ("defence", "Defence")}
LEVELS = {1: "all", 2: "federal", 3: "provincial", 4: "local", 5: "indigenous"}


def govt():
    out = defaultdict(lambda: defaultdict(lambda: defaultdict(dict)))
    labels = {}
    for r in rows("statcan_36100450"):
        c = [int(x) for x in r["COORDINATE"].split(".")]
        lvl, item = c[1], c[2]
        if lvl not in LEVELS or item not in GOV_ITEMS or r["GEO"] not in AB:
            continue
        key, label = GOV_ITEMS[item]
        assert r["Estimates"] == label, (r["COORDINATE"], r["Estimates"], label)
        labels[key] = label
        if (v := val(r)) is not None:
            out[LEVELS[lvl]][AB[r["GEO"]]][int(r["REF_DATE"])][key] = v
    years = sorted({y for l in out.values() for g in l.values() for y in g})
    return dict(source_id="statcan_36100450", units="$ millions, current prices", years=[years[0], years[-1]], labels=labels, data=plain(out),
                notes=["National-accounts basis, calendar years; differs from governments' own Public Accounts (fiscal years ending March 31).",
                       "Federal revenue and spending are allocated to provinces by Statistics Canada; 'OUT' is federal activity outside Canada.",
                       "Labels are Statistics Canada's own; 'Taxation agreements' is shown under that name, not renamed."])


def language():
    out = nest()
    want = {"Total, mother tongue": "total", "English": "en", "French": "fr", "Non-official language": "other"}
    for r in rows("statcan_15100031"):
        if r["Statistics"] == "Number" and r["Multiple responses"] == "Distributed" and r["Mother tongue"] in want and r["GEO"] in AB:
            if (v := val(r)) is not None:
                out[AB[r["GEO"]]][int(r["REF_DATE"])][want[r["Mother tongue"]]] = v
    years = sorted({y for g in out.values() for y in g})
    return dict(source_id="statcan_15100031", units="persons", years=years, data=plain(out),
                notes=["Census years only. Multiple mother tongues are distributed equally among the languages reported (Statistics Canada).",
                       "Northwest Territories and Nunavut are combined before 2001."])


def npr():
    out = nest()
    want = {"Total, non-permanent residents": "total", "Total, asylum claimants, protected persons and related groups": "asylum",
            "Work permit holders only": "work", "Study permit holders only": "study", "Work and study permit holders": "work_study", "Other": "other"}
    for r in rows("statcan_17100121"):
        if r["REF_DATE"].endswith("-07-01") and r["Non-permanent resident types"] in want and r["GEO"] in AB:
            if (v := val(r)) is not None:
                out[AB[r["GEO"]]][int(r["REF_DATE"][:4])][want[r["Non-permanent resident types"]]] = v
    years = sorted({y for g in out.values() for y in g})
    return dict(source_id="statcan_17100121", units="persons", years=years, prelim_from=2026, data=plain(out),
                notes=["July 1 of each year. Final to July 1, 2023; updated to April 1, 2026; preliminary from July 1, 2026.",
                       "Starts July 1, 2021 after a method change."])


def birthplace():
    """2021 Census: immigrants by place of birth and period of immigration, for Canada, provinces, territories and CMAs.
    Streams the 2.3 GB CSV; keeps only total citizenship, total age, total gender, counts."""
    p = verify_raw(REG["statcan_98100302"]["raw_file"], REG["statcan_98100302"]["sha256"])
    z = zipfile.ZipFile(p)
    r = csv.reader(io.TextIOWrapper(z.open("98100302.csv"), encoding="utf-8-sig"))
    h = next(r)
    col = {}
    for i, name in enumerate(h):
        for key, tag in (("all", "Total - Immigrant status"), ("non", "Non-immigrants"), ("imm", ":Immigrants["), ("p_pre80", "Before 1980"),
                         ("p80s", "1980 to 1990"), ("p90s", "1991 to 2000"), ("p00s", "2001 to 2010"), ("p11_21", "2011 to 2021"),
                         ("p11_15", "2011 to 2015"), ("p16_21", "2016 to 2021"), ("npr", "Non-permanent residents")):
            if tag in name:
                col[key] = i
    assert len(col) == 11, col
    I = {k: h.index(k) for k in ("GEO", "Citizenship (9)", "Age (8D)", "Gender (3)", "Statistics (3)", "Place of birth (290)", "Coordinate")}
    out, order = defaultdict(dict), []
    short = 0
    for row in r:
        if len(row) < len(h):
            short += 1  # footer/notes lines at the end of the file
            continue
        if row[I["Citizenship (9)"]] != "Total - Citizenship" or row[I["Age (8D)"]] != "Total - Age" or row[I["Gender (3)"]] != "Total - Gender" \
                or row[I["Statistics (3)"]] != "Count":
            continue
        geo, place = row[I["GEO"]], row[I["Place of birth (290)"]]
        if place not in order:
            order.append(place)
        out[AB.get(geo, geo)][place] = {k: (None if row[i] in ("", "..", "x", "F") or (row[i + 1] or "").strip() in ("..", "x", "F") else int(row[i])) for k, i in col.items()}
    # Classify places with the table's own member hierarchy (MetaData: Member ID / Parent Member ID).
    meta = list(csv.reader(io.TextIOWrapper(z.open("98100302_MetaData.csv"), encoding="utf-8-sig")))
    dim = next(r[0] for r in meta if len(r) > 1 and r[1].startswith("Place of birth"))
    mem = [r for r in meta if r and r[0] == dim and len(r) > 4 and r[3]]
    name, parent = {r[3]: r[1].strip() for r in mem}, {r[3]: r[4] for r in mem}
    has_kids = {p_ for p_ in parent.values() if p_}
    outside = next(k for k, v in name.items() if v == "Outside Canada")
    def under(k, anc):
        while k:
            if k == anc:
                return True
            k = parent.get(k)
        return False
    countries = [name[k] for k in name if k not in has_kids and under(k, outside)]
    continents = [name[k] for k in name if parent.get(k) == outside]
    assert set(countries) <= set(order) and set(continents) <= set(order), "place names differ from the data file"
    total = order[0]
    keep = set(countries) | set(continents) | {total, "Outside Canada"}
    slim = {g: {pl: (v if pl == total else {"imm": v["imm"], "p16_21": v["p16_21"]}) for pl, v in d.items() if pl in keep} for g, d in out.items()}
    return dict(source_id="statcan_98100302", units="persons", year=2021, places=[total], countries=countries, continents=continents, data=plain(slim),
                notes=["2021 Census, 25% sample, population in private households; Statistics Canada rounds counts randomly.",
                       "Place of birth is country of birth, which can differ from citizenship. Includes the place-of-birth groupings (continents, regions) as published.",
                       "Describes immigrants living in Canada in 2021 by when they arrived, not yearly arrivals."])


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    only = set(sys.argv[1:])
    for name, fn in (("gdp", gdp), ("lfs", lfs), ("govt", govt), ("language", language), ("npr", npr), ("birthplace", birthplace)):
        if only and name not in only:
            continue
        d = fn()
        (OUT / f"{name}.json").write_text(json.dumps(d, separators=(",", ":"), ensure_ascii=False))
        print(name, d.get("years", d.get("year")), len(json.dumps(d)) // 1024, "KB")


if __name__ == "__main__":
    main()
