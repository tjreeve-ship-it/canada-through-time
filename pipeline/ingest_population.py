"""Ingest Statistics Canada Table 17-10-0009-01 (quarterly population estimates).

Reads the raw zip unmodified (verified against the registry hash), writes:
  data/processed/population_quarterly.csv   long format with provenance columns
  web/data/population.json                  compact series for the map

Nothing in data/raw is ever written to.
"""
from __future__ import annotations

import csv
import io
import json
import zipfile
from pathlib import Path

from common import ROOT, load_registry, verify_raw

SOURCE_ID = "statcan_17100009"
START = "1971-07-01"  # first date on a consistent methodology (see registry)

# Statistics Canada Standard Geographical Classification codes
GEO_CODES = {
    "Canada": "01",
    "Newfoundland and Labrador": "10",
    "Prince Edward Island": "11",
    "Nova Scotia": "12",
    "New Brunswick": "13",
    "Quebec": "24",
    "Ontario": "35",
    "Manitoba": "46",
    "Saskatchewan": "47",
    "Alberta": "48",
    "British Columbia": "59",
    "Yukon": "60",
    "Northwest Territories": "61",
    "Nunavut": "62",
    "Northwest Territories including Nunavut": "61+62",
}
ABBR = {"01": "CAN", "10": "NL", "11": "PE", "12": "NS", "13": "NB", "24": "QC", "35": "ON",
        "46": "MB", "47": "SK", "48": "AB", "59": "BC", "60": "YT", "61": "NT", "62": "NU", "61+62": "NT+NU"}


def read_rows(zip_path: Path) -> list[dict]:
    with zipfile.ZipFile(zip_path) as z:
        text = z.read("17100009.csv").decode("utf-8-sig")
    return list(csv.DictReader(io.StringIO(text)))


def main() -> None:
    reg = load_registry()["sources"][SOURCE_ID]
    raw = verify_raw(reg["raw_file"], reg["sha256"])
    rows = read_rows(raw)

    out, unknown = [], set()
    for r in rows:
        if r["REF_DATE"] < START:
            continue
        code = GEO_CODES.get(r["GEO"])
        if code is None:
            unknown.add(r["GEO"])
            continue
        if r["VALUE"] == "":
            continue
        out.append({
            "ref_date": r["REF_DATE"], "geo_code": code, "geo_abbr": ABBR[code], "geo_name": r["GEO"],
            "value": int(r["VALUE"]), "status": r["STATUS"], "vector": r["VECTOR"], "source_id": SOURCE_ID,
        })
    if unknown:
        raise ValueError(f"Unmapped geographies in source: {sorted(unknown)}")

    proc = ROOT / "data/processed/population_quarterly.csv"
    proc.parent.mkdir(parents=True, exist_ok=True)
    with proc.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(out[0].keys()))
        w.writeheader()
        w.writerows(out)

    dates = sorted({r["ref_date"] for r in out})
    series: dict[str, list] = {ABBR[c]: [None] * len(dates) for c in GEO_CODES.values()}
    status: dict[str, list] = {ABBR[c]: [""] * len(dates) for c in GEO_CODES.values()}
    idx = {d: i for i, d in enumerate(dates)}
    for r in out:
        series[r["geo_abbr"]][idx[r["ref_date"]]] = r["value"]
        status[r["geo_abbr"]][idx[r["ref_date"]]] = r["status"]

    web = {
        "source_id": SOURCE_ID,
        "attribution": reg["attribution"],
        "doi": reg["doi"],
        "units": reg["units"],
        "dates": dates,
        "series": series,
        "status": status,
        "notes": reg["methodology_notes"],
    }
    wpath = ROOT / "web/data/population.json"
    wpath.parent.mkdir(parents=True, exist_ok=True)
    wpath.write_text(json.dumps(web, separators=(",", ":")))
    print(f"{len(out)} rows, {dates[0]} -> {dates[-1]} ({len(dates)} quarters) -> {proc.relative_to(ROOT)}, {wpath.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
