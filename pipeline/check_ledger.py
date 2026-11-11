"""Automated checker for a story's claims ledger and every output generated from it.

  python3 pipeline/check_ledger.py stories/population-provinces-1971-2026            # ledger + whatever outputs exist
  python3 pipeline/check_ledger.py stories/population-provinces-1971-2026 --strict   # also fail if an output is missing

What it VERIFIES (fails the run on any mismatch):
  * raw source file hash matches the registry (data were not silently modified)
  * required source fields (publisher, URL, retrieval date, licence) and claim fields (method, period, geography, unit, wording)
  * every value recomputed from data/processed: exact value, displayed rounding, date range, geography, formula
  * revision status of every value (StatCan table note 3); preliminary values carry the preliminary caveat
  * numbers inside each claim's text and approved wording match that claim's own computed displays
  * headline rules that are arithmetic ("nearly doubled", "led the provinces")
  * outputs (X post, package, explorer links, video frame logs): no number absent from the ledger, required caveats present,
    on-screen dynamic values match the data frame by frame, static on-screen text matches approved wording, card timing
  * causal wording is absent from observation claims and all outputs

What it does NOT verify — listed under "Needs human review" in every report:
  * interpretation, emphasis and framing; whether the wording is fair; any causal or explanatory reading
  * claims whose evidence lives outside the project data (e.g. the Nunavut Act in-force date)
  * visual legibility, attribution placement and mobile-safe layout (inspect the stills)
"""
from __future__ import annotations

import argparse
import json
import math
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ledger as LG  # noqa: E402
from common import ROOT, load_registry, verify_raw  # noqa: E402

REQ_CLAIM = ["id", "level", "text", "geography", "period", "unit", "sources", "values", "method", "wording"]
REQ_VALUE = ["id", "compute", "expected", "display", "format"]
REQ_SOURCE = {"publisher": ("publisher",), "url": ("landing_url", "url"), "retrieved": ("retrieved",), "licence": ("licence",)}
WORDING_KEYS = {"video", "short", "x", "package"}


class Report:
    def __init__(self):
        self.fail: list[str] = []
        self.ok: list[str] = []
        self.review: list[str] = []
        self.notes: list[str] = []

    def check(self, cond: bool, ok_msg: str, fail_msg: str | None = None):
        (self.ok if cond else self.fail).append(ok_msg if cond else (fail_msg or ok_msg))
        return cond


def close(a, b) -> bool:
    if isinstance(a, float) or isinstance(b, float):
        return math.isclose(float(a), float(b), rel_tol=0, abs_tol=5e-7)
    return a == b


# ------------------------------------------------------------------------------------------------ ledger
def check_ledger(L: dict, R: Report, reg: dict) -> None:
    st = L["story"]
    for k in ("id", "title", "headline", "period", "geography", "scope_statement"):
        R.check(bool(st.get(k)), f"story.{k} present", f"story.{k} missing")

    # sources
    ext = L.get("external_sources", {})
    for sid in L["sources"]:
        s = reg.get(sid) or ext.get(sid)
        if not R.check(s is not None, f"source {sid} found", f"source {sid} is not in registry/sources.yaml or external_sources"):
            continue
        for label, keys in REQ_SOURCE.items():
            R.check(any(s.get(k) for k in keys), f"source {sid}: {label} present", f"source {sid}: missing {label}")
        if sid in reg and reg[sid].get("raw_file"):
            try:
                verify_raw(reg[sid]["raw_file"], reg[sid]["sha256"])
                R.ok.append(f"source {sid}: raw file SHA-256 matches registry")
            except Exception as e:  # noqa: BLE001
                R.fail.append(f"source {sid}: raw file check failed: {e}")

    # revision classes must match StatCan's own note
    note = " ".join(reg[L["revision_status"]["source"]].get("methodology_notes", []))
    for c in L["revision_status"]["classes"]:
        for d in (c["from"], c["to"]):
            if d:
                long_, short_ = LG.fmt(d, "date_long"), LG.fmt(d, "date_long").replace(LG.fmt(d, "date_long").split()[0], LG.fmt(d, "date_long").split()[0][:3])
                R.check(long_ in note or short_ in note, f"revision boundary {d} found in StatCan table note",
                        f"revision boundary {d} ({LG.fmt(d, 'date_long')}) not found in registry methodology notes")

    caveat_ids = {k["id"] for k in L["caveats"]}
    for k in L["caveats"]:
        R.check(k["match"].lower() in k["text"].lower(), f"caveat {k['id']}: match phrase is in its text",
                f"caveat {k['id']}: match phrase {k['match']!r} not in its own text")

    ids = [c["id"] for c in L["claims"]]
    R.check(len(ids) == len(set(ids)), "claim ids unique", "duplicate claim ids")
    for c in L["claims"]:
        cid = c.get("id", "?")
        missing = [k for k in REQ_CLAIM if not c.get(k)]
        R.check(not missing, f"{cid}: required fields present", f"{cid}: missing fields {missing}")
        if missing:
            continue
        R.check(c["level"] in LG.LEVELS, f"{cid}: evidence level '{c['level']}'", f"{cid}: unknown evidence level {c['level']!r}")
        if c["level"] != "observation":
            R.review.append(f"{cid}: evidence level '{c['level']}' — interpretation must be reviewed by a person")
        for s in c["sources"]:
            R.check(s in L["sources"], f"{cid}: source {s} declared", f"{cid}: source {s} not declared in ledger sources")
        bad = set(c["wording"]) - WORDING_KEYS
        R.check(not bad and "package" in c["wording"], f"{cid}: wording keys valid",
                f"{cid}: wording keys invalid {sorted(bad)} or missing 'package'")
        for k in c.get("caveats", []):
            R.check(k in caveat_ids, f"{cid}: caveat {k} defined", f"{cid}: caveat {k} not defined")
        check_values(c, L, R)
        check_claim_text(c, R)

    check_headline(L, R)


def check_values(c: dict, L: dict, R: Report) -> None:
    cid = c["id"]
    p0, p1 = c["period"]["start"], c["period"]["end"]
    geo = c["geography"] if isinstance(c["geography"], list) else [c["geography"]]
    for v in c["values"]:
        vid = f"{cid}.{v.get('id', '?')}"
        miss = [k for k in REQ_VALUE if k not in v]
        if not R.check(not miss, f"{vid}: fields present", f"{vid}: missing {miss}"):
            continue
        spec = v["compute"]
        if spec["fn"] == "external":
            R.review.append(f"{vid}: '{v['display']}' comes from {', '.join(c['sources'])} and cannot be recomputed from project data. "
                            + c.get("human_review", "Confirm against the cited source."))
            continue
        try:
            got = LG.compute(spec)
        except LG.ComputeError as e:
            R.fail.append(f"{vid}: cannot compute ({e})")
            continue
        R.check(close(got, v["expected"]), f"{vid}: value {got!r} = expected", f"{vid}: VALUE MISMATCH computed {got!r} ≠ ledger {v['expected']!r}")
        disp = LG.fmt(got, v["format"]) if v["format"] != "name" else None
        if v["format"] == "name":
            R.check(LG.names_match(v["display"], got), f"{vid}: display '{v['display']}' names {got}",
                    f"{vid}: display {v['display']!r} does not name {got}")
        else:
            R.check(disp == v["display"], f"{vid}: display '{disp}'", f"{vid}: DISPLAY MISMATCH formatted {disp!r} ≠ ledger {v['display']!r}")
        # date range
        for d in ([] if spec["fn"].startswith("first_date") else LG.spec_dates(spec)):
            R.check(p0 <= d <= p1, f"{vid}: date {d} within claim period", f"{vid}: DATE {d} outside claim period {p0}–{p1}")
        if spec["fn"] in ("abs_change", "pct_change", "rank_pct_change", "rank_abs_change"):
            R.check((spec["from"], spec["to"]) == (p0, p1), f"{vid}: change measured over the claim period",
                    f"{vid}: FORMULA change measured {spec['from']}→{spec['to']} but claim period is {p0}→{p1}")
        if spec["fn"] in ("first_date_at_or_above", "first_date_nonnull"):
            R.check(got == p0 == p1, f"{vid}: derived date equals claim period", f"{vid}: DATE derived {got} ≠ claim period {p0}")
        # geography
        g = LG.spec_geos(spec)
        R.check(set(g) <= set(geo) or spec["fn"].startswith("rank"), f"{vid}: geography {g} ⊆ claim geography",
                f"{vid}: GEOGRAPHY {g} not within claim geography {geo}")
        if spec["fn"].startswith("rank"):
            R.check(got in geo, f"{vid}: ranked result {got} in claim geography", f"{vid}: GEOGRAPHY ranked result {got} not in claim geography {geo}")
        # revision status
        labels = {LG.revision_label(L, d) for d in ([got] if spec["fn"].startswith("first_date") else LG.spec_dates(spec))}
        v["_status"] = "; ".join(sorted(labels))
        if any("preliminary" in x for x in labels):
            R.check(L["revision_status"]["needs_caveat"] in c.get("caveats", []), f"{vid}: preliminary value carries caveat",
                    f"{vid}: PRELIMINARY value without the '{L['revision_status']['needs_caveat']}' caveat")
    if c["period"]["end"] >= "2026-07-01" and any(v["compute"]["fn"] != "external" for v in c["values"]):
        pass


def check_claim_text(c: dict, R: Report) -> None:
    cid = c["id"]
    own = {LG.norm(t) for v in c["values"] for t in LG.number_tokens(v["display"])}
    own |= {c["period"]["start"][:4], c["period"]["end"][:4]}
    for v in c["values"]:  # a threshold is part of the formula, so it may be stated
        if "threshold" in v["compute"]:
            th = v["compute"]["threshold"]
            own |= {LG.norm(f"{th:,}"), LG.js_fixed(th / 1e6, 0).rstrip("0").rstrip(".") if th % 1e6 else str(int(th / 1e6))}
    own |= {LG.norm(t) for v in c["values"] if v["format"] in ("month_year", "date_long") for t in LG.number_tokens(v["display"])}
    if "event" in c:
        own |= {c["event"]["date"][:4]}
    texts = {"text": c["text"], **{f"wording.{k}": LG.strip_markup(w) for k, w in c["wording"].items()}}
    for where, t in texts.items():
        stray = [x for x in LG.number_tokens(t) if LG.norm(x) not in own and not re.fullmatch(r"\d", LG.norm(x))]
        # day-of-month in long dates ("July 1, 1971") is part of the date display
        stray = [x for x in stray if not re.fullmatch(r"\d{1,2}", LG.norm(x)) or not re.search(rf"[A-Z][a-z]+ {LG.norm(x)}, \d{{4}}", t)]
        R.check(not stray, f"{cid}.{where}: every number traces to its values", f"{cid}.{where}: number(s) {stray} not among this claim's computed values")
        if c["level"] == "observation":
            m = LG.CAUSAL.search(t)
            R.check(not m, f"{cid}.{where}: no causal wording", f"{cid}.{where}: CAUSAL wording '{m.group(0) if m else ''}' in an observation claim")


def check_headline(L: dict, R: Report) -> None:
    try:
        _check_headline(L, R)
    except LG.ComputeError as e:
        R.fail.append(f"headline rules cannot be evaluated: {e}")


def _check_headline(L: dict, R: Report) -> None:
    h = L["story"]["headline"]
    m = LG.CAUSAL.search(h)
    R.check(not m, "headline: no causal wording", f"headline: CAUSAL wording '{m.group(0) if m else ''}'")
    if "nearly doubled" in h:
        p = LG.compute(LG.value(L, "canada_growth", "pct")["compute"])
        R.check(0.80 <= p < 1.0, f"headline 'nearly doubled': growth {p:.3%} in [80%, 100%)", f"headline 'nearly doubled' FAILS: growth {p:.3%}")
    if "led the provinces" in h:
        a = LG.compute(LG.value(L, "fastest_provinces", "first")["compute"])
        b = LG.compute(LG.value(L, "fastest_provinces", "second")["compute"])
        named = all(LG.SHORT[x] in h or LG.NAMES[x] in h for x in (a, b))
        R.check(named, f"headline 'led the provinces': top two are {a}, {b} and both are named",
                f"headline 'led the provinces' FAILS: top two provinces are {a}, {b}")
    R.review.append(f"headline wording and emphasis: “{h}” (arithmetic verified; framing is a human call)")
    R.review.append(f"scope statement: “{L['story']['scope_statement']}”")


# ------------------------------------------------------------------------------------------------ outputs
def required_caveats(L: dict, output: str) -> list[dict]:
    return [k for k in L["caveats"] if output in k["required_in"]]


def check_text_output(name: str, kind: str, text: str, L: dict, R: Report, allowed: set[str]) -> None:
    stray = sorted({x for x in LG.number_tokens(text) if LG.norm(x) not in allowed})
    R.check(not stray, f"{name}: every number is in the ledger", f"{name}: number(s) not in the ledger: {stray}")
    for k in required_caveats(L, kind):
        R.check(k["match"].lower() in text.lower(), f"{name}: caveat '{k['id']}' present", f"{name}: CAVEAT '{k['id']}' missing (needs “{k['match']}”)")
    for line in text.splitlines():
        if line.lstrip().startswith(("|", "#")) and "Method" in line:
            continue
        m = LG.CAUSAL.search(line)
        if m and "causal" not in line.lower() and "cause" not in line.lower().split(m.group(0).lower())[0][-40:]:
            R.fail.append(f"{name}: CAUSAL wording '{m.group(0)}' in: {line.strip()[:100]}")
    urls = set(re.findall(r"https?://[^\s)>\]]+", text))
    known = {x["url"] for x in LG.explorer_links(L).values()}
    reg = load_registry()["sources"]
    for sid in L["sources"]:
        s = reg.get(sid) or L["external_sources"].get(sid, {})
        known |= {str(s.get(k)) for k in ("landing_url", "url", "doi", "download_url", "licence_url") if s.get(k)}
    known |= {"https://www.statcan.gc.ca/en/reference/licence", "https://www.naturalearthdata.com/"}
    unknown = sorted(u.rstrip(".,") for u in urls if u.rstrip(".,") not in known)
    R.check(not unknown, f"{name}: every link is a ledger/registry link", f"{name}: unknown link(s) {unknown}")


def x_length(text: str) -> int:
    return len(re.sub(r"https?://\S+", "x" * 23, text.strip()))


def check_video(path: Path, kind: str, L: dict, R: Report, allowed: set[str]) -> None:
    log = json.loads(path.read_text())
    name = path.name
    P = LG.population()
    prelim_from = next(c["from"] for c in L["revision_status"]["classes"] if "preliminary" in c["label"])
    start = L["story"]["period"]["start"]
    base = {}
    for d in sorted(P):
        if d >= start:
            for k, v in P[d].items():
                base.setdefault(k, v)
    ec = LG.end_card(L)
    evs = {e["text"]: e for e in LG.events(L)}
    leg = L["outputs"]["video"]["legend"]
    expect_static = {"kicker": L["story"]["kicker"], "headline": L["story"]["headline"],
                     "source": " ".join(L["outputs"]["video"]["source_note"].split()), "leg-height": leg["height"],
                     "share-title": leg["share_title"]}
    dyn_ids = {"year", "total", "total-chg", "asof", "share-y1", "share-labels"}
    mism: dict[str, int] = {}
    first_bad: dict[str, str] = {}
    seen_all = []
    card_frames: dict[str, list[int]] = {}

    def bad(key, msg):
        mism[key] = mism.get(key, 0) + 1
        first_bad.setdefault(key, msg)

    for fr in log:
        dom, obs = fr["dom"], fr["obs"]
        vals = P[obs]
        seen_all.append(" ".join(dom.values()))
        for k, exp in expect_static.items():
            if " ".join(dom.get(k, "").split()) != exp:
                bad(f"static:{k}", f"frame {fr['frame']}: {k} = {dom.get(k)!r}, ledger = {exp!r}")
        if dom.get("year") != obs[:4]:
            bad("year", f"frame {fr['frame']}: year {dom.get('year')} ≠ {obs[:4]}")
        if dom.get("total") != f"{vals['CAN']:,}":
            bad("total", f"frame {fr['frame']}: total {dom.get('total')} ≠ {vals['CAN']:,}")
        dc = vals["CAN"] - base["CAN"]
        exp_chg = "people" if obs == start else f"{'+' if dc >= 0 else '−'}{LG.js_fixed(abs(dc) / 1e6, 1)} million since {start[:4]} ({LG.fmt(vals['CAN'] / base['CAN'] - 1, 'pct0')})"
        if dom.get("total-chg") != exp_chg:
            bad("total-chg", f"frame {fr['frame']}: {dom.get('total-chg')!r} ≠ {exp_chg!r}")
        exp_asof = f"Statistics Canada estimate, {LG.fmt(obs, 'date_long')}" + (" (preliminary)" if obs >= prelim_from else "")
        if dom.get("asof") != exp_asof:
            bad("asof", f"frame {fr['frame']}: {dom.get('asof')!r} ≠ {exp_asof!r}")
        for k, lab in {**fr["spikes"], **fr["callouts"]}.items():
            want = LG.sig3(vals[k])
            if lab.split()[-1] != want:
                bad("spike", f"frame {fr['frame']}: {k} label {lab!r} ≠ {want}")
        regions = fr["share"]
        for key, (members, shown) in regions.items():
            s = sum(vals[m] for m in members if m in vals and not (m in ("NT", "NU") and "NT+NU" in vals and obs < "1991-07-01")) / vals["CAN"]
            if shown is not None and shown != LG.js_fixed(s * 100, 1) + "%":
                bad("share", f"frame {fr['frame']}: share {key} {shown} ≠ {LG.js_fixed(s * 100, 1)}%")
        if fr.get("card"):
            c = fr["card"]
            card_frames.setdefault(c["text"], []).append(fr["frame"])
            e = evs.get(c["text"])
            if not e:
                bad("card", f"frame {fr['frame']}: card text {c['text']!r} not an approved event wording")
            elif (c["tag"], c["date"], c["src"]) != (e["tag"], e["display_date"], e["source"]):
                bad("card", f"frame {fr['frame']}: card fields {c} ≠ ledger {e}")
        if fr.get("end"):
            want = [ec["title"]] + [x for it in ec["items"] for x in (it["big"], LG.strip_markup(it["text"]))] + [ec["footer"]]
            got = " ".join(dom.get("end", "").split())
            for w in want:
                if " ".join(w.split()) not in got:
                    bad("end", f"frame {fr['frame']}: end card missing {w!r}")
        # number sweep over non-dynamic visible text
        for k, t in dom.items():
            if k in dyn_ids:
                continue
            stray = [x for x in LG.number_tokens(t) if LG.norm(x) not in allowed]
            if stray:
                bad("numbers", f"frame {fr['frame']}: #{k} shows number(s) {stray} not in the ledger")
            m = LG.CAUSAL.search(t)
            if m:
                bad("causal", f"frame {fr['frame']}: #{k} causal wording '{m.group(0)}'")

    for key, n in mism.items():
        R.fail.append(f"{name}: {key} mismatch in {n} frame(s); first: {first_bad[key]}")
    R.check(not mism, f"{name}: {len(log)} frames — static text, totals, dates, spike labels, shares, cards and end card all match ledger and data")
    alltext = " ".join(seen_all).lower()
    for k in required_caveats(L, kind):
        R.check(k["match"].lower() in alltext, f"{name}: caveat '{k['id']}' on screen", f"{name}: CAVEAT '{k['id']}' never shown")
    fps = 30
    mins = L["outputs"]["video"]["card_seconds"]["minimum"]
    for e in LG.events(L):
        fr = card_frames.get(e["text"], [])
        secs = len(fr) / fps
        R.check(secs >= mins - 1e-9, f"{name}: card “{e['text']}” on screen {secs:.1f}s", f"{name}: CARD “{e['text']}” on screen only {secs:.1f}s (minimum {mins}s)")
    R.notes.append(f"{name}: {len(log)} frames checked; event cards " + ", ".join(f"{e['display_date']} {len(card_frames.get(e['text'], [])) / fps:.1f}s" for e in LG.events(L)))


def check_outputs(story_dir: Path, L: dict, R: Report, strict: bool) -> None:
    allowed = LG.allowed_numbers(L)
    rel = story_dir / "release"
    files = {"x_post.txt": "x_post", "README.md": "package", "explorer_links.md": "links"}
    for fn, kind in files.items():
        p = rel / fn
        if not p.exists():
            (R.fail if strict else R.notes).append(f"output {fn} not generated yet")
            continue
        text = p.read_text()
        check_text_output(f"release/{fn}", kind, text, L, R, allowed)
        if kind == "x_post":
            n = x_length(text)
            R.check(n <= 280, f"x_post: {n}/280 characters (links count 23)", f"x_post: {n} characters, over 280")
            R.check(text == LG.x_post(L), "x_post: identical to ledger template", "x_post: differs from the ledger template (edited by hand?)")
    vids = sorted((ROOT / "exports" / L["story"]["id"]).glob(f"{L['story']['id']}_*.frames.json"))
    for fmt_kind in ("16x9", "9x16"):
        hits = [v for v in vids if f"_{fmt_kind}_" in v.name]
        if not hits:
            (R.fail if strict else R.notes).append(f"video {fmt_kind}: no frame log yet (render first)")
        for v in hits:
            check_video(v, f"video_{fmt_kind}", L, R, allowed)


# ------------------------------------------------------------------------------------------------ report
def write_report(story_dir: Path, L: dict, R: Report) -> Path:
    rel = story_dir / "release"
    rel.mkdir(exist_ok=True)
    status = "PASS" if not R.fail else "FAIL"
    lines = [f"# Ledger check — {L['story']['title']}", "", f"**Result: {status}** · {len(R.ok)} checks passed · "
             f"{len(R.fail)} failed · {len(R.review)} items need human review", ""]
    if R.fail:
        lines += ["## Failures", ""] + [f"- ✗ {x}" for x in R.fail] + [""]
    lines += ["## Needs human review (not machine-verifiable)", ""] + [f"- {x}" for x in R.review] + [
        "- Legibility, attribution placement and mobile-safe layout of the rendered frames (inspect stills).", ""]
    if R.notes:
        lines += ["## Notes", ""] + [f"- {x}" for x in R.notes] + [""]
    lines += ["## Values recomputed", "", "| Claim | Value | Computed | Display | Revision status |", "|---|---|---|---|---|"]
    for c in L["claims"]:
        for v in c["values"]:
            if v["compute"]["fn"] == "external":
                lines.append(f"| {c['id']} | {v['id']} | (external source) | {v['display']} | — |")
                continue
            try:
                got = LG.compute(v["compute"])
            except LG.ComputeError as e:
                got = f"ERROR: {e}"
            gs = f"{got:.6f}" if isinstance(got, float) else str(got)
            lines.append(f"| {c['id']} | {v['id']} | {gs} | {v['display']} | {v.get('_status', '')} |")
    lines += ["", f"<details><summary>All {len(R.ok)} passing checks</summary>", ""] + [f"- ✓ {x}" for x in R.ok] + ["", "</details>", ""]
    p = rel / "check_report.md"
    p.write_text("\n".join(lines))
    (rel / "check_report.json").write_text(json.dumps({"status": status, "failures": R.fail, "human_review": R.review,
                                                       "notes": R.notes, "passed": len(R.ok)}, indent=2, ensure_ascii=False))
    return p


def run(story_dir: Path, strict: bool = False) -> Report:
    L = LG.load(story_dir)
    R = Report()
    reg = load_registry()["sources"]
    check_ledger(L, R, reg)
    check_outputs(story_dir, L, R, strict)
    write_report(story_dir, L, R)
    return R


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("story_dir")
    ap.add_argument("--strict", action="store_true", help="fail if any output (post, package, links, either video log) is missing")
    a = ap.parse_args()
    d = Path(a.story_dir)
    d = d if d.is_absolute() else ROOT / d
    R = run(d, a.strict)
    print(f"{'PASS' if not R.fail else 'FAIL'}: {len(R.ok)} passed, {len(R.fail)} failed, {len(R.review)} for human review")
    for x in R.fail:
        print("  ✗", x)
    for x in R.notes:
        print("  ·", x)
    print(f"report: {(d / 'release/check_report.md').relative_to(ROOT)}")
    sys.exit(1 if R.fail else 0)


if __name__ == "__main__":
    main()
