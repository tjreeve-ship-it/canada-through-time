"""Claims ledger: load, recompute and resolve approved wording.

The ledger (stories/<id>/ledger.yaml) is the single source of truth for every claim in a story.
This module is shared by the checker (pipeline/check_ledger.py) and the story builder
(pipeline/build_story.py), so outputs and verification use the same arithmetic and formatting.
"""
from __future__ import annotations

import csv
import re
from collections import defaultdict
from functools import lru_cache
from pathlib import Path

import yaml

from common import ROOT, load_registry

LEVELS = ("observation", "association", "possible_reason", "proven_effect")
NAMES = {"NL": "Newfoundland and Labrador", "PE": "Prince Edward Island", "NS": "Nova Scotia", "NB": "New Brunswick",
         "QC": "Quebec", "ON": "Ontario", "MB": "Manitoba", "SK": "Saskatchewan", "AB": "Alberta",
         "BC": "British Columbia", "YT": "Yukon", "NT": "Northwest Territories", "NU": "Nunavut", "CAN": "Canada"}
SHORT = {**NAMES, "BC": "B.C.", "PE": "P.E.I."}
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
          "November", "December"]
# Words that assert a cause. Observation claims must never use them; the checker cannot verify causation.
CAUSAL = re.compile(r"\b(caus(e|ed|es|ing)|led to|lead(s|ing)? to|dr(o|i)ve[ns]?|driven by|driving|because|thanks to|"
                    r"due to|result(ed|s)? (in|from)|as a result|fuel(l)?ed|spurred|triggered|blame[sd]?|attract(ed|s)|"
                    r"pushed|pulled|forced|boom(ed)?|exodus|fled|flock(ed)?)\b", re.I)


# ---------------------------------------------------------------- data
@lru_cache(maxsize=None)
def population() -> dict[str, dict[str, int]]:
    by: dict[str, dict[str, int]] = defaultdict(dict)
    with (ROOT / "data/processed/population_quarterly.csv").open() as f:
        for r in csv.DictReader(f):
            if r["value"] != "":
                by[r["ref_date"]][r["geo_abbr"]] = int(r["value"])
    return dict(by)


class _Loader(yaml.SafeLoader):
    """YAML 1.1 reads ON / NO / YES as booleans; province codes like ON must stay strings."""


_Loader.yaml_implicit_resolvers = {k: [(t, r) for t, r in v if t != "tag:yaml.org,2002:bool"]
                                   for k, v in yaml.SafeLoader.yaml_implicit_resolvers.items()}
_Loader.add_implicit_resolver("tag:yaml.org,2002:bool", re.compile(r"^(?:true|false)$"), list("tf"))


def load(story_dir: Path) -> dict:
    return yaml.load((Path(story_dir) / "ledger.yaml").read_text(), Loader=_Loader)


# ---------------------------------------------------------------- computation
class ComputeError(Exception):
    pass


def _pop(geo: str, date: str) -> int:
    P = population()
    if date not in P or geo not in P[date]:
        raise ComputeError(f"no value for {geo} on {date}")
    return P[date][geo]


def compute(spec: dict):
    fn = spec["fn"]
    if fn == "pop":
        return _pop(spec["geo"], spec["date"])
    if fn == "abs_change":
        return _pop(spec["geo"], spec["to"]) - _pop(spec["geo"], spec["from"])
    if fn == "pct_change":
        return _pop(spec["geo"], spec["to"]) / _pop(spec["geo"], spec["from"]) - 1
    if fn == "share":
        return sum(_pop(g, spec["date"]) for g in spec["geos"]) / _pop("CAN", spec["date"])
    if fn in ("rank_pct_change", "rank_abs_change"):
        key = (lambda g: _pop(g, spec["to"]) / _pop(g, spec["from"]) - 1) if fn == "rank_pct_change" else \
              (lambda g: _pop(g, spec["to"]) - _pop(g, spec["from"]))
        ranked = sorted(spec["geos"], key=key, reverse=True)
        return ranked[spec["rank"] - 1]
    if fn == "first_date_at_or_above":
        for d in sorted(population()):
            if d >= spec.get("from", "") and population()[d].get(spec["geo"], -1) >= spec["threshold"]:
                return d
        raise ComputeError("threshold never reached")
    if fn == "first_date_nonnull":
        for d in sorted(population()):
            if spec["geo"] in population()[d]:
                return d
        raise ComputeError("no values")
    if fn == "external":
        return None
    raise ComputeError(f"unknown compute fn {fn!r}")


def spec_dates(spec: dict) -> list[str]:
    return [spec[k] for k in ("date", "from", "to") if k in spec]


def spec_geos(spec: dict) -> list[str]:
    return [spec["geo"]] if "geo" in spec else list(spec.get("geos", []))


# ---------------------------------------------------------------- formatting (mirrors web/v2/v2.js)
def js_fixed(x: float, d: int) -> str:
    return f"{x:.{d}f}"


def fmt(value, kind: str) -> str:
    if kind == "int":
        return f"{value:,}"
    if kind == "pct0":
        r = round(value * 100)
        return "0%" if r == 0 else ("+" if r > 0 else "−") + f"{abs(r)}%"
    if kind == "pct1":
        return js_fixed(value * 100, 1) + "%"
    if kind == "millions1":
        return js_fixed(abs(value) / 1e6, 1) + " million"
    if kind == "month_year":
        y, m, _ = value.split("-")
        return f"{MONTHS[int(m) - 1]} {y}"
    if kind == "date_long":
        y, m, d = value.split("-")
        return f"{MONTHS[int(m) - 1]} {int(d)}, {y}"
    if kind == "name":
        return value
    if kind == "sig3":
        return sig3(value)
    raise ValueError(kind)


def sig3(n: float) -> str:
    div, suf = (1e6, "M") if n >= 1e6 else (1e3, "K")
    v = n / div
    return js_fixed(v, 0 if v >= 100 else 1 if v >= 10 else 2) + suf


def names_match(display: str, code: str) -> bool:
    return display in (NAMES.get(code), SHORT.get(code), code)


# ---------------------------------------------------------------- resolution
def claims_by_id(L: dict) -> dict:
    return {c["id"]: c for c in L["claims"]}


def value(L: dict, claim_id: str, value_id: str) -> dict:
    for v in claims_by_id(L)[claim_id]["values"]:
        if v["id"] == value_id:
            return v
    raise KeyError(f"{claim_id}.{value_id}")


def wording(L: dict, claim_id: str, key: str) -> str:
    return claims_by_id(L)[claim_id]["wording"][key]


def strip_markup(s: str) -> str:
    return s.replace("**", "")


def revision_label(L: dict, date: str) -> str:
    for c in L["revision_status"]["classes"]:
        if date >= c["from"] and (c["to"] is None or date <= c["to"]):
            return c["label"]
    return "unclassified"


def explorer_links(L: dict) -> dict[str, dict]:
    e = L["outputs"]["explorer_links"]
    return {x["id"]: {**x, "url": f"{e['base']}#{x['hash']}"} for x in e["links"]}


def x_post(L: dict) -> str:
    t = L["outputs"]["x_post"]["template"]
    links = explorer_links(L)

    def sub(m):
        a, b = m.group(1), m.group(2)
        if a == "explorer":
            return links[b]["url"]
        return strip_markup(wording(L, a, b))
    return re.sub(r"\{([a-z0-9_]+)\.([a-z0-9_]+)\}", sub, t).strip() + "\n"


def end_card(L: dict) -> dict:
    ec = L["outputs"]["video"]["end_card"]
    items = []
    for it in ec["items"]:
        if "big" in it:
            big = value(L, it["big"]["claim"], it["big"]["value"])["display"]
        else:
            bp = it["big_pair"]
            big = value(L, bp["claim"], bp["from"])["display"].rstrip("%") + "→" + value(L, bp["claim"], bp["to"])["display"]
        parts = [wording(L, it["text"]["claim"], it["text"]["wording"])]
        if "extra" in it:
            parts.append(wording(L, it["extra"]["claim"], it["extra"]["wording"]))
        items.append({"big": big, "text": " ".join(parts)})
    return {"title": ec["title"], "items": items, "footer": ec["footer"]}


def events(L: dict) -> list[dict]:
    out = []
    for c in L["claims"]:
        if "event" in c:
            ev = c["event"]
            out.append({"claim": c["id"], "date": ev["date"], "tag": ev["tag"], "text": c["wording"]["short"],
                        "source": ev["source_line"], "display_date": fmt(ev["date"], "month_year")})
    return sorted(out, key=lambda e: e["date"])


def caveat(L: dict, cid: str) -> dict:
    return next(c for c in L["caveats"] if c["id"] == cid)


# ---------------------------------------------------------------- numeric tokens
NUM = re.compile(r"(?<![\w.])[+−\-±]?\d[\d,]*(?:\.\d+)?%?")


def number_tokens(text: str) -> list[str]:
    text = re.sub(r"https?://\S+", " ", text)
    return [t for t in NUM.findall(text)]


def norm(tok: str) -> str:
    return tok.lstrip("+−-±").rstrip("%").replace(",", "")


def allowed_numbers(L: dict, reg: dict | None = None) -> set[str]:
    """Every number an output may show: ledger displays, caveat/method text, periods, dates, source identifiers."""
    reg = reg or load_registry()["sources"]
    pool: list[str] = []
    st = L["story"]
    pool += [st["title"], st["headline"], st["period"]["start"], st["period"]["end"], st["scope_statement"]]
    for c in L["claims"]:
        pool += [c["text"], c["period"]["start"], c["period"]["end"], c.get("method", "")]
        pool += [v["display"] for v in c["values"]] + list(c["wording"].values())
        if "event" in c:
            pool += [c["event"]["source_line"], c["event"]["date"], fmt(c["event"]["date"], "month_year")]
    pool += [k["text"] for k in L["caveats"]]
    for cls in L["revision_status"]["classes"]:
        pool += [cls["from"], cls["to"] or ""]
    for sid in L["sources"]:
        s = reg.get(sid) or L.get("external_sources", {}).get(sid, {})
        pool += [str(s.get("table_id", "")), str(s.get("title", "")), str(s.get("retrieved", "")), str(s.get("version", ""))]
        pool += [str(s.get(k, "")) for k in ("attribution", "release_in_file", "note")] + list(s.get("methodology_notes", [])) + list(s.get("limitations", []))
    pool += [L["outputs"]["video"]["source_note"], L["outputs"]["video"]["end_card"]["title"]]
    pool += L["outputs"]["video"].get("legend", {}).get("ramp_labels", [])
    out = set()
    for p in pool:
        for t in number_tokens(str(p)):
            out.add(norm(t))
        out.update(re.findall(r"\d{4}", str(p)))  # years inside dates
    return out
