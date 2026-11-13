"""Figures for the 'Canada is getting older' Short, from the raw Statistics Canada file (table 17-10-0005-01), via the project pipeline's reader.
July 1 estimates. Shares = published count for the age group / published all-ages count. Median age is the published value."""
import json, sys, hashlib
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]; sys.path.insert(0, str(ROOT / "pipeline"))
import ingest_demography as D
A = D.age(); d = A["data"]
PROV = ["NL", "PE", "NS", "NB", "QC", "ON", "MB", "SK", "AB", "BC"]
yrs = sorted(int(y) for y in d["CAN"]); y0, y1 = yrs[0], yrs[-1]
sh = lambda g, y, k: d[g][str(y)][k] / d[g][str(y)]["total"] * 100
can = {y: d["CAN"][str(y)] for y in yrs}
cross = next(y for y in yrs if can[y]["o65"] > can[y]["u15"])
cross_prov = {g: next((y for y in yrs if str(y) in d[g] and d[g][str(y)]["o65"] > d[g][str(y)]["u15"]), None) for g in PROV}
med = {g: (d[g][str(y0)]["median"], d[g][str(y1)]["median"]) for g in PROV}
out = dict(source="Statistics Canada, table 17-10-0005-01 (July 1 estimates)", raw_sha256=hashlib.sha256((ROOT / "data/raw/statcan/17100005-eng.zip").read_bytes()).hexdigest(),
  years=[y0, y1], preliminary_from=A["prelim_from"],
  canada=dict(median=[can[y0]["median"], can[y1]["median"]], o65=[can[y0]["o65"], can[y1]["o65"]], u15=[can[y0]["u15"], can[y1]["u15"]],
              o65_share=[round(sh("CAN", y0, "o65"), 1), round(sh("CAN", y1, "o65"), 1)], u15_share=[round(sh("CAN", y0, "u15"), 1), round(sh("CAN", y1, "u15"), 1)]),
  crossover_year=cross, crossover=dict(o65=can[cross]["o65"], u15=can[cross]["u15"], prev=dict(o65=can[cross - 1]["o65"], u15=can[cross - 1]["u15"])),
  crossover_by_province=cross_prov,
  median_by_province={g: dict(m1971=med[g][0], m2026=med[g][1], rise=round(med[g][1] - med[g][0], 1)) for g in sorted(PROV, key=lambda g: -med[g][1])},
  oldest_2026=max(PROV, key=lambda g: med[g][1]), youngest_2026=min(PROV, key=lambda g: med[g][1]), biggest_rise=max(PROV, key=lambda g: med[g][1] - med[g][0]),
  o65_share_2026={g: round(sh(g, y1, "o65"), 1) for g in PROV})
(ROOT / "exports/short-aging").mkdir(parents=True, exist_ok=True); (ROOT / "exports/short-aging/figures.json").write_text(json.dumps(out, indent=1)); print(json.dumps(out, indent=1))
