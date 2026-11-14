"""Write timelapses/short-lowest-unemployment.json (Short #10) from Statistics Canada Labour Force Survey annual rates
(web/data/more/lfs.json, table 14-10-0327-01). Every story number is computed here; the asserts stop the build if the
data no longer supports the wording. Ranking: lowest unemployment rate is #1; ties are shared, never broken."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
L = json.loads((ROOT / "web/data/more/lfs.json").read_text())
NAMES = {"NL": "Newfoundland and Labrador", "PE": "Prince Edward Island", "NS": "Nova Scotia", "NB": "New Brunswick", "QC": "Quebec",
         "ON": "Ontario", "MB": "Manitoba", "SK": "Saskatchewan", "AB": "Alberta", "BC": "British Columbia"}
Y0, Y1 = L["years"]
YRS = list(range(Y0, Y1 + 1))
ur = lambda p, y: L["data"][p][str(y)]["ur"]
for p in NAMES:
    for y in YRS: assert ur(p, y) is not None, (p, y)      # no gaps: nothing is treated as zero
lowest = {y: sorted(p for p in NAMES if ur(p, y) == min(ur(q, y) for q in NAMES)) for y in YRS}
highest = {y: [p for p in NAMES if ur(p, y) == max(ur(q, y) for q in NAMES)] for y in YRS}
def rank_high(p, y): return 1 + sum(ur(q, y) > ur(p, y) for q in NAMES)   # 1 = highest rate

ever = sorted({p for y in YRS for p in lowest[y]})
changes = sum(lowest[a] != lowest[b] for a, b in zip(YRS, YRS[1:]))
nl_all = all(highest[y] == ["NL"] for y in YRS)
qc_run = [y for y in YRS if lowest[y] == ["QC"]]
qc83, qc83_rank = ur("QC", 1983), rank_high("QC", 1983)
ab19, ab20, ab20_rank, ab19_rank = ur("AB", 2019), ur("AB", 2020), rank_high("AB", 2020), rank_high("AB", 2019)
years_at = {p: sum(p in lowest[y] for y in YRS) for p in ever}
print("ever lowest:", ever, "changes:", changes, "years at/sharing #1:", years_at)
print("QC alone lowest:", qc_run, "| QC 1983", qc83, "rank from top", qc83_rank, "| AB 2019", ab19, ab19_rank, "-> 2020", ab20, ab20_rank)
assert len(ever) == 6 and nl_all and qc_run == [2021, 2022, 2023, 2024] and qc83 == 14.2 and qc83_rank == 3 and ab20 == 11.4 and ab20_rank == 2

idx = lambda y: YRS.index(y)
N = {k: v for k, v in NAMES.items()}
cfg = dict(
    id="short-lowest-unemployment", format="9x16", fps=30, title="Which province has Canada's lowest unemployment rate?", years=[Y0, Y1], top=10, row=54,
    order="asc", valueFormat="pct1", noun="province",
    data=dict(kind="lfs", file="../data/more/lfs.json", field="ur", names=NAMES),
    kicker="Unemployment rate · 10 provinces · lowest ranked #1",
    hook=dict(seconds=3.2, question="Which province has had Canada’s <em>lowest</em> unemployment rate?"),
    colors={N["QC"]: "#3F6E8C", N["AB"]: "#C9962E", N["SK"]: "#5E7F3A", N["NL"]: "#B8472F"}, otherColor="#ABA592",
    short={N["NL"]: "Newfoundland", N["PE"]: "P.E.I.", N["BC"]: "B.C.", N["NS"]: "Nova Scotia", N["NB"]: "New Brunswick"},
    plan=[
        dict(kind="run", to=1.0, s=3.2, ease="linear"),
        dict(kind="run", to=idx(1983), s=4.6, ease="linear"),
        dict(kind="beat", s=2.8, kicker="1983", big=f"{qc83:.1f}%", line=f"<em>Quebec</em>: the {['', '', '2nd', '3rd', '4th'][qc83_rank]}-highest rate of the 10 provinces", focus=[N["QC"]], cardTop=450),
        dict(kind="run", to=idx(2019), s=9.0, ease="inout", riser=True),
        dict(kind="run", to=idx(2020), s=1.0, ease="out"),
        dict(kind="beat", s=2.8, kicker="2020", big=f"{ab20:.1f}%", line=f"<em>Alberta</em>: from {ab19:.1f}% the year before to the 2nd-highest rate in Canada", focus=[N["AB"]], sfx="hit", cardTop=450),
        dict(kind="run", to=idx(2024), s=3.0, ease="inout"),
        dict(kind="beat", s=2.8, kicker=f"{qc_run[0]}–{qc_run[-1]}", big=f"{len(qc_run)} years", line="in a row, <em>Quebec</em> had the lowest rate of any province", focus=[N["QC"]], cardTop=700),
        dict(kind="run", to=idx(Y1), s=1.2, ease="out"),
        dict(kind="summary", s=4.6),
        dict(kind="loop", s=0.8),
    ],
    summary=dict(country=N["QC"], chartCaption=f"Quebec’s unemployment rate, {Y0}–{Y1}", kicker=f"{Y0}–{Y1}", big=str(len(ever)),
                 line="different provinces have had Canada’s <em>lowest</em> unemployment rate",
                 sub=f"Newfoundland and Labrador had the highest rate in all {len(YRS)} years. Source: Statistics Canada."),
    note=f"<b>Source:</b> Statistics Canada, Labour Force Survey, table 14-10-0327-01, annual averages, people 15+, {Y0}–{Y1}. Territories are not in this table. Use caution comparing before and after 2006 (processing change). Ties share #1. Bars glide between years as animation; every number shown is a published value.",
    sources=["statcan_14100327"],
    method="Rates are Statistics Canada's published annual-average unemployment rates for the year shown. Provinces are ranked lowest first; equal published rates share the rank. Bar lengths and positions move between consecutive years as animation only. No causes are claimed.",
    figures=dict(ever_lowest=[NAMES[p] for p in ever], lowest_by_year={str(y): [NAMES[p] for p in lowest[y]] for y in YRS}, lead_changes=changes, years_at_or_sharing_lowest={NAMES[p]: n for p, n in years_at.items()},
                 nl_highest_every_year=nl_all, quebec_lowest_years=qc_run, quebec_1983=[qc83, qc83_rank], alberta_2019=[ab19, ab19_rank], alberta_2020=[ab20, ab20_rank],
                 latest=dict(year=Y1, lowest=[NAMES[p] for p in lowest[Y1]], rate=min(ur(p, Y1) for p in NAMES), canada=L["data"]["CAN"][str(Y1)]["ur"])),
)
dst = ROOT / "timelapses/short-lowest-unemployment.json"
dst.write_text(json.dumps(cfg, indent=1, ensure_ascii=False))
print(dst.relative_to(ROOT))
