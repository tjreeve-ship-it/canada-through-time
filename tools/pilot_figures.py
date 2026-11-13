"""Headline figures for the population Short, computed from the raw Statistics Canada file (table 17-10-0009-01).
July 1 estimate = the Q3 reference date (YYYY-07). change = P(y) - P(y-1); pct = change / P(y-1)."""
import csv, io, json, zipfile, hashlib, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]; RAW = ROOT / "data/raw/statcan/17100009-eng.zip"
PROV = ["Newfoundland and Labrador","Prince Edward Island","Nova Scotia","New Brunswick","Quebec","Ontario","Manitoba","Saskatchewan","Alberta","British Columbia"]
TERR = ["Yukon","Northwest Territories","Nunavut","Northwest Territories including Nunavut"]
rows = csv.DictReader(io.StringIO(zipfile.ZipFile(RAW).read("17100009.csv").decode("utf-8-sig")))
P, ST = {}, {}
for r in rows:
    d = r["REF_DATE"]
    if not d.endswith("-07-01"): continue
    y = int(d[:4]); g = r["GEO"]
    if y < 1971: continue   # the video covers 1971 on; earlier estimates are rounded to thousands and on a different basis
    if r["VALUE"] == "": continue
    P[(g, y)] = int(float(r["VALUE"])); ST[(g, y)] = r.get("STATUS", "")
geos = sorted({g for g, _ in P}); print("geographies:", geos, file=sys.stderr)
def span(g): ys = sorted(y for gg, y in P if gg == g); return ys[0], ys[-1], len(ys) == ys[-1] - ys[0] + 1
def jumps(gs):
    out = []
    for g in gs:
        for (gg, y) in P:
            if gg == g and (g, y - 1) in P:
                a, b = P[(g, y - 1)], P[(g, y)]; out.append(dict(place=g, period=f"July 1, {y-1} to July 1, {y}", start=a, end=b, change=b - a, pct=round((b - a) / a * 100, 3), prelim=y == 2026))
    return out
c0, c1 = P[("Canada", 1971)], P[("Canada", 2026)]
jp, jt, jc = jumps(PROV), jumps([t for t in TERR if any(g == t for g, _ in P)]), jumps(["Canada"])
top = lambda L, k, n=5, rev=True: sorted(L, key=lambda r: r[k], reverse=rev)[:n]
out = dict(source="Statistics Canada, table 17-10-0009-01, Q3 (July 1) estimates", raw_sha256=hashlib.sha256(RAW.read_bytes()).hexdigest(),
  spans={g: span(g) for g in geos}, status_2026={g: ST.get((g, 2026)) for g in geos}, status_codes=sorted(set(ST.values())),
  canada=dict(p1971=c0, p2026=c1, change=c1 - c0, pct=round((c1 - c0) / c0 * 100, 2), ratio=round(c1 / c0, 3)),
  canada_top_by_people=top(jc, "change"), canada_top_by_pct=top(jc, "pct"), canada_lowest=top(jc, "change", 3, False),
  prov_top_by_people=top(jp, "change", 8), prov_top_by_pct=top(jp, "pct", 8), prov_declines=top([j for j in jp if j["change"] < 0], "change", 8, False), n_prov_declines=sum(j["change"] < 0 for j in jp),
  terr_top_by_pct=top(jt, "pct", 6), terr_declines=top([j for j in jt if j["change"] < 0], "pct", 5, False),
  prov_1971_2026={g: dict(p1971=P[(g, 1971)], p2026=P[(g, 2026)], change=P[(g, 2026)] - P[(g, 1971)], pct=round((P[(g, 2026)] / P[(g, 1971)] - 1) * 100, 1), share1971=round(P[(g, 1971)] / c0 * 100, 1), share2026=round(P[(g, 2026)] / c1 * 100, 1)) for g in PROV},
  check_sum_2026=dict(sum_parts=sum(P[(g, 2026)] for g in PROV + ["Yukon", "Northwest Territories", "Nunavut"] if (g, 2026) in P), canada=c1))
(ROOT / "exports/short-pilot/figures.json").write_text(json.dumps(out, indent=1))
print(json.dumps(out, indent=1))
