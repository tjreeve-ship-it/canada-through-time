"""Housing and cost-of-living bundle: CMHC (via Statistics Canada tables) + StatCan households, CPI and income.

Reads the unmodified raw zips in data/raw/statcan/ (hash-checked against registry/sources.yaml), writes
  data/processed/housing/*.csv      tidy long tables, one row per published value (status flags kept)
  web/data/housing/*.json           compact series for the explorer

Nothing is imputed. Suppressed ("F"), unavailable ("..") and missing values stay missing.

  python3 pipeline/ingest_housing.py
"""
from __future__ import annotations

import csv
import io
import json
import zipfile
from collections import defaultdict

from common import ROOT, load_registry, verify_raw

RAW = ROOT / "data/raw/statcan"
PROC = ROOT / "data/processed/housing"
WEB = ROOT / "web/data/housing"
ABBR = {"Canada": "CAN", "Newfoundland and Labrador": "NL", "Prince Edward Island": "PE", "Nova Scotia": "NS", "New Brunswick": "NB",
        "Quebec": "QC", "Ontario": "ON", "Manitoba": "MB", "Saskatchewan": "SK", "Alberta": "AB", "British Columbia": "BC",
        "Yukon": "YT", "Northwest Territories": "NT", "Nunavut": "NU"}


def rows(table: str):
    reg = load_registry()["sources"][f"statcan_{table}"]
    verify_raw(reg["raw_file"], reg["sha256"])
    with zipfile.ZipFile(RAW / f"{table}-eng.zip") as z, z.open(f"{table}.csv") as f:
        yield from csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))


def num(v):
    return None if v in ("", None) else float(v)


def write_csv(name, header, data):
    PROC.mkdir(parents=True, exist_ok=True)
    with (PROC / name).open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(data)


def construction():
    """34-10-0126: starts, under construction, completions; provinces, annual, 1955–. No territories in this table."""
    out = defaultdict(lambda: defaultdict(dict))
    tidy = []
    for r in rows("34100126"):
        g = ABBR.get(r["GEO"])
        if not g:
            continue
        key = {"Housing starts": "starts", "Housing under construction": "under_construction", "Housing completions": "completions"}[r["Housing estimates"]]
        unit = {"Total units": "total", "Single-detached": "single", "Multiples": "multiples", "Semi-detached": "semi", "Row": "row",
                "Apartment and other unit types": "apartment"}[r["Type of unit"]]
        v = num(r["VALUE"])
        tidy.append([r["REF_DATE"], g, key, unit, r["VALUE"], r["STATUS"], r["VECTOR"]])
        if v is not None:
            out[g][f"{key}_{unit}"][int(r["REF_DATE"])] = v
    write_csv("construction_annual.csv", ["year", "geo", "measure", "unit_type", "value", "status", "vector"], tidy)
    return out


def households():
    """17-10-0159: private households on July 1, 2006–; Canada, provinces, territories."""
    out = defaultdict(dict)
    tidy = []
    for r in rows("17100159"):
        if r["Size"] != "Total - Household size":
            continue
        g = ABBR[r["GEO"]]
        tidy.append([r["REF_DATE"], g, r["VALUE"], r["STATUS"], r["VECTOR"]])
        if r["VALUE"]:
            out[g][int(r["REF_DATE"])] = float(r["VALUE"])
    write_csv("households_july1.csv", ["year", "geo", "households", "status", "vector"], tidy)
    return out


def cpi():
    """18-10-0005: annual CPI (2002=100). Provinces from 1979, Canada from 1914/1949. Territories only as cities."""
    keep = {"All-items": "all", "Rent": "rent", "Shelter": "shelter", "Rented accommodation": "rented", "Owned accommodation": "owned"}
    out = defaultdict(lambda: defaultdict(dict))
    tidy = []
    for r in rows("18100005"):
        g = ABBR.get(r["GEO"])
        p = keep.get(r["Products and product groups"])
        if not g or not p:
            continue
        tidy.append([r["REF_DATE"], g, p, r["VALUE"], r["STATUS"], r["UOM"], r["VECTOR"]])
        if r["VALUE"]:
            out[g][p][int(r["REF_DATE"])] = float(r["VALUE"])
    write_csv("cpi_annual.csv", ["year", "geo", "product", "index", "status", "base", "vector"], tidy)
    return out


def income():
    """11-10-0190: median after-tax income, economic families and persons not in an economic family, 2024 constant dollars."""
    out = defaultdict(dict)
    tidy = []
    for r in rows("11100190"):
        if r["Income concept"] != "Median after-tax income" or r["Economic family type"] != "Economic families and persons not in an economic family":
            continue
        g = ABBR.get(r["GEO"])
        if not g:
            continue
        tidy.append([r["REF_DATE"], g, r["VALUE"], r["STATUS"], r["UOM"], r["VECTOR"]])
        if r["VALUE"]:
            out[g][int(r["REF_DATE"])] = float(r["VALUE"])
    write_csv("income_median_after_tax.csv", ["year", "geo", "median_after_tax_income", "status", "uom", "vector"], tidy)
    return out


# Census metropolitan areas → Natural Earth populated place (core city). The point marks the core city, not the CMA centroid.
CMA_PLACE = {"Abbotsford-Mission": "Abbotsford", "Greater Sudbury": "Sudbury", "Kitchener-Cambridge-Waterloo": "Kitchener",
             "Ottawa-Gatineau": "Ottawa", "Saguenay": "Chicoutimi", "St. Catharines-Niagara": None, "Brantford": None, "Guelph": None}


def cities():
    """34-10-0127 vacancy (apartments 6+ units, private, October) and 34-10-0133 average rent (2-bedroom, row and apartment 3+), CMAs."""
    from build_explorer_data import lcc  # same projection as the map
    ne = json.loads((ROOT / "data/raw/naturalearth/ne_10m_populated_places_simple.geojson").read_text())
    places = {}
    for f in ne["features"]:
        p = f["properties"]
        if p.get("adm0name") == "Canada":
            places[(p["name"], p.get("adm1name"))] = (p["longitude"], p["latitude"])
    vac = defaultdict(dict)
    vac_tidy = []
    for r in rows("34100127"):
        geo = r["GEO"]
        vac_tidy.append([r["REF_DATE"], geo, r["VALUE"], r["STATUS"], r["VECTOR"]])
        if r["VALUE"]:
            vac[geo][int(r["REF_DATE"])] = float(r["VALUE"])
    write_csv("vacancy_cma.csv", ["year", "geo", "vacancy_rate_pct", "status", "vector"], vac_tidy)
    rent = defaultdict(dict)
    rent_status = defaultdict(dict)
    rent_tidy = []
    for r in rows("34100133"):
        if r["Type of unit"] != "Two bedroom units" or r["Type of structure"] != "Row and apartment structures of three units and over":
            continue
        rent_tidy.append([r["REF_DATE"], r["GEO"], r["VALUE"], r["STATUS"], r["VECTOR"]])
        y = int(r["REF_DATE"])
        if r["VALUE"]:
            rent[r["GEO"]][y] = float(r["VALUE"])
        elif r["STATUS"]:
            rent_status[r["GEO"]][y] = r["STATUS"]
    write_csv("rent_2br_centres.csv", ["year", "geo", "avg_rent_2br_dollars", "status", "vector"], rent_tidy)
    out, unplaced = [], []
    for geo in sorted(vac):
        if geo.startswith("Census metropolitan areas") or "excluding" in geo or "part," in geo:
            continue
        name, prov = geo.split(", ", 1)
        prov_main = prov.split("/")[0]
        key = CMA_PLACE.get(name, name)
        ll = places.get((key, prov_main)) if key else None
        if ll is None and key:  # Natural Earth spells a few provinces/places differently
            ll = next((v for (n, a), v in places.items() if n == key), None)
        if ll is None:
            unplaced.append(geo)
        xy = list(lcc(*ll)) if ll else None
        out.append({"name": name, "geo": geo, "prov": ABBR.get(prov_main), "xy": xy, "place": key if ll else None,
                    "vacancy": {str(k): v for k, v in sorted(vac[geo].items())},
                    "rent2br": {str(k): v for k, v in sorted(rent.get(geo, {}).items())},
                    "rent2br_status": {str(k): v for k, v in sorted(rent_status.get(geo, {}).items())}})
    national = {str(k): v for k, v in sorted(vac["Census metropolitan areas"].items())}
    return out, unplaced, national


def core_need():
    """39-10-0048: percent of persons in core housing need; census years. Only 2016 and 2021 are carried forward."""
    out = defaultdict(dict)
    tidy = []
    for r in rows("39100048"):
        if (r["Economic family structure"] != "Total, economic family structure" or r["Gender"] != "Total - Gender"
                or r["Selected demographic characteristics"] != "Total, all characteristics"):
            continue
        g = ABBR.get(r["GEO"])
        if not g or r["REF_DATE"] not in ("2016", "2021"):
            continue
        stat = {"Percentage of persons in core housing need": "pct", "Number in core housing need": "in_need",
                "Number examined for core housing need": "examined"}.get(r["Core housing need statistics"])
        if not stat:
            continue
        tidy.append([r["REF_DATE"], g, stat, r["VALUE"], r["STATUS"], r["VECTOR"]])
        if r["VALUE"]:
            out[g].setdefault(r["REF_DATE"], {})[stat] = float(r["VALUE"])
    write_csv("core_housing_need_census.csv", ["census_year", "geo", "statistic", "value", "status", "vector"], tidy)
    return out


def main():
    WEB.mkdir(parents=True, exist_ok=True)
    reg = load_registry()["sources"]
    con, hh, cp, inc = construction(), households(), cpi(), income()
    cit, unplaced, nat = cities()
    chn = core_need()
    (WEB / "core_need.json").write_text(json.dumps({"source": "statcan_39100048", "years": [2016, 2021], "data": chn}))
    pack = lambda d: {g: {k: {str(y): v for y, v in sorted(s.items())} for k, s in m.items()} for g, m in d.items()}  # noqa: E731
    (WEB / "construction.json").write_text(json.dumps({"source": "statcan_34100126", "data": pack(con)}))
    (WEB / "households.json").write_text(json.dumps({"source": "statcan_17100159", "prelim_from": 2025,
        "data": {g: {str(y): v for y, v in sorted(s.items())} for g, s in hh.items()}}))
    (WEB / "cpi.json").write_text(json.dumps({"source": "statcan_18100005", "base": "2002=100", "data": pack(cp)}))
    (WEB / "income.json").write_text(json.dumps({"source": "statcan_11100190", "uom": "2024 constant dollars",
        "data": {g: {str(y): v for y, v in sorted(s.items())} for g, s in inc.items()}}))
    (WEB / "cities.json").write_text(json.dumps({"sources": ["statcan_34100127", "statcan_34100133", "naturalearth_places"],
        "cma_average_vacancy": nat, "unplaced": unplaced, "cities": cit}))
    (WEB / "registry.json").write_text(json.dumps({k: {f: v.get(f) for f in ("title", "publisher", "table_id", "doi", "landing_url", "retrieved", "licence",
        "licence_url", "attribution", "methodology_notes", "limitations", "sha256", "reporting_period", "units", "coverage")}
        for k, v in reg.items()}))
    print(f"construction {len(con)} geos · households {len(hh)} · cpi {len(cp)} · income {len(inc)} · cities {len(cit)} placed, {len(unplaced)} unplaced: {unplaced}")


if __name__ == "__main__":
    main()
