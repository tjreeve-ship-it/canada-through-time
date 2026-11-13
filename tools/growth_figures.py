"""Figures for the 'Where Canada's growth came from' Short, from the raw Statistics Canada file (table 17-10-0008-01).
Periods run July 1 to June 30. Natural increase = births - deaths. Net international migration = immigrants - net emigration
+ net non-permanent residents (net emigration as published: emigrants - returning emigrants [+ net temporary emigration 1991-2016]).
Residual deviation (published to 2020/21) is reported separately, never folded into a component."""
import csv, io, json, zipfile, hashlib
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]; RAW = ROOT / "data/raw/statcan/17100008-eng.zip"
rows = csv.DictReader(io.StringIO(zipfile.ZipFile(RAW).read("17100008.csv").decode("utf-8-sig")))
C = {}
for r in rows:
    if r["GEO"] != "Canada" or r["VALUE"] == "": continue
    C.setdefault(int(r["REF_DATE"][:4]), {})[r["Components of population growth"]] = int(float(r["VALUE"]))
P = sorted(C); FINAL = 2024   # 2024/25 is the last period with every component final or updated; 2025/26 preliminary
lab = lambda p: f"{p}–{str(p + 1)[2:]}"
def comp(p):
    c = C[p]; ni = c["Births"] - c["Deaths"]; ne = c["Net emigration"]; npr = c["Net non-permanent residents"]; im = c["Immigrants"]
    nim = im - ne + npr; res = c.get("Residual deviation", 0)
    return dict(period=lab(p), births=c["Births"], deaths=c["Deaths"], natural=ni, immigrants=im, net_emigration=ne, net_npr=npr, net_international=nim,
                residual=c.get("Residual deviation"), growth_from_components=ni + nim + res, intl_share=round(nim / (ni + nim) * 100, 1) if ni + nim else None)
T = {p: comp(p) for p in P}
# cross-check: components + residual = July-to-July population change (17-10-0009)
pop = {}
for r in csv.DictReader(io.StringIO(zipfile.ZipFile(ROOT / "data/raw/statcan/17100009-eng.zip").read("17100009.csv").decode("utf-8-sig"))):
    if r["GEO"] == "Canada" and r["REF_DATE"].endswith("-07-01") and r["VALUE"]: pop[int(r["REF_DATE"][:4])] = int(float(r["VALUE"]))
mismatch = {lab(p): (T[p]["growth_from_components"], pop[p + 1] - pop[p]) for p in P if p + 1 in pop and T[p]["growth_from_components"] != pop[p + 1] - pop[p]}
fin = [p for p in P if p <= FINAL]
first_intl_over = next(p for p in fin if T[p]["net_international"] > T[p]["natural"])
always_after = all(T[p]["net_international"] > T[p]["natural"] for p in fin if p >= first_intl_over)
last_switch = max(p for p in fin if T[p]["net_international"] <= T[p]["natural"])
out = dict(source="Statistics Canada, table 17-10-0008-01 (Canada, July-June periods)", raw_sha256=hashlib.sha256(RAW.read_bytes()).hexdigest(),
  periods=[P[0], P[-1]], final_through=lab(FINAL), check_components_vs_population_change=mismatch or "all periods match",
  first=T[P[0]], last_final=T[FINAL], latest_preliminary=T[P[-1]],
  first_period_intl_exceeds_natural=lab(first_intl_over), intl_exceeds_natural_every_period_since=lab(last_switch + 1), always_after_first=always_after,
  peak_net_international=max((T[p] for p in fin), key=lambda r: r["net_international"]), peak_immigrants=max((T[p] for p in fin), key=lambda r: r["immigrants"]),
  peak_net_npr=max((T[p] for p in fin), key=lambda r: r["net_npr"]), min_natural=min((T[p] for p in fin), key=lambda r: r["natural"]),
  max_natural=max((T[p] for p in fin), key=lambda r: r["natural"]),
  totals_1971_2025=dict(natural=sum(T[p]["natural"] for p in fin), net_international=sum(T[p]["net_international"] for p in fin), immigrants=sum(T[p]["immigrants"] for p in fin)),
  by_decade_share={f"{d}s": round(sum(T[p]["net_international"] for p in fin if d <= p < d + 10) / sum(T[p]["natural"] + T[p]["net_international"] for p in fin if d <= p < d + 10) * 100, 1) for d in (1970, 1980, 1990, 2000, 2010, 2020)},
  series={lab(p): T[p] for p in P})
(ROOT / "exports/short-growth").mkdir(parents=True, exist_ok=True); (ROOT / "exports/short-growth/figures.json").write_text(json.dumps(out, indent=1))
print(json.dumps({k: v for k, v in out.items() if k != "series"}, indent=1))
