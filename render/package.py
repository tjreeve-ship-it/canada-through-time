"""Build the publication package for a story: post text, key statistics, sources,
methodology and supporting data. Every number here is computed from the processed
dataset, so the package regenerates whenever the data changes.

  python3 render/package.py --story population-provinces-1971-2026
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
from common import load_registry  # noqa: E402

NAMES = {"NL": "Newfoundland and Labrador", "PE": "Prince Edward Island", "NS": "Nova Scotia", "NB": "New Brunswick",
         "QC": "Quebec", "ON": "Ontario", "MB": "Manitoba", "SK": "Saskatchewan", "AB": "Alberta",
         "BC": "British Columbia", "YT": "Yukon", "NT": "Northwest Territories", "NU": "Nunavut", "CAN": "Canada"}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--story", required=True)
    a = ap.parse_args()
    story = json.loads((ROOT / "web/stories" / f"{a.story}.json").read_text())
    reg = load_registry()["sources"]
    src = reg["statcan_17100009"]

    by = defaultdict(dict)
    for r in csv.DictReader((ROOT / "data/processed/population_quarterly.csv").open()):
        by[r["ref_date"]][r["geo_abbr"]] = int(r["value"])
    s, e = story["start"], story["end"]
    v0, v1 = by[s], by[e]

    def chg(k, base_date=s):
        b = by[base_date][k]
        return v1[k] - b, v1[k] / b - 1

    regions = [k for k in NAMES if k not in ("CAN", "NT", "NU")]
    growth = sorted(regions, key=lambda k: chg(k)[1], reverse=True)
    absolute = sorted(regions, key=lambda k: chg(k)[0], reverse=True)
    can_d, can_p = chg("CAN")
    share_on_s, share_on_e = v0["ON"] / v0["CAN"], v1["ON"] / v1["CAN"]
    west = ["AB", "BC", "SK", "MB"]
    atl = ["NL", "PE", "NS", "NB"]
    sh = lambda ks, v: sum(v[k] for k in ks) / v["CAN"]  # noqa: E731

    milestones = []
    for m in story.get("milestones", []):
        d = next((d for d in sorted(by) if s <= d <= e and by[d]["CAN"] >= m), None)
        if d:
            milestones.append((m, d, by[d]["CAN"]))

    out = ROOT / "exports" / a.story / "package"
    out.mkdir(parents=True, exist_ok=True)
    fmt = lambda n: f"{n:,}"  # noqa: E731
    pct = lambda p: f"{p * 100:+.0f}%"  # noqa: E731
    sy, ey = s[:4], e[:4]

    stats = [
        f"Canada: {fmt(v0['CAN'])} (July 1, {sy}) → {fmt(v1['CAN'])} (July 1, {ey}), {pct(can_p)} (+{can_d / 1e6:.1f} million).",
        f"Fastest growth since {sy}: {NAMES[growth[0]]} {pct(chg(growth[0])[1])}, {NAMES[growth[1]]} {pct(chg(growth[1])[1])}, "
        f"{NAMES[growth[2]]} {pct(chg(growth[2])[1])}.",
        f"Slowest growth: {NAMES[growth[-1]]} {pct(chg(growth[-1])[1])} ({fmt(v0[growth[-1]])} → {fmt(v1[growth[-1]])}).",
        f"Largest absolute gain: {NAMES[absolute[0]]} +{chg(absolute[0])[0] / 1e6:.1f} million.",
        f"Ontario's share of Canada: {share_on_s:.1%} → {share_on_e:.1%}. Western provinces (MB, SK, AB, BC): "
        f"{sh(west, v0):.1%} → {sh(west, v1):.1%}. Atlantic provinces: {sh(atl, v0):.1%} → {sh(atl, v1):.1%}.",
        f"Nunavut (separate estimates begin July 1991): {fmt(by['1991-07-01']['NU'])} → {fmt(v1['NU'])} {pct(chg('NU', '1991-07-01')[1])}.",
    ] + [f"Canada first estimated above {m // 1_000_000} million on {d} ({fmt(val)})." for m, d, val in milestones]

    post = (
        f"Where Canadians live, {sy}–{ey} 🇨🇦\n\n"
        f"Canada grew from {v0['CAN'] / 1e6:.1f}M to {v1['CAN'] / 1e6:.1f}M people ({pct(can_p)}). "
        f"{NAMES[growth[0]]} grew fastest ({pct(chg(growth[0])[1])}); {NAMES[growth[-1]]} barely changed ({pct(chg(growth[-1])[1])}).\n\n"
        f"Data: Statistics Canada, Table 17-10-0009-01"
    )

    md = [f"# {story['title']}", "", f"_{story['subtitle']}_", "",
          "## Videos", "",
          *[f"- `{a.story}_{k}_{v['height']}p.mp4` — {k.replace('x', ':')}, {v['width']}×{v['height']}, {story['fps']} fps"
            for k, v in story["formats"].items()],
          "", "## Suggested post (X / social)", "", "```", post, "```", f"Length: {len(post)} characters.", "",
          "## Key statistics", "", *[f"- {x}" for x in stats], "",
          "## Sources", "",
          f"- {src['attribution']} {src['doi']} (retrieved {src['retrieved']}; licence: {src['licence']}).",
          f"- {reg['naturalearth_admin1']['attribution']}",
          *[f"- {x['text']} — {x['source']}" + (f" {x['source_url']}" if x.get('source_url') else "")
            for x in story["annotations"]],
          "", "## Methodology", "",
          *[f"- {n}" for n in src["methodology_notes"]],
          "- Prism height is proportional to population (55 km per million people). Colour is the percentage change from "
          "July 1971; NT and NU use July 1991 as their base because no separate earlier figures exist.",
          "- Numbers on screen are always the most recent published quarter. Prism heights animate between quarters; "
          "the animation shows no values that Statistics Canada did not publish.",
          "- Milestones (25M, 30M, …) are derived: the first quarterly estimate at or above the threshold.",
          "- Every province and territory sums exactly to the Canada total in every quarter (checked by automated tests).",
          "", "## Context", "",
          "- This story shows only where population changed. It does not show why. The components of growth "
          "(births, deaths, immigration, emigration, interprovincial migration) are in Tables 17-10-0008, 17-10-0040 "
          "and 17-10-0020. They are the planned next layer, so the drivers can be shown directly, not inferred.",
          "", "## Limitations", "", *[f"- {x}" for x in src["limitations"]],
          *[f"- {x}" for x in reg["naturalearth_admin1"]["limitations"]], ""]
    (out / "README.md").write_text("\n".join(md))
    (out / "post.txt").write_text(post + "\n")

    with (out / "data_july1.csv").open("w", newline="") as f:
        w = csv.writer(f)
        cols = ["CAN"] + [k for k in NAMES if k != "CAN"] + ["NT+NU"]
        w.writerow(["ref_date"] + cols)
        for d in sorted(by):
            if s <= d <= e and d[5:] == "07-01":
                w.writerow([d] + [by[d].get(k, "") for k in cols])
    print("\n".join(stats))
    print(f"\npackage -> {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
