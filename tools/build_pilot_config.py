"""Write the Short's configuration from the computed figures, so no number in the video is typed by hand.
Run tools/pilot_figures.py first."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
F = json.loads((ROOT / "exports/short-pilot/figures.json").read_text())
c = F["canada"]; P = F["prov_1971_2026"]
top3 = sorted(P, key=lambda g: P[g]["change"], reverse=True)[:3]
share3 = sum(P[g]["change"] for g in top3) / c["change"] * 100
big = F["prov_top_by_people"][0]; fast = F["prov_top_by_pct"][:2]
assert top3 == ["Ontario", "British Columbia", "Alberta"], top3
assert fast[0]["place"] == fast[1]["place"] == "Alberta" and abs(fast[0]["pct"] - fast[1]["pct"]) < 0.05   # a near tie: shown as "about", both years named
mil = lambda n: f"{n / 1e6:.1f} million"
yrs = lambda j: (int(j["period"][8:12]), int(j["period"][-4:]))
span = lambda j: f"{yrs(j)[0]}–{str(yrs(j)[1])[2:]}"
base = json.loads((ROOT / "timelapses/people-1971-2026-vertical.json").read_text())
cfg = dict(base, id="short-where-canadians-live", motion="smooth", intro=3.5, perYear=0.5, hold=1.5, outro=6.5,
  hook=[f"Canada has added {mil(c['change'])} people since 1971.", f"Three provinces account for {share3:.0f}% of the increase."],
  summary=dict(seconds=6.5, items=[
    dict(scope="period", big=f"+{mil(c['change'])}", kicker="Since 1971", text=f"Canada, 1971 to 2026: up {c['pct']:.0f}%. {', '.join(top3[:2])} and {top3[2]}: {share3:.0f}% of the increase."),
    dict(scope="year", big=f"+{big['change']:,}", kicker="Largest one-year increase", text=f"{big['place']}, July {yrs(big)[0]} to July {yrs(big)[1]} (+{big['pct']:.1f}%)."),
    dict(scope="year", big=f"about +{fast[0]['pct']:.1f}%", kicker="Fastest one-year growth, provinces", text=f"{fast[0]['place']}, twice: {span(min(fast, key=lambda j: yrs(j)[0]))} and {span(max(fast, key=lambda j: yrs(j)[0]))}.")]),
  limit="This video shows where population changed, not why.",
  figures_sha256=F["raw_sha256"])
out = ROOT / "timelapses/short-where-canadians-live.json"; out.write_text(json.dumps(cfg, indent=1, ensure_ascii=False)); print(json.dumps({k: cfg[k] for k in ("hook", "summary", "limit")}, indent=1, ensure_ascii=False))
