"""Configuration for the population Short (v2), written from tools/pilot_figures.py output. No story number is typed by hand."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
F = json.loads((ROOT / "exports/short-pilot/figures.json").read_text())
c = F["canada"]; P = F["prov_1971_2026"]
top3 = sorted(P, key=lambda g: P[g]["change"], reverse=True)[:3]; share3 = sum(P[g]["change"] for g in top3) / c["change"] * 100
big = F["prov_top_by_people"][0]; fast = F["prov_top_by_pct"][:2]
assert top3 == ["Ontario", "British Columbia", "Alberta"] and big["place"] == "Ontario" and fast[0]["place"] == fast[1]["place"] == "Alberta"
yrs = lambda j: (int(j["period"][8:12]), int(j["period"][-4:])); span = lambda j: f"{yrs(j)[0]}–{str(yrs(j)[1])[2:]}"
f80 = min(fast, key=lambda j: yrs(j)[0]); f23 = max(fast, key=lambda j: yrs(j)[0])
mil = lambda n: f"{n / 1e6:.1f} million"
cfg = dict(id="short-where-canadians-live-v2", format="9x16", fps=30, theme="ember", title="Where Canadians live", kicker="Where Canadians live",
  years=[1971, 2026], preliminary=[2026], intro=4.0, perYear=0.4, endHold=1.2, outro=7.0,
  hook=[f"Canada has added <em>{mil(c['change'])}</em> people since 1971.", f"Three provinces account for {share3:.0f}% of the increase."],
  hookNote="Population on July 1 of each year, 1971 to 2026. 2026 is a preliminary estimate.",
  introFocus=["ON", "BC", "AB"], introCam="westwide",
  beats=[
    dict(year=yrs(f80)[1], hold=2.3, kicker=span(f80), cam="west", focus=["AB"],
         text=f"Alberta: +{f80['change']:,} people in one year (+{f80['pct']:.1f}%)."),
    dict(year=yrs(big)[1], hold=2.6, kicker=span(big), cam="centre", focus=["ON", "AB"],
         text=f"Ontario: +{big['change']:,} in one year, the largest one-year increase by a province since 1971. Alberta: +{f23['pct']:.1f}% again.")],
  summary=dict(seconds=6.5, title="1971 to 2026", focus=["ON", "BC", "AB"], items=[
    dict(dir="up", big=f"+{c['change'] / 1e6:.1f}M", place="Since 1971", text=f"Canada, up {c['pct']:.0f}% (2026 preliminary). Ontario, B.C. and Alberta: {share3:.0f}% of the increase."),
    dict(dir="up", big=f"+{big['change']:,}", place="Largest one-year increase", text=f"{big['place']}, July {yrs(big)[0]} to July {yrs(big)[1]} (+{big['pct']:.1f}%)."),
    dict(dir="up", big=f"~+{fast[0]['pct']:.1f}%", place="Fastest one-year growth", text=f"{fast[0]['place']}, twice: {span(f80)} and {span(f23)}.")]),
  outro_card=dict(title="Sources and method", lines=[
    dict(cls="src", text="Statistics Canada, Table 17-10-0009-01: population estimates, quarterly (July 1 estimates). Statistics Canada Open Licence."),
    dict(text="Column height shows population. Province colour shows growth from the year before. Every figure shown is a published value; movement between years is animation. 2026 is a preliminary estimate."),
    dict(cls="lim", text="This video shows where population changed, not why.")]),
  raceTitle="Provinces: population on July 1", credit="The Canadian Data Project", sourceLine="Source: Statistics Canada, Table 17-10-0009-01. Movement between years is animation.",
  callouts={"NB": [7380, 1330], "NS": [8300, 1000], "PE": [8330, 2120]}, relief=dict(b=[3660, 630, 9040, 5270], opacity=0.22), pctScale=3.0, kmPerMillion=105, columnRadius=40,
  cameras={"wide": dict(t=[6420, 2350], z=-3.06, x=58, o=-4), "westwide": dict(t=[5500, 2750], z=-2.75, x=58, o=-8), "end": dict(t=[6420, 2300], z=-3.1, x=60, o=-2),
           "west": dict(t=[4950, 2950], z=-2.4, x=55, o=-12), "centre": dict(t=[6000, 2800], z=-2.72, x=56, o=-6)},
  sources=["statcan_17100009"],
  method="Printed figures are published Statistics Canada July 1 population estimates for the year on screen. Column heights, province tints (growth from the previous July 1) and bar lengths move linearly between consecutive years as animation only; in-between states are never printed. 2026 is preliminary.",
  figures_sha256=F["raw_sha256"])
out = ROOT / "timelapses/short-where-canadians-live-v2.json"; out.write_text(json.dumps(cfg, indent=1, ensure_ascii=False))
print(json.dumps({k: cfg[k] for k in ("hook", "beats", "summary")}, indent=1, ensure_ascii=False))
