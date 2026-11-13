"""Write the migration Short's configuration from tools/migration_figures.py output. No story number is typed by hand."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
F = json.loads((ROOT / "exports/short-migration/figures.json").read_text())
C = F["cumulative_net_1971_2025"]
fmt = lambda n: f"{abs(n):,}"; sgn = lambda n: ("+" if n > 0 else "−") + fmt(n)
floor_to = lambda n, s: (abs(n) // s) * s
gainers = sorted([g for g in C if C[g] > 0], key=lambda g: -C[g]); top2 = gainers[:2]; loser = min(C, key=C.get)
assert top2 == ["BC", "AB"] and loser == "QC", (top2, loser)
both = min(C["BC"], C["AB"]); assert both > 700000 and abs(C["QC"]) > 650000
flow0 = F["largest_single_flows"][0]; assert (flow0["origin"], flow0["destination"]) == ("Quebec", "Ontario")
abw = F["alberta_worst"][0]; abb = F["alberta_best"][0]
ab80 = next(r for r in F["largest_one_year_gain"] if r["place"] == "Alberta" and r["period"].startswith("July 1980"))
on23 = next(r for r in F["largest_one_year_loss"] if r["place"] == "Ontario" and r["period"].startswith("July 2023"))
assert abb["period"].startswith("July 2023") and abw["period"].startswith("July 1983")
pl = lambda per: (lambda a, b: f"{a}–{str(b)[2:]}")(int(per[5:9]), int(per[-4:]))
NAME = {"BC": "British Columbia", "AB": "Alberta", "QC": "Quebec"}
cfg = dict(id="short-who-moved-where", format="9x16", fps=30, theme="ember", title="Who moved where in Canada", kicker="Moves between provinces",
  periods=F["periods"][:1] + [int(F["final_through"][-4:]) - 1],
  intro=4.0, perPeriod=0.42, endHold=1.0, outro=7.0,
  hook=[f"Since 1971, B.C. and Alberta have each gained <em>{floor_to(both, 100000):,}+</em> people from other provinces.",
        f"Quebec has lost {floor_to(C['QC'], 50000):,}+."],
  hookNote="Net: people who moved in from other provinces minus people who moved out, July 1971 to June 2025.",
  introFocus=["BC", "AB", "QC"], introCam="westwide",
  beats=[
    dict(period=1977, hold=2.2, kicker=pl(flow0["period"]), cam="east", focus=["QC", "ON"], flow=["QC", "ON"],
         text=f"Quebec to Ontario: {flow0['people']:,} people. The largest one-year flow between two provinces since 1971."),
    dict(period=1983, hold=2.2, kicker=pl(abw["period"]), cam="west", focus=["AB"],
         text=f"Alberta: {sgn(ab80['net'])} net in {pl(ab80['period'])}, then {sgn(abw['net'])} in {pl(abw['period'])}."),
    dict(period=2023, hold=2.4, kicker=pl(abb["period"]), cam="centre", focus=["AB", "ON"], flow=["ON", "AB"],
         text=f"Alberta: {sgn(abb['net'])} net, its largest gain since 1971. Ontario: {sgn(on23['net'])}.")],
  summary=dict(seconds=6.5, title="Net, July 1971 to June 2025", focus=["BC", "AB", "QC"], items=[
    dict(dir="up" if C[g] > 0 else "down", big=sgn(C[g]), place=NAME[g], text="gained from other provinces" if C[g] > 0 else "lost to other provinces") for g in ["BC", "AB", "QC"]]),
  outro_card=dict(title="Sources and method", lines=[
    dict(cls="src", text="Statistics Canada, Table 17-10-0045-01: interprovincial migrants by province of origin and destination, quarterly. Statistics Canada Open Licence."),
    dict(text="Each period runs July 1 to June 30 (four quarters summed). Net = moved in from other provinces minus moved out. Arc width shows how many people moved; dots show direction. Movement between years is animation; figures are published values."),
    dict(text="July 2025 to June 2026 is not shown: it is partly preliminary and based on a new data source."),
    dict(cls="lim", text="This video shows where people moved, not why.")]),
  raceTitle="Net gain or loss since July 1971", raceNote="Moved in from other provinces minus moved out. Territories not shown.",
  credit="The Canadian Data Project", sourceLine="Source: Statistics Canada, Table 17-10-0045-01. Net = moved in minus moved out. Territories not in bars. Movement between years is animation.",
  callouts={"NB": [7380, 1330], "NS": [8460, 1060], "PE": [8330, 2120]},
  relief=dict(b=[3660, 630, 9040, 5270], opacity=0.22), netScale=45000, minFlow=700, peoplePerDot=1500,
  cameras={"wide": dict(t=[6280, 2350], z=-2.98, x=58, o=-4), "westwide": dict(t=[5500, 2750], z=-2.75, x=58, o=-8), "end": dict(t=[6280, 2300], z=-3.02, x=60, o=-2),
           "west": dict(t=[4900, 2500], z=-2.3, x=55, o=-12), "east": dict(t=[7250, 2150], z=-2.35, x=56, o=6), "centre": dict(t=[5800, 2300], z=-2.6, x=56, o=-6)},
  figures_sha256=F["raw_sha256"])
out = ROOT / "timelapses/short-who-moved-where.json"; out.write_text(json.dumps(cfg, indent=1, ensure_ascii=False))
print(json.dumps({k: cfg[k] for k in ("hook", "hookNote", "beats", "summary")}, indent=1, ensure_ascii=False))
