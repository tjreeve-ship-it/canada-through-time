"""Configuration for the growth-components Short, written from tools/growth_figures.py output. No story number is typed by hand."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
F = json.loads((ROOT / "exports/short-growth/figures.json").read_text())
a, b, pk, pr = F["first"], F["last_final"], F["peak_net_international"], F["latest_preliminary"]
assert F["check_components_vs_population_change"] == "all periods match" and F["intl_exceeds_natural_every_period_since"] == "1995–96"
assert pk["period"] == "2023–24" and pr["net_npr"] < 0
negs = [(p, r["net_npr"]) for p, r in F["series"].items() if r["net_npr"] < 0]; assert min(negs, key=lambda t: t[1])[0] == pr["period"]
T = F["totals_1971_2025"]; sh0 = round(100 - a["intl_share"]); sh1 = round(b["intl_share"])
sgn = lambda n: ("+" if n > 0 else "−") + f"{abs(n):,}"
ALL = ["NL", "PE", "NS", "NB", "QC", "ON", "MB", "SK", "AB", "BC"]
cfg = dict(id="short-where-growth-came-from", format="9x16", fps=30, theme="ember", title="Where Canada's growth came from", kicker="Where Canada's growth came from",
  years=F["periods"], preliminary=[F["periods"][1]], intro=4.0, perYear=0.42, endHold=0.6, outro=7.5,
  hook=[f"In {a['period']}, births minus deaths drove <em>{sh0}%</em> of Canada's growth.", f"In {b['period']}, international migration drove {sh1}%."],
  hookNote="Growth here = births minus deaths plus net international migration (immigrants, minus net emigration, plus net non-permanent residents). July to June periods.",
  introFocus=ALL, introCam="westwide",
  beats=[
    dict(year=1995, hold=2.3, kicker=F["intl_exceeds_natural_every_period_since"], cam="wide", focus=ALL,
         text="From here on, international migration added more people than births minus deaths every year."),
    dict(year=2023, hold=2.6, kicker=pk["period"], cam="centre", focus=["ON", "BC", "AB", "QC"], cardWidth=300, cardTop=330,
         text=f"International migration: {sgn(pk['net_international'])}, including {sgn(pk['net_npr'])} net non-permanent residents. Births minus deaths: {sgn(pk['natural'])}."),
    dict(year=2025, hold=2.4, kicker=f"{pr['period']} (preliminary)", cam="wide", focus=ALL,
         text=f"Net non-permanent residents: {sgn(pr['net_npr'])}, the largest outflow in this series since 1971.")],
  summary=dict(seconds=6.5, title=f"{a['period']} to {b['period']}", focus=ALL, items=[
    dict(dir="up", big=f"{round(a['intl_share'])}% → {sh1}%", place="Share of growth from international migration", text=f"{a['period']} vs {b['period']}."),
    dict(dir="up", big=f"+{T['net_international'] / 1e6:.1f}M", place="International migration, net", text=f"vs +{T['natural'] / 1e6:.1f}M from births minus deaths, {a['period']} to {b['period']}."),
    dict(dir="up", big=sgn(pk["net_npr"]), place="Net non-permanent residents", text=f"{pk['period']}, the peak year.")]),
  outro_card=dict(title="Sources and method", lines=[
    dict(cls="src", text="Statistics Canada, Table 17-10-0008-01: estimates of the components of demographic growth, annual (July to June). Statistics Canada Open Licence."),
    dict(text="Births minus deaths vs net international migration (immigrants − net emigration + net non-permanent residents); shares exclude the published residual (to 2020–21). Components plus residual match population change in every period. 2025–26 is preliminary. Movement between years is animation."),
    dict(cls="lim", text="This video shows where growth came from, not why.")]),
  raceTitle="Canada: growth by component, each year", credit="The Canadian Data Project", sourceLine="Source: Statistics Canada, Table 17-10-0008-01. Movement between years is animation.",
  callouts={"NB": [7380, 1330], "NS": [8300, 1000], "PE": [8330, 2120]}, relief=dict(b=[3660, 630, 9040, 5270], opacity=0.22), kmPerThousand=4.5, columnRadius=34,
  cameras={"wide": dict(t=[6420, 2350], z=-3.06, x=58, o=-4), "westwide": dict(t=[6200, 2700], z=-2.95, x=58, o=-6), "end": dict(t=[6420, 2300], z=-3.1, x=60, o=-2),
           "centre": dict(t=[6000, 2800], z=-2.75, x=56, o=-6)},
  sources=["statcan_17100008"],
  method="Printed figures are published Statistics Canada components (or sums/differences of them) for the period on screen. Column heights, province tints (share of growth from international migration, capped at 0-100%) and bars move linearly between periods as animation only. Negative natural increase is drawn as a flat column; its value is printed. 2025-26 is preliminary.",
  figures_sha256=F["raw_sha256"])
(ROOT / "timelapses/short-where-growth-came-from.json").write_text(json.dumps(cfg, indent=1, ensure_ascii=False)); print(json.dumps(cfg["hook"] + [b["text"] for b in cfg["beats"]] + [i["big"] + " " + i["place"] for i in cfg["summary"]["items"]], indent=1, ensure_ascii=False))
