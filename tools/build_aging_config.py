"""Configuration for the ageing Short, written from tools/aging_figures.py output. No story number is typed by hand."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
F = json.loads((ROOT / "exports/short-aging/figures.json").read_text())
c = F["canada"]; cp = F["crossover_by_province"]; mp = F["median_by_province"]
first = min(v for v in cp.values() if v); firsts = [g for g, v in cp.items() if v == first]
assert sorted(firsts) == ["NB", "NS"] and F["crossover_year"] == 2016 and F["oldest_2026"] == "NL" and F["biggest_rise"] == "NL"
assert min(mp, key=lambda g: mp[g]["m1971"]) == "NL"
x = F["crossover"]
cfg = dict(id="short-canada-getting-older", format="9x16", fps=30, theme="ember", title="Canada is getting older", kicker="Canada is getting older",
  years=F["years"], preliminary=[F["preliminary_from"]], intro=4.0, perYear=0.4, endHold=0.6, outro=7.0,
  hook=[f"In {F['crossover_year']}, Canadians aged <em>65+</em> outnumbered children under 15.", f"Median age: {c['median'][0]} in {F['years'][0]}. {c['median'][1]} in {F['years'][1]}."],
  hookNote=f"July 1 estimates, {F['years'][0]} to {F['years'][1]}; {F['years'][1]} is preliminary. First year of the crossover in this series, which starts in {F['years'][0]}.",
  introFocus=["NL", "PE", "NS", "NB", "QC", "ON", "MB", "SK", "AB", "BC"], introCam="westwide",
  beats=[
    dict(year=first, hold=2.3, kicker=str(first), cam="east", focus=firsts, text="Nova Scotia and New Brunswick: the first provinces where people 65+ outnumbered children under 15."),
    dict(year=F["crossover_year"], hold=2.6, kicker=str(F["crossover_year"]), cam="wide", focus=["NL", "PE", "NS", "NB", "QC", "ON", "MB", "SK", "AB", "BC"],
         text=f"Canada: {x['o65']:,} people aged 65+, {x['u15']:,} under 15. The first year with more seniors."),
    dict(year=F["years"][1], hold=2.6, kicker=f"{F['years'][1]} (preliminary)", cam="nl", focus=["NL"], cardWidth=330, cardTop=330,
         text=f"Newfoundland and Labrador: median age {mp['NL']['m1971']} in {F['years'][0]}, the youngest province. {mp['NL']['m2026']} now, the oldest.")],
  summary=dict(seconds=6.5, title=f"{F['years'][0]} to {F['years'][1]}", focus=["NL", "PE", "NS", "NB", "QC", "ON", "MB", "SK", "AB", "BC"], items=[
    dict(dir="up", big=f"{c['median'][0]} → {c['median'][1]}", place="Median age, Canada", text=f"{F['years'][1]} is preliminary."),
    dict(dir="up", big=f"{c['o65_share'][0]:.0f}% → {c['o65_share'][1]:.0f}%", place="Share aged 65 and over", text=f"Under 15: {c['u15_share'][0]:.0f}% → {c['u15_share'][1]:.0f}%."),
    dict(dir="up", big=f"{mp['NL']['m1971']} → {mp['NL']['m2026']}", place="Newfoundland and Labrador", text="Youngest province in 1971, oldest now.")]),
  outro_card=dict(title="Sources and method", lines=[
    dict(cls="src", text="Statistics Canada, Table 17-10-0005-01: population estimates on July 1, by age and gender. Statistics Canada Open Licence."),
    dict(text="Columns show the share of each province aged 65+ (red) and under 15 (grey); province colour and the bars show median age. Every figure shown is a published value or a share of published counts; movement between years is animation. 2026 is preliminary."),
    dict(cls="lim", text="This video shows how the age of the population changed, not why.")]),
  raceTitle="Provinces: median age", credit="The Canadian Data Project", sourceLine="Source: Statistics Canada, Table 17-10-0005-01. Movement between years is animation.",
  callouts={"NB": [7380, 1330], "NS": [8300, 1000], "PE": [8330, 2120]}, relief=dict(b=[3660, 630, 9040, 5270], opacity=0.22), medRange=[20, 48], kmPerPoint=38, columnRadius=34,
  cameras={"wide": dict(t=[6420, 2350], z=-3.06, x=58, o=-4), "westwide": dict(t=[6200, 2700], z=-2.95, x=58, o=-6), "end": dict(t=[6420, 2300], z=-3.1, x=60, o=-2),
           "east": dict(t=[7650, 2150], z=-2.55, x=56, o=6), "nl": dict(t=[7750, 2500], z=-2.6, x=56, o=4)},
  sources=["statcan_17100005"],
  method="Printed figures are published Statistics Canada July 1 estimates for the year on screen (median age; counts aged 65+ and under 15). Column heights are shares of published counts. Heights, province tints and bar lengths move linearly between consecutive years as animation only; in-between states are never printed. 2026 is preliminary.",
  figures_sha256=F["raw_sha256"])
out = ROOT / "timelapses/short-canada-getting-older.json"; out.write_text(json.dumps(cfg, indent=1, ensure_ascii=False)); print("ok", len(cfg["beats"]))
