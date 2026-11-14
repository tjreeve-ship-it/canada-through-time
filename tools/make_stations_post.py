"""Post copy for Short #9, every number pasted from the generated configuration's figures."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
C = json.loads((ROOT / "timelapses/short-warming-stations.json").read_text()); F = C["figures"]; cw = F["count_by_window"]
y1 = C["years"][1]; last = cw[f"{y1 - 9}-{y1}"]; d10 = cw["2001-2010"]; first = cw[f"{C['years'][0] - 9}-{C['years'][0]}"]
nw = F["not_warmer"][0]; hot = F["warmest"]
sg = lambda v: f"{v:+.1f}".replace("-", "−")
pct = lambda k: f"{cw[k][0] / cw[k][1] * 100:.0f}%"
txt = f"""# Short #9

**Title:** How many of Canada's weather stations have warmed? (1900–{y1})

**Description:**
Every long-running Environment Canada station, each compared with its own 1961–1990 average.

📊 The numbers (ECCC, Adjusted and Homogenized Canadian Climate Data, annual mean temperature)
• {y1 - 9}–{y1}: {last[0]} of {last[1]} stations were warmer than their own 1961–1990 average
• 2001–2010: {d10[0]} of {d10[1]}, every one
• 1931–1940: {pct('1931-1940')} were warmer; 1971–1980: {pct('1971-1980')}
• Biggest difference {y1 - 9}–{y1}: {hot[0]}, N.W.T., {sg(hot[1])} °C
• The one exception {y1 - 9}–{y1}: {nw[0]}, Alta. ({sg(nw[2])} °C)

💬 Is your town's station on the map?

How to read it: each dot is one station's 10-year average annual temperature minus its own 1961–1990 average, using ECCC's homogenized (adjusted for station moves and instrument changes) series. A station needs 25+ years of data in 1961–1990, and 8 of the 10 years in a window, or it isn't shown or counted. Station counts change as stations open and close. Colours fade between years as animation. This shows what, not why.

Source: Environment and Climate Change Canada, AHCCD (Open Government Licence – Canada).
Music and sound: original.

Explore every station, every year: https://tjreeve-ship-it.github.io/canada-through-time/#cl=temp/{y1}

#Canada #Climate #DataViz

**Tags:** Canada climate, temperature, weather stations, Environment Canada, AHCCD, Inuvik, climate data, Canadian data, data visualization

## X
How many of Canada's long-running weather stations have warmed?

Each compared with its own 1961–1990 average:
2001–2010: {d10[0]} of {d10[1]}.
{y1 - 9}–{y1}: {last[0]} of {last[1]}.
Biggest: {hot[0]}, {sg(hot[1])} °C. The one exception: {nw[0]}, Alta.

Source: Environment and Climate Change Canada (AHCCD)
"""
(ROOT / "exports/short-stations/post_copy.md").write_text(txt); print(txt[:1100])
