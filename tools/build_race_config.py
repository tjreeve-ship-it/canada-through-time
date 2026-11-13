"""Write timelapses/short-whos-number-one.json (Short #6) from computed IRCC figures. Every story number is computed here
from web/data/explorer/pr_citizenship.json; the asserts stop the build if the data no longer supports the wording."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
D = json.loads((ROOT / "web/data/explorer/pr_citizenship.json").read_text())
Y0, Y1 = 2007, D["partial_year"] - 1          # full calendar years only
YRS = list(range(Y0, Y1 + 1))
EXCL = ["Country not stated"]
C = {k: v for k, v in D["countries"].items() if k not in EXCL}
val = lambda c, y: C[c].get(str(y))
def ranked(y): return sorted((c for c in C if val(c, y) is not None), key=lambda c: (-val(c, y), c))
lead = {y: ranked(y)[0] for y in YRS}
IN, PH, CN = "India", "Philippines", "China, People's Republic of"

# 1. 2007-2016: the lead changed hands between three countries
early = [y for y in YRS if y <= 2016]
changes = sum(lead[a] != lead[b] for a, b in zip(early, early[1:]))
assert set(lead[y] for y in early) == {IN, PH, CN}, {y: lead[y] for y in early}
# 2. India #1 every full year from 2017
assert all(lead[y] == IN for y in range(2017, Y1 + 1)), lead
# 3. the peak
peak = max(range(2017, Y1 + 1), key=lambda y: val(IN, y))
second = ranked(peak)[1]
ratio = val(IN, peak) / val(second, peak)
# 4. latest full year share of all admissions (published total)
share = val(IN, Y1) / D["total"][str(Y1)] * 100
print(f"lead changes 2007-2016: {changes}; peak {peak}: India {val(IN, peak):,} vs {second} {val(second, peak):,} ({ratio:.2f}x); {Y1} share {share:.1f}%")
assert changes == 4 and peak == 2023 and round(ratio, 1) == 4.4

idx = lambda y: YRS.index(y)
words = {3: "Three", 4: "Four", 5: "Five", 6: "Six"}
cfg = dict(
    id="short-whos-number-one", format="9x16", fps=30, title="Where Canada's new permanent residents come from", years=[Y0, Y1], top=8, exclude=EXCL,
    kicker="New permanent residents · by country of citizenship",
    hook=dict(seconds=3.2, question="Where do most of Canada’s <em>new permanent residents</em> come from?"),
    colors={IN: "#B8472F", PH: "#3F6E8C", CN: "#C9962E"}, otherColor="#ABA592", short={CN: "China", "United States of America": "United States", "United Kingdom and Overseas Territories": "United Kingdom", "Korea, Republic of": "South Korea"},
    plan=[
        dict(kind="run", to=1.4, s=3.2, ease="linear"),
        dict(kind="run", to=idx(2016), s=8.6, ease="linear"),
        dict(kind="beat", s=2.6, kicker=f"{Y0}–2016", big=f"{changes}×", line=f"the #1 spot changed hands between <em>China</em>, <em>India</em> and the <em>Philippines</em>", focus=[IN, PH, CN], cardTop=740),
        dict(kind="run", to=idx(peak), s=7.2, ease="inout", riser=True),
        dict(kind="beat", s=3.2, kicker=f"{peak} · the peak", big=f"{val(IN, peak):,}", line=f"from <em>India</em>: {ratio:.1f}× the next country ({'China' if second == CN else second}, {val(second, peak):,})", focus=[IN], sfx="hit", cardTop=560),
        dict(kind="run", to=idx(Y1), s=2.0, ease="out"),
        dict(kind="summary", s=4.6),
        dict(kind="loop", s=0.8),
    ],
    summary=dict(country=IN, chartCaption=f"New permanent residents from India, {Y0}–{Y1}", kicker=f"{Y1}", big=f"{share:.0f}%", line=f"of Canada’s new permanent residents were citizens of <em>India</em>",
                 sub=f"#1 every year since 2017. Source: IRCC open data."),
    note=f"<b>Source:</b> IRCC open data, permanent resident admissions by country of citizenship, {Y0}–{Y1} ({Y0}–2014 from IRCC Facts and Figures 2016). From 2015 IRCC rounds to the nearest 5. Bars glide between years as animation; every number shown is a published value.",
    sources=["ircc_pr_citizenship", "ircc_facts_2016_source_country"],
    method="Numbers on screen are IRCC's published calendar-year admissions for the year shown. Bar lengths and positions move between consecutive years as animation only. Ranks use published values; suppressed values (0-5) are treated as not published, never zero. The share is India's admissions divided by IRCC's published total for the year.",
    figures=dict(lead_changes_2007_2016=changes, leaders={str(y): lead[y] for y in YRS}, peak_year=peak, peak_india=val(IN, peak), peak_second=[second, val(second, peak)],
                 ratio=round(ratio, 2), latest_year=Y1, latest_share_pct=round(share, 2), latest_india=val(IN, Y1), latest_total=D["total"][str(Y1)]),
)
dst = ROOT / "timelapses/short-whos-number-one.json"
dst.write_text(json.dumps(cfg, indent=1, ensure_ascii=False))
print(dst.relative_to(ROOT))
