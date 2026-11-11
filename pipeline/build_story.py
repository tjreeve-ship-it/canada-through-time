"""Generate every text output of a story from its claims ledger.

  python3 pipeline/build_story.py stories/population-provinces-1971-2026

Writes
  web/stories/<id>.ledger.json            all on-screen text for the video renderer (web/v2)
  stories/<id>/release/x_post.txt          social post
  stories/<id>/release/README.md           key statistics, sources, methodology, limitations, revision status
  stories/<id>/release/explorer_links.md   deep links into the explorer
  stories/<id>/release/claims.csv          every claim value with its computation and revision status
  stories/<id>/release/data_july1.csv      supporting data: July 1 population by province/territory

Nothing here is typed by hand: wording comes from the ledger, numbers are recomputed.
Run pipeline/check_ledger.py afterwards.
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ledger as LG  # noqa: E402
from common import ROOT, load_registry  # noqa: E402


def source_entry(L, sid, reg):
    s = reg.get(sid) or L["external_sources"][sid]
    return s


def build(story_dir: Path) -> None:
    L = LG.load(story_dir)
    reg = load_registry()["sources"]
    st = L["story"]
    rel = story_dir / "release"
    rel.mkdir(exist_ok=True)
    C = LG.claims_by_id(L)

    # ---- recompute and refuse to build from a stale ledger
    for c in L["claims"]:
        for v in c["values"]:
            if v["compute"]["fn"] == "external":
                continue
            got = LG.compute(v["compute"])
            disp = v["display"] if v["format"] == "name" else LG.fmt(got, v["format"])
            if disp != v["display"]:
                sys.exit(f"ledger stale: {c['id']}.{v['id']} now displays {disp!r}, ledger says {v['display']!r}. Update the ledger and re-check.")

    # ---- renderer text
    vid = L["outputs"]["video"]
    render = {
        "_generated_from": f"stories/{st['id']}/ledger.yaml (do not edit; run pipeline/build_story.py)",
        "kicker": st["kicker"], "headline": st["headline"], "start": st["period"]["start"], "end": st["period"]["end"],
        "events": LG.events(L), "end_card": LG.end_card(L), "legend": vid["legend"], "card_seconds": vid["card_seconds"],
        "source_note": " ".join(vid["source_note"].split()),
        "prelim_from": next(c["from"] for c in L["revision_status"]["classes"] if "preliminary" in c["label"]),
    }
    (ROOT / "web/stories" / f"{st['id']}.ledger.json").write_text(json.dumps(render, indent=1, ensure_ascii=False) + "\n")

    # ---- social post
    (rel / "x_post.txt").write_text(LG.x_post(L))

    # ---- explorer links
    links = LG.explorer_links(L)
    (rel / "explorer_links.md").write_text("# Explorer links\n\n" + "\n".join(f"- {x['label']}: {x['url']}" for x in links.values()) + "\n")

    # ---- claims table
    with (rel / "claims.csv").open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["claim", "level", "value", "display", "exact", "unit", "geography", "period_start", "period_end", "computation",
                    "revision_status", "sources"])
        for c in L["claims"]:
            for v in c["values"]:
                ext = v["compute"]["fn"] == "external"
                got = None if ext else LG.compute(v["compute"])
                dates = [got] if v["compute"]["fn"].startswith("first_date") else LG.spec_dates(v["compute"])
                status = "external source" if ext else "; ".join(sorted({LG.revision_label(L, d) for d in dates}))
                geo = c["geography"] if isinstance(c["geography"], str) else "+".join(c["geography"])
                w.writerow([c["id"], c["level"], v["id"], v["display"], "" if ext else got, c["unit"], geo,
                            c["period"]["start"], c["period"]["end"], json.dumps(v["compute"]), status, " ".join(c["sources"])])

    # ---- supporting data
    P = LG.population()
    july = [d for d in sorted(P) if d.endswith("-07-01") and st["period"]["start"] <= d <= st["period"]["end"]]
    geos = ["CAN", "NL", "PE", "NS", "NB", "QC", "ON", "MB", "SK", "AB", "BC", "YT", "NT", "NU", "NT+NU"]
    with (rel / "data_july1.csv").open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["ref_date", *geos, "revision_status"])
        for d in july:
            w.writerow([d, *[P[d].get(g, "") for g in geos], LG.revision_label(L, d)])

    # ---- package README
    src = reg["statcan_17100009"]
    out = [f"# {st['title']}", "", f"**{st['headline']}**", "", f"_{st['scope_statement']}_", "",
           f"Period: July 1, {st['period']['start'][:4]} to July 1, {st['period']['end'][:4]} · Geography: {st['geography']}", "",
           "## Key statistics", "",
           "Every figure is recomputed from the source table by `pipeline/check_ledger.py`. Evidence level for all: **observation** "
           "(a measured value or a change computed directly from it).", ""]
    for cid in ("canada_growth", "fastest_provinces", "yukon_growth", "slowest_province", "ontario_gain", "atlantic_share",
                "west_share", "nunavut_growth"):
        out.append(f"- {LG.strip_markup(C[cid]['wording']['package'])}")
    out += ["", "## Timeline events shown in the video", ""]
    for e in LG.events(L):
        out.append(f"- **{e['display_date']}** — {LG.strip_markup(C[e['claim']]['wording']['package'])} _[{e['tag']}; {e['source']}]_")
    out += ["", "## Revision status", "",
            "Statistics Canada revises these estimates. Status by reference date (table note 3):", ""]
    for c in L["revision_status"]["classes"]:
        to = f"to {LG.fmt(c['to'], 'date_long')}" if c["to"] else "onward"
        out.append(f"- {LG.fmt(c['from'], 'date_long')} {to}: {c['label']}")
    out += ["", f"The end point of this story (July 1, {st['period']['end'][:4]}) is **preliminary**; every change to "
            f"{st['period']['end'][:4]} will move when it is revised. Per-value status is in `claims.csv`.", "",
            "## Caveats and limitations", ""]
    out += [f"- {k['text']}" for k in L["caveats"]]
    out += [f"- {x}" for x in src.get("limitations", [])]
    out += ["", "## Methodology", ""]
    seen = set()
    for c in L["claims"]:
        if c["method"] not in seen:
            seen.add(c["method"])
            out.append(f"- `{c['id']}`: {c['method']}")
    out += ["- Video: spike height is population on each quarterly reference date; spike colour is the change since July 1971 "
            "(since July 1991 for the Northwest Territories and Nunavut). Changes within ±2% are shown in the neutral colour. "
            "Between quarters the spike height is interpolated for smooth motion; every number on screen is the most recent published quarter.",
            "- Statistics Canada methodology notes for this table:"]
    out += [f"  - {x}" for x in src.get("methodology_notes", [])]
    out += ["", "## Sources", ""]
    for sid in L["sources"]:
        s = source_entry(L, sid, reg)
        url = s.get("landing_url") or s.get("url")
        bits = [f"**{s['title']}**", s["publisher"]]
        if s.get("table_id"):
            bits.append(f"Table {s['table_id']}")
        bits.append(url)
        if s.get("doi"):
            bits.append(s["doi"])
        bits += [f"retrieved {s['retrieved']}", f"licence: {s['licence']}"]
        out.append("- " + " · ".join(bits))
    out += ["", f"Attribution: {src['attribution']} Licence: {src['licence_url']}", "",
            "## Explore it yourself", ""] + [f"- [{x['label']}]({x['url']})" for x in links.values()]
    out += ["", "## Files in this package", "",
            "- `x_post.txt` — social post (generated from the ledger)",
            "- `explorer_links.md` — deep links",
            "- `claims.csv` — every claim value, its computation and revision status",
            "- `data_july1.csv` — July 1 population by province and territory (supporting data)",
            "- `check_report.md` — automated check result and the items that need human review",
            f"- Videos: `exports/{st['id']}/{st['id']}_16x9_1080p.mp4`, `{st['id']}_9x16_1920p.mp4`", "",
            "## Ledger", "", f"Generated from `stories/{st['id']}/ledger.yaml` (version {st['version']}, {st['ledger_date']}). "
            "Do not edit this file by hand; change the ledger and run `pipeline/build_story.py`.", ""]
    (rel / "README.md").write_text("\n".join(out))
    print(f"built {st['id']}: renderer text, x_post, README, explorer_links, claims.csv, data_july1.csv")


if __name__ == "__main__":
    d = Path(sys.argv[1])
    build(d if d.is_absolute() else ROOT / d)
