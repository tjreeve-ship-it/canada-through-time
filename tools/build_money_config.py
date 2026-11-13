"""Write timelapses/short-ottawa-collected-vs-spent.json (Short #7) from Statistics Canada table 36-10-0450-01 as ingested
in web/data/more/govt.json. All story numbers are computed here; the asserts stop the build if the wording no longer fits."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
G = json.loads((ROOT / "web/data/more/govt.json").read_text())
F = G["data"]["federal"]
Y0, Y1 = G["years"]
YRS = range(Y0, Y1 + 1)
PT = ["NL", "PE", "NS", "NB", "QC", "ON", "MB", "SK", "AB", "BC", "YT", "NT", "NU"]
NAMES = {"NL": "Newfoundland and Labrador", "PE": "Prince Edward Island", "NS": "Nova Scotia", "NB": "New Brunswick", "QC": "Quebec", "ON": "Ontario",
         "MB": "Manitoba", "SK": "Saskatchewan", "AB": "Alberta", "BC": "British Columbia", "YT": "Yukon", "NT": "Northwest Territories", "NU": "Nunavut"}
SHORTN = {**NAMES, "NL": "Newfoundland & Lab.", "PE": "P.E.I.", "NT": "N.W.T."}
tot = {g: sum(F[g][str(y)]["bal"] for y in YRS) for g in PT + ["CAN", "OUT"]}
pos = sorted((g for g in PT if tot[g] > 0), key=lambda g: -tot[g])
neg = sorted((g for g in PT if tot[g] < 0), key=lambda g: tot[g])
assert pos == ["AB", "ON", "BC"], pos
assert neg[0] == "QC"
assert abs(sum(tot[g] for g in PT) + tot["OUT"] - tot["CAN"]) < 30, "provinces + outside Canada must add to the Canada total"
ab_neg = [y for y in YRS if F["AB"][str(y)]["bal"] <= 0]
assert ab_neg == [2020], ab_neg
b = lambda v: f"${abs(v) / 1000:,.0f} billion"
print({g: round(tot[g] / 1000, 1) for g in PT + ["CAN", "OUT"]})

cfg = dict(
    id="short-ottawa-collected-vs-spent", format="9x16", fps=30, title="Federal money collected vs spent, by province", years=[Y0, Y1],
    kicker=f"Federal money · {Y0}–{Y1}", leadLabel="Running total", leadSub="collected − spent, current $",
    hook=dict(seconds=3.0, question="Where does Ottawa collect <em>more than it spends</em>?"),
    labels={"PE": [-6, -58, 1], "NS": [34, 50, 1], "NB": [-36, 52, 1], "NL": [6, -6, 0], "YT": [0, 6, 0], "BC": [-14, 4, 0], "AB": [6, 14, 0], "SK": [-4, 30, 0], "MB": [10, 0, 0]},
    colourScale=200000, names=SHORTN,
    plan=[
        dict(kind="run", to=1.0, s=3.0, ease="linear"),
        dict(kind="run", to=len(YRS) - 1, s=13.5, ease="inout", riser=True),
        dict(kind="beat", s=2.8, kicker=f"{Y0}–{Y1}", big="3 of 13", line="provinces and territories where Ottawa collected <em>more</em> than it spent: Alberta, Ontario, B.C.", focus=pos, tone="pos", sfx="tick"),
        dict(kind="beat", s=3.4, kicker=f"Alberta · {Y0}–{Y1}", big=f"+${tot['AB'] / 1000:,.0f}B", line=f"more collected than spent there; every year was positive except {ab_neg[0]}", focus=["AB"], tone="pos", sfx="hit"),
        dict(kind="beat", s=2.8, kicker=f"Quebec · {Y0}–{Y1}", big=f"−${-tot['QC'] / 1000:,.0f}B", line="the largest gap the other way: more spent than collected", focus=["QC"], tone="neg", sfx="tick"),
        dict(kind="summary", s=5.6),
        dict(kind="loop", s=0.8),
    ],
    summary=dict(kicker=f"Collected − spent, {Y0}–{Y1}",
                 line="Federal money by province",
                 sub=f"Across Canada, Ottawa spent {b(-tot['CAN'])} more than it collected over these years (deficits), so most places show more spent than collected.<br>Source: Statistics Canada, Table 36-10-0450-01."),
    note=f"<b>Source:</b> Statistics Canada, Table 36-10-0450-01 (federal general government revenue minus expenditure, allocated to provinces by Statistics Canada). Calendar years, current dollars, not adjusted for inflation. Totals are sums of published yearly values; colours glide between years as animation.",
    sources=["statcan_36100450"],
    method="For each province and territory: sum over calendar years of Statistics Canada's published federal 'surplus or deficit' (revenue minus expenditure) in the provincial economic accounts. Current dollars, not inflation-adjusted. Federal activity outside Canada is excluded from the map. Map colour moves between consecutive years as animation; printed totals are sums of published values through the year on screen.",
    figures=dict(totals_millions={g: round(tot[g], 1) for g in PT + ["CAN", "OUT"]}, positive=pos, alberta_non_positive_years=ab_neg),
)
dst = ROOT / "timelapses/short-ottawa-collected-vs-spent.json"
dst.write_text(json.dumps(cfg, indent=1, ensure_ascii=False))
print(dst.relative_to(ROOT))
