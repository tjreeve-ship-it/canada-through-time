"""Write timelapses/short-warming-stations.json (Short #9) from ECCC AHCCD annual mean temperatures in
web/data/climate/ahccd.json. Same rules as the explorer and the page: baseline needs 25 of 30 years in 1961-1990, a
10-year window needs 8 of 10. Every story number is computed here; asserts stop the build if the wording stops being true."""
import json, statistics as st
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
A = json.loads((ROOT / "web/data/climate/ahccd.json").read_text())
Y0, Y1 = 1909, A["t_years"][1]
S = []
for s in A["stations"]:
    if not s["t"]: continue
    t = {s["t"][0] + i: x for i, x in enumerate(s["t"][1]) if x is not None}
    b = [t[k] for k in range(1961, 1991) if k in t]
    if len(b) < 25: continue
    base = st.mean(b)
    def an(y, t=t, base=base):
        l = [t[k] for k in range(y - 9, y + 1) if k in t]; return st.mean(l) - base if len(l) >= 8 else None
    S.append(dict(id=s["id"], name=s["name"], prov=s["prov"], an={y: an(y) for y in range(Y0, Y1 + 1)}))
def count(y): v = [s["an"][y] for s in S if s["an"][y] is not None]; return sum(a > 0 for a in v), len(v)
c10, c20 = count(2010), count(Y1)
last = sorted((s for s in S if s["an"][Y1] is not None), key=lambda s: s["an"][Y1])
hot, cold = last[-1], last[0]
print("2010:", c10, f"{Y1}:", c20, "warmest:", hot["name"], round(hot["an"][Y1], 2), "not warmer:", [(s["name"], s["prov"], round(s["an"][Y1], 2)) for s in last if s["an"][Y1] <= 0])
assert c10[0] == c10[1] == 263 and c20 == (216, 217) and hot["name"] == "Inuvik" and cold["name"] == "Three Hills" and cold["an"][Y1] < 0
PROV = {"AB": "Alta.", "NT": "N.W.T."}
idx = lambda y: y - Y0
c1 = lambda a: ("+" if a > 0 else "−") + f"{abs(a):.1f} °C"
cfg = dict(
    id="short-warming-stations", format="9x16", fps=30, title="How many of Canada's weather stations got warmer?", years=[Y0, Y1], ramp=["#3F6E8C", "#ECE6D6", "#B8472F"], range=2.0,
    kicker="Long-running weather stations · 10-year average",
    between="Between cards, the 10-year window steps forward one year at a time; each dot is a station coloured by its 10-year average minus its own 1961–1990 average, and the counter shows how many were warmer.",
    hook=dict(seconds=3.2, question="How many of Canada’s weather stations have <em>warmed</em>?"),
    plan=[
        dict(kind="run", to=3, s=3.2, ease="linear"),
        dict(kind="run", to=idx(1985), s=9.5, ease="linear"),
        dict(kind="run", to=idx(2010), s=5.0, ease="inout", riser=True),
        dict(kind="beat", s=3.2, kicker="2001–2010", big=f"{c10[0]} of {c10[1]}", line="stations were warmer than their own <em>1961–1990</em> average. Every one.", sfx="hit", cardTop=300),
        dict(kind="run", to=idx(Y1), s=2.2, ease="out"),
        dict(kind="beat", s=3.2, kicker=f"{Y1 - 9}–{Y1} · {hot['name']}, {PROV.get(hot['prov'], hot['prov'])}", big=c1(hot["an"][Y1]), line="above its 1961–1990 average: the most of any station", focus=[hot["id"]], cardTop=700),
        dict(kind="summary", s=5.0),
        dict(kind="loop", s=0.8),
    ],
    summary=dict(kicker=f"{Y1 - 9}–{Y1}", big=f"{c20[0]} of {c20[1]}", line="long-running weather stations were <em>warmer</em> than their own 1961–1990 average",
                 sub=f"The one that wasn’t: {cold['name']}, {PROV.get(cold['prov'], cold['prov'])} ({c1(cold['an'][Y1])}). Bars: share of stations warmer, by decade. Source: Environment and Climate Change Canada."),
    note=f"<b>Source:</b> Environment and Climate Change Canada, Adjusted and Homogenized Canadian Climate Data (AHCCD), annual mean temperature to {Y1}. Stations with 25+ years of data in 1961–1990; a 10-year window needs 8 of its 10 years, otherwise the station is not shown or counted. Colours fade between years as animation.",
    sources=["eccc_ahccd_annual", "eccc_ahccd_stations"],
    method="Each station's 10-year average annual mean temperature minus its own 1961-1990 average (homogenized AHCCD values). Station counts change as stations open and close. No causes are claimed.",
    figures=dict(count_by_window={f"{y - 9}-{y}": count(y) for y in range(Y0, Y1 + 1)}, stations_with_baseline=len(S), warmest=[hot["name"], round(hot["an"][Y1], 3)],
                 not_warmer=[[s["name"], s["prov"], round(s["an"][Y1], 3)] for s in last if s["an"][Y1] <= 0]),
)
dst = ROOT / "timelapses/short-warming-stations.json"; dst.write_text(json.dumps(cfg, indent=1, ensure_ascii=False)); print(dst.relative_to(ROOT))
