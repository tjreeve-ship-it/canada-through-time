"""Post copy for Short #8, every number pasted from the generated configuration's figures."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
C = json.loads((ROOT / "timelapses/short-glaciers.json").read_text()); F = C["figures"]; g = F["glaciers"]
m = lambda v: f"−{abs(v):.1f} m"
p, h, pl = g["Peyto"], g["Helm"], g["Place"]
lo, hi = F["arctic_range"]
txt = f"""# Short #8

**Title:** How much ice have Canada's glaciers lost? (1960–2025)

**Description:**
Every Canadian glacier with 40+ years of measurements, as a running total.

📊 The numbers (World Glacier Monitoring Service, glacier-wide annual mass balance)
• {F['negative']} of {F['count']} Canadian glaciers measured 40+ years have lost ice overall
• Helm (B.C.): {m(h['total'])} since {h['first']}
• Place (B.C.): {m(pl['total'])} since {pl['first']}
• Peyto (Alberta): {m(p['total'])} since {p['first']}
• Arctic ice caps: {m(lo)} to {m(hi)}
• 2023 was the biggest one-year loss ever measured at Helm ({m(h['worst_value'])}), Place ({m(pl['worst_value'])}) and Peyto ({m(p['worst_value'])})

💬 Have you seen Peyto or the Athabasca Glacier in person?

How to read it: "metres of water equivalent" is the ice lost, expressed as a depth of water spread over the whole glacier. Each line is the running sum of published years from that glacier's first measurement; missing years are gaps, never zero. Recent years may be revised. Lines grow between years as animation. This shows what, not why.

Source: World Glacier Monitoring Service, Fluctuations of Glaciers database (2026-02-10 release).
Music and sound: original.

Explore Peyto and every measured glacier: https://tjreeve-ship-it.github.io/canada-through-time/#cl=ice/2025/g57

#Canada #Glaciers #DataViz

**Tags:** Canada glaciers, Peyto Glacier, glacier melt, mass balance, Rocky Mountains, Arctic ice caps, WGMS, Canadian data, data visualization

## X
How much ice have Canada's glaciers lost?

Peyto (Alberta): {m(p['total'])} of water equivalent since {p['first']}.
Helm (B.C.): {m(h['total'])} since {h['first']}.
{F['negative']} of {F['count']} glaciers measured 40+ years: net loss.
2023: biggest one-year loss ever measured at Helm, Place and Peyto.

Source: World Glacier Monitoring Service
"""
(ROOT / "exports/short-glaciers/post_copy.md").write_text(txt); print(txt[:900])
