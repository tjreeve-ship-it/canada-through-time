"""Headline figures for the interprovincial migration Short, computed from the raw Statistics Canada file (table 17-10-0045-01).
Period = July 1 of year Y to June 30 of Y+1 (sum of four quarters). net = in-migrants - out-migrants.
Source notes that govern use: net migration may be summed across quarters (note 9); gross quarterly sums are not fully comparable
before/after 2011 (note 9); basis changes from July 2025 (note 3); final to June 2025, updated Jul 2025-Mar 2026, preliminary from Apr 2026 (note 7);
NT and NU separate from July 1991, combined before (notes 4-6)."""
import csv, io, json, zipfile, hashlib
from collections import defaultdict
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]; RAW = ROOT / "data/raw/statcan/17100045-eng.zip"
AB = {"Newfoundland and Labrador": "NL", "Prince Edward Island": "PE", "Nova Scotia": "NS", "New Brunswick": "NB", "Quebec": "QC", "Ontario": "ON", "Manitoba": "MB",
      "Saskatchewan": "SK", "Alberta": "AB", "British Columbia": "BC", "Yukon": "YT", "Northwest Territories including Nunavut": "NT+NU", "Northwest Territories": "NT", "Nunavut": "NU"}
NAME = {v: k for k, v in AB.items()}; PROV = ["NL", "PE", "NS", "NB", "QC", "ON", "MB", "SK", "AB", "BC"]
rows = csv.DictReader(io.StringIO(zipfile.ZipFile(RAW).read("17100045.csv").decode("utf-8-sig")))
flow = defaultdict(int); q = defaultdict(set)
for r in rows:
    if r["VALUE"] == "": continue
    o = AB[r["GEO"].replace(", province of origin", "")]; d = AB[r["Geography, province of destination"].replace(", province of destination", "")]
    if o == d: continue
    y, m = int(r["REF_DATE"][:4]), int(r["REF_DATE"][5:7]); p = y if m >= 7 else y - 1
    flow[(p, o, d)] += int(float(r["VALUE"])); q[p].add(m)
periods = sorted(p for p in q if len(q[p]) == 4); FINAL_LAST = 2024   # July 2024 - June 2025 is the last all-final period (note 7)
lab = lambda p: f"July {p} to June {p + 1}"
net = defaultdict(int); gin = defaultdict(int); gout = defaultdict(int)
for (p, o, d), v in flow.items():
    net[(p, d)] += v; net[(p, o)] -= v; gin[(p, d)] += v; gout[(p, o)] += v
geos = sorted({g for _, g in net})
def rec(p, g): return dict(place=NAME[g], abbr=g, period=lab(p), net=net[(p, g)], inflow=gin[(p, g)], outflow=gout[(p, g)])
fin = [p for p in periods if p <= FINAL_LAST]
cum = {g: sum(net[(p, g)] for p in fin) for g in PROV}
yearly = [rec(p, g) for p in fin for g in PROV]
total_moves = {p: sum(v for (pp, _, _), v in flow.items() if pp == p) for p in periods}
big_flows = sorted(((v, p, o, d) for (p, o, d), v in flow.items() if p <= FINAL_LAST), reverse=True)[:8]
ab = sorted((rec(p, "AB") for p in fin), key=lambda r: r["net"])
out = dict(source="Statistics Canada, table 17-10-0045-01 (quarterly, summed to July-June periods)", raw_sha256=hashlib.sha256(RAW.read_bytes()).hexdigest(),
  periods=[periods[0], periods[-1]], final_through=lab(FINAL_LAST), latest_period=dict(label=lab(periods[-1]), status="updated and preliminary quarters; new data basis from July 2025"),
  check_net_sums_to_zero={str(p): sum(net[(p, g)] for g in geos) for p in periods if sum(net[(p, g)] for g in geos) != 0} or "all periods sum to zero",
  cumulative_net_1971_2025={g: cum[g] for g in sorted(PROV, key=lambda g: -cum[g])},
  provinces_with_net_gain=[NAME[g] for g in PROV if cum[g] > 0],
  largest_one_year_gain=sorted(yearly, key=lambda r: -r["net"])[:6], largest_one_year_loss=sorted(yearly, key=lambda r: r["net"])[:6],
  alberta_best=ab[-3:][::-1], alberta_worst=ab[:3],
  alberta_sign_changes=[lab(p) for p in fin[1:] if (net[(p, "AB")] > 0) != (net[(p - 1, "AB")] > 0)],
  last_final_period=sorted((rec(FINAL_LAST, g) for g in PROV), key=lambda r: -r["net"]),
  latest_period_preliminary=sorted((rec(periods[-1], g) for g in PROV), key=lambda r: -r["net"]),
  largest_single_flows=[dict(origin=NAME[o], destination=NAME[d], period=lab(p), people=v) for v, p, o, d in big_flows],
  total_moves_by_period={str(p): total_moves[p] for p in periods}, total_moves_note="gross sums of quarters; not fully comparable before/after 2011 (source note 9)")
(ROOT / "exports/short-migration").mkdir(parents=True, exist_ok=True)
(ROOT / "exports/short-migration/figures.json").write_text(json.dumps(out, indent=1)); print("ok")
