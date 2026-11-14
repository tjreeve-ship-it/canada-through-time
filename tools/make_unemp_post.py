"""Post copy for Short #10, every number pasted from the generated configuration's figures."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
F = json.loads((ROOT / "timelapses/short-lowest-unemployment.json").read_text())["figures"]
ya = F["years_at_or_sharing_lowest"]; top = max(ya, key=ya.get); q = F["quebec_lowest_years"]; lt = F["latest"]
ever = F["ever_lowest"]; n = len(F["lowest_by_year"]); lst = ", ".join(ever[:-1]) + " and " + ever[-1]
txt = f"""# Short #10

**Title:** Which province has Canada's lowest unemployment rate? (1976–2025)

**Description:**
{n} years, 10 provinces, {len(ever)} different #1s.

📊 The numbers (Statistics Canada, Labour Force Survey, annual averages)
• {len(ever)} provinces have had (or shared) the lowest rate: {lst}
• {top} held or shared #1 most often: {ya[top]} of {n} years
• 1983: Quebec was at {F['quebec_1983'][0]}%, the {F['quebec_1983'][1]}rd-highest of the 10 provinces
• {q[0]}–{q[-1]}: Quebec had the lowest rate {len(q)} years in a row
• 2020: Alberta went from {F['alberta_2019'][0]}% to {F['alberta_2020'][0]}%, 2nd-highest in Canada
• Newfoundland and Labrador had the highest rate in all {n} years
• {lt['year']}: lowest was {' & '.join(lt['lowest'])} at {lt['rate']}% (Canada: {lt['canada']}%)

💬 Where does your province land in {lt['year']}? (Pause just before the final card.)

How to read it: lowest rate is ranked #1; equal published rates share #1. Annual averages of the monthly survey, people 15 and over. Territories are not in this table. Statistics Canada advises caution comparing before and after 2006 (processing change). Every number on screen is a published value; bars glide between years as animation. This shows what, not why.

Source: Statistics Canada, table 14-10-0327-01 (Open Government Licence – Canada).
Music and sound: original.

Explore every province, every year: https://tjreeve-ship-it.github.io/canada-through-time/#ur-{lt['year']}

#Canada #Jobs #DataViz

**Tags:** Canada unemployment, unemployment rate by province, Quebec, Alberta, Saskatchewan, Newfoundland, Labour Force Survey, Statistics Canada, bar chart race

## X
Which province has had Canada's lowest unemployment rate?

Since 1976, {len(ever)} different provinces have been #1.
{top}: {ya[top]} of {n} years.
Quebec: {F['quebec_1983'][0]}% in 1983 → lowest in Canada {q[0]}–{q[-1]}.
Newfoundland and Labrador: highest all {n} years.

Source: Statistics Canada LFS
"""
(ROOT / "exports/short-unemployment/post_copy.md").write_text(txt); print(txt)
