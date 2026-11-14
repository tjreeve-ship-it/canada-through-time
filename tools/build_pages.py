"""Search pages: one plain page per city and per big topic, so search engines can find what the explorer shows.

The explorer is one page whose views live after a #, which search engines mostly ignore. These pages are ordinary HTML:
a title people would search for, a few facts in sentences, a picture, and a button into the exact interactive view.
Every number is computed here from the same data files the explorer uses (web/data/...), never typed in.

Called by tools/build_site.py; writes site/cities/<city>/index.html, site/topics/<topic>/index.html, site/cities/index.html,
site/sitemap.xml and site/robots.txt. Pictures come from dist/page-img (tools/make_page_images.py) when present.
"""
import html
import json
import re
import shutil
import statistics
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web/data"
IMG = ROOT / "dist/page-img"
PROV = {"0": "Newfoundland and Labrador", "1": "Prince Edward Island", "2": "Nova Scotia", "3": "New Brunswick", "4": "Quebec", "5": "Ontario",
        "6": "Manitoba", "7": "Saskatchewan", "8": "Alberta", "9": "British Columbia"}
e = html.escape


def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s.replace(" / grand sudbury", "")).strip("-")


def nice(name):
    return name.replace(" / Grand Sudbury", "").replace(" - ", "–")


def money(v):
    return f"${v:,.0f}"


def big(v):
    return f"${v / 1e9:,.1f} billion" if v >= 1e9 else f"${v / 1e6:,.0f} million"


def pct(v, dp=1):
    return f"{v:.{dp}f}%"


def ordinal(n):
    return f"{n}{'th' if 11 <= n % 100 <= 13 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')}"


def fy(y):
    return f"{y - 1}–{str(y)[2:]}"


def page(root, title, desc, h1, kicker, body, cta_href, cta_text, img=None, canon="", site_url=""):
    return f"""<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(title)}</title><meta name="description" content="{e(desc)}"><link rel="canonical" href="{e(site_url + canon)}">
<meta property="og:type" content="article"><meta property="og:title" content="{e(title)}"><meta property="og:description" content="{e(desc)}"><meta property="og:url" content="{e(site_url + canon)}">
{f'<meta property="og:image" content="{e(site_url + canon + img)}"><meta name="twitter:image" content="{e(site_url + canon + img)}">' if img else ''}<meta name="twitter:card" content="summary_large_image"><meta name="twitter:site" content="@CanadaAnalytics">
<link rel="icon" href="{root}favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="{root}pages.css"></head><body>
<header class="top"><a class="brand" href="{root}"><span class="g"><i></i><i></i><i></i></span>Canada <em>Through Time</em></a><a class="open" href="{root}">Open the explorer</a></header>
<main><div class="kick">{e(kicker)}</div><h1>{e(h1)}</h1>
{f'<a class="pic" href="{cta_href}"><img src="{img}" alt="{e(h1)}" width="1200" height="750" loading="eager"></a>' if img else ''}
<a class="cta" href="{cta_href}">{e(cta_text)} →</a>
{body}
<a class="cta" href="{cta_href}">{e(cta_text)} →</a></main>
<footer><p>Canada Through Time is a free, independent explorer of official Canadian data, made by The Canadian Data Project (<a href="https://x.com/CanadaAnalytics">@CanadaAnalytics</a>). It is not affiliated with the Government of Canada. <a href="{root}#about">About and sources</a> · <a href="{root}cities/">All cities</a> · <a href="{root}topics/">All topics</a></p></footer>
</body></html>"""


CSS = """@font-face{font-family:"Newsreader";font-weight:500;src:url(fonts/newsreader-latin-500-normal.woff2) format("woff2")}
@font-face{font-family:"IBM Plex Sans";font-weight:400;src:url(fonts/ibm-plex-sans-latin-400-normal.woff2) format("woff2")}
@font-face{font-family:"IBM Plex Sans";font-weight:600;src:url(fonts/ibm-plex-sans-latin-600-normal.woff2) format("woff2")}
:root{--page:#efeadb;--panel:#f8f4e8;--ink:#1f1d14;--ink2:#4a463a;--ink3:#7a7563;--acc:#b8472f;--line:#ddd5bf}
*{box-sizing:border-box}body{margin:0;background:var(--page);color:var(--ink);font:400 17px/1.6 "IBM Plex Sans",system-ui,sans-serif}
.top{display:flex;align-items:center;justify-content:space-between;padding:12px 22px;background:var(--ink);color:var(--page)}
.top a{color:inherit;text-decoration:none}.brand{font:500 20px "Newsreader",Georgia,serif;display:flex;align-items:center;gap:10px}.brand em{opacity:.75}
.g{display:flex;align-items:flex-end;gap:3px;height:20px}.g i{width:5px;border-radius:2px;background:var(--acc)}.g i:nth-child(1){height:8px;opacity:.7}.g i:nth-child(2){height:14px;opacity:.85}.g i:nth-child(3){height:20px}
.open{font-weight:600;font-size:14px;background:var(--acc);padding:8px 14px;border-radius:999px;color:#fff!important}
main{max-width:860px;margin:0 auto;padding:34px 22px 40px}.kick{font:600 12px "IBM Plex Sans";letter-spacing:.12em;text-transform:uppercase;color:var(--acc)}
h1{font:500 clamp(32px,5vw,48px)/1.1 "Newsreader",Georgia,serif;margin:8px 0 18px;letter-spacing:-.01em}h2{font:500 26px/1.2 "Newsreader",Georgia,serif;margin:34px 0 10px}
.pic img{width:100%;height:auto;border-radius:14px;display:block;box-shadow:0 10px 30px rgba(0,0,0,.12)}
.cta{display:inline-block;margin:18px 0;background:var(--ink);color:var(--page);text-decoration:none;font-weight:600;padding:12px 20px;border-radius:999px}
.facts{list-style:none;padding:0;margin:8px 0;display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}
.facts li{background:var(--panel);border-radius:12px;padding:14px 16px;box-shadow:inset 0 0 0 1px var(--line)}.facts b{display:block;font:500 28px/1.1 "Newsreader",Georgia,serif}.facts span{font-size:14px;color:var(--ink2)}
p{color:var(--ink2)}p b{color:var(--ink)}table{width:100%;border-collapse:collapse;font-size:15px}td,th{text-align:left;padding:7px 6px;border-bottom:1px solid var(--line)}td:last-child,th:last-child{text-align:right;white-space:nowrap}
.src{font-size:13.5px;color:var(--ink3)}a{color:var(--acc)}ul.links{columns:3 180px;padding-left:18px}
footer{border-top:1px solid var(--line);padding:18px 22px 40px;max-width:860px;margin:0 auto;font-size:13.5px;color:var(--ink3)}footer p{color:var(--ink3)}"""


def city_pages(out, site_url):
    P = json.loads((WEB / "cities/ct_profile.json").read_text())
    X = {f: i for i, f in enumerate(P["fields"])}
    for a in P["areas"].values():
        a["pob"] = {k: v for k, v in zip(P["pob_ids"], a["pob"] or []) if v is not None}
    cities = {g: a for g, a in P["areas"].items() if a["level"] != "Census tract"}
    tracts = {}
    for g, a in P["areas"].items():
        if a["level"] == "Census tract":
            tracts.setdefault(a["cma"], []).append(a)
    v = lambda a, k: a["v"][X[k]]
    rank = lambda k, g: 1 + sorted([c for c in cities if v(cities[c], k) is not None], key=lambda c: -v(cities[c], k)).index(g)
    CONT = {"Americas", "Europe", "Africa", "Asia"}
    made = []
    for g, c in sorted(cities.items(), key=lambda kv: -v(kv[1], "pop")):
        name, code, s = nice(c["name"]), g[-3:], slug(c["name"])
        prov = "Ontario and Quebec" if code == "505" else PROV[code[0]]
        ts = tracts[g]
        inc = [v(t, "hhinc") for t in ts if v(t, "hhinc") is not None]
        ph = v(c, "ph")
        births = sorted(((P["pob_names"][k], n) for k, n in c["pob"].items() if P["pob_names"][k] not in CONT and not re.match(r"Other|Oceania", P["pob_names"][k])), key=lambda r: -r[1])[:5]
        facts = [(f"{v(c, 'pop'):,.0f}", "people in 2021"), (money(v(c, "hhinc")), f"median household income (2020), {ordinal(rank('hhinc', g))} of 50 cities"),
                 (pct(v(c, "rent")), "of households rent their home"), (pct(v(c, "shelter30")), "of households spend 30% or more of income on shelter"),
                 (pct(v(c, "imm")), "of residents are immigrants"), (f"{v(c, 'age'):.1f}", "median age"),
                 (pct(v(c, "vm")), "belong to a visible minority group"), (pct(v(c, "nonoff")), "have a mother tongue other than English or French")]
        body = f"""<p>{e(name)} ({e(prov)}) is one of the 50 Canadian cities that Statistics Canada divides into census tracts, small neighbourhoods of about 2,500 to 8,000 people. It has <b>{len(ts):,}</b> of them.
The interactive map colours every tract by income, rent, age, where people were born, language and more, and compares {e(name)} with the other 49 cities.</p>
<ul class="facts">{''.join(f'<li><b>{b}</b><span>{e(t)}</span></li>' for b, t in facts)}</ul>
<h2>Income across {e(name)}’s neighbourhoods</h2>
<p>Median household income ranges from <b>{money(min(inc))}</b> in the lowest tract to <b>{money(max(inc))}</b> in the highest, with half of tracts above <b>{money(statistics.median(inc))}</b>. {len(ts) - len(inc)} tract{'s have' if len(ts) - len(inc) != 1 else ' has'} no published income figure (Statistics Canada suppresses small or low-response areas).</p>
<h2>Where people were born</h2>
<p>{pct(v(c, 'imm'))} of {e(name)}’s residents are immigrants{f", and {pct(v(c, 'imm_new'))} arrived between 2016 and 2021" if v(c, 'imm_new') is not None else ''}. The most common places of birth among them:</p>
<table><tr><th>Place of birth</th><th>Share of residents</th></tr>{''.join(f'<tr><td>{e(n)}</td><td>{pct(k / ph * 100)}</td></tr>' for n, k in births) if ph else ''}</table>
<p>On the interactive map you can pick any of 47 countries and see which neighbourhoods their immigrants live in.</p>
<p class="src">Source: Statistics Canada, 2021 Census of Population, Census Profile (98-401-X2021007). 2020 incomes include pandemic benefits. Shares of residents are of people in private households. Counts are randomly rounded by Statistics Canada.</p>
<h2>Other cities in {e(prov.split(' and ')[0])}</h2><ul class="links">{''.join(f'<li><a href="../{slug(o["name"])}/">{e(nice(o["name"]))}</a></li>' for og, o in sorted(cities.items(), key=lambda kv: kv[1]["name"]) if og != g and (PROV.get(og[-3:][0]) == PROV[code[0]]))}</ul>"""
        d = out / "cities" / s
        d.mkdir(parents=True, exist_ok=True)
        img = None
        if (IMG / f"city-{s}.jpg").exists():
            shutil.copy2(IMG / f"city-{s}.jpg", d / "map.jpg"); img = "map.jpg"
        title = f"{name} neighbourhoods: income, rent, age and where people were born (2021 Census)"
        desc = f"Map of all {len(ts):,} census tracts in {name}: median household income {money(v(c, 'hhinc'))}, {pct(v(c, 'rent'))} renters, {pct(v(c, 'imm'))} immigrants. Explore every neighbourhood."
        (d / "index.html").write_text(page("../../", title, desc, f"{name} neighbourhoods", "Neighbourhoods · 2021 Census", body, f"../../#nb={code}/hhinc", f"Explore {name}’s neighbourhoods", img, f"cities/{s}/", site_url))
        made.append((f"cities/{s}/", name, prov))
    # index of cities
    body = "<p>Every city that Statistics Canada divides into census tracts, with income, rent, age, origins and language for each neighbourhood.</p><ul class='links'>" + "".join(f'<li><a href="{s[7:]}">{e(n)}</a></li>' for s, n, _ in sorted(made, key=lambda m: m[1])) + "</ul>"
    (out / "cities").mkdir(exist_ok=True)
    (out / "cities/index.html").write_text(page("../", "Canadian city neighbourhood maps: all 50 cities (2021 Census)", "Neighbourhood-level maps of income, rent, age, immigration and language for 50 Canadian cities.", "Neighbourhoods in 50 Canadian cities", "Neighbourhoods", body, "../#nb=535/hhinc", "Open the neighbourhood map", None, "cities/", site_url))
    return [m[0] for m in made] + ["cities/"]


def topic_pages(out, site_url):
    made = []

    def write(s, title, desc, h1, kicker, body, href, cta):
        d = out / "topics" / s
        d.mkdir(parents=True, exist_ok=True)
        img = None
        if (IMG / f"topic-{s}.jpg").exists():
            shutil.copy2(IMG / f"topic-{s}.jpg", d / "picture.jpg"); img = "picture.jpg"
        (d / "index.html").write_text(page("../../", title, desc, h1, kicker, body, href, cta, img, f"topics/{s}/", site_url))
        made.append((f"topics/{s}/", h1))

    # glaciers
    G = json.loads((WEB / "climate/glaciers.json").read_text())
    rows = []
    for g in G["glaciers"]:
        vals = [x for x in g["b"][1] if x is not None]
        y1 = g["b"][0] + max(i for i, x in enumerate(g["b"][1]) if x is not None)
        rows.append((g["name"], g["b"][0], y1, len(vals), sum(vals), len(g["b"][1]) - len(vals)))
    long = [r for r in rows if r[3] >= 40]
    write("glaciers", "Canada’s glaciers are losing ice: every measured glacier since the 1960s", "Glacier-wide mass balance for every Canadian glacier with 10+ years of measurements (WGMS). Running totals since monitoring began.",
          "Canada’s glaciers, measured every year", "Climate · glaciers",
          f"""<p>A handful of Canadian glaciers have been measured every year for decades: snow gained minus ice and snow melted, expressed as metres of water spread over the whole glacier. <b>{sum(1 for r in long if r[4] < 0)} of the {len(long)}</b> glaciers measured for 40 years or more have lost ice overall.</p>
<table><tr><th>Glacier</th><th>Years</th><th>Measured</th><th>Running total</th></tr>{''.join(f'<tr><td>{e(n)}</td><td>{a}–{b}</td><td>{m} yrs</td><td>{t:+.1f} m</td></tr>' for n, a, b, m, t, _ in sorted(rows, key=lambda r: -r[3]))}</table>
<p class="src">Running total = the sum of the measured years (years without a measurement are skipped). Source: WGMS (2026), Fluctuations of Glaciers Database, doi:10.5904/wgms-fog-2026-02-10.</p>""",
          "../../#cl=ice/2020", "Open the glacier map")
    # warming at stations (same rules as the explorer: baseline needs 25 of 30 years, a 10-year average needs 8 of 10)
    A = json.loads((WEB / "climate/ahccd.json").read_text())
    y1 = A["t_years"][1]
    up = n = 0
    for s in A["stations"]:
        if not s["t"]:
            continue
        t = {s["t"][0] + i: x for i, x in enumerate(s["t"][1]) if x is not None}
        base = [t[y] for y in range(1961, 1991) if y in t]
        last = [t[y] for y in range(y1 - 9, y1 + 1) if y in t]
        if len(base) >= 25 and len(last) >= 8:
            n += 1; up += statistics.mean(last) > statistics.mean(base)
    write("climate-warming", f"How much warmer is Canada? {up} of {n} weather stations were warmer in {y1 - 9}–{y1} than in 1961–1990", "Environment Canada’s homogenized temperature records for 1,072 stations, each compared with its own 1961–1990 average. Map from 1900 to today.",
          "Warming at Canada’s weather stations", "Climate · temperature",
          f"""<p>Environment and Climate Change Canada adjusts each long-running weather station’s record for moves and instrument changes so that years can be compared. Comparing each station with its own 1961–1990 average, <b>{up} of the {n}</b> stations with enough data were warmer on average in {y1 - 9}–{y1}.</p>
<p>The interactive map plays every year from 1900, shows each station’s full record, and also covers precipitation and each station’s long-term trend.</p>
<p class="src">Rules: a station’s 1961–1990 average needs at least 25 of the 30 years; a 10-year average needs 8 of 10. Each dot is a station, not an area. Source: Environment and Climate Change Canada, Adjusted and Homogenized Canadian Climate Data (AHCCD).</p>""",
          "../../#cl=temp/2020", "Open the warming map")
    # federal spending
    PA = json.loads((WEB / "money/public_accounts.json").read_text())
    POP = json.loads((WEB / "population.json").read_text())
    y = PA["years"][-1]
    tot = sum(PA["totals"][str(y)]) * 1e3
    pop = POP["series"]["CAN"][POP["dates"].index(f"{y - 1}-07-01")]
    depts = sorted(((d["name"], sum(d["v"][str(y)]) * 1e3) for d in PA["depts"] if str(y) in d["v"]), key=lambda r: -r[1])[:12]
    objs = sorted(zip(PA["objects"], PA["totals"][str(y)]), key=lambda r: -r[1])[:6]
    write("federal-spending", f"Where does Ottawa’s money go? {big(tot)} in {fy(y)}, by department and by type", f"Federal spending by department and type from the Public Accounts of Canada, {fy(PA['years'][0])} to {fy(y)}: about {money(tot / pop)} per person in {fy(y)}.",
          "Where Ottawa’s money goes", "Follow the dollar · Public Accounts",
          f"""<p>Federal ministries and agencies spent <b>{big(tot)}</b> in fiscal {fy(y)}, about <b>{money(tot / pop)}</b> for every person in Canada.</p>
<h2>By type of spending</h2><table><tr><th>Standard object</th><th>{fy(y)}</th></tr>{''.join(f'<tr><td>{e(o)}</td><td>{big(x * 1e3)}</td></tr>' for o, x in objs)}</table>
<h2>Largest departments</h2><table><tr><th>Ministry or agency</th><th>{fy(y)}</th></tr>{''.join(f'<tr><td>{e(nm)}</td><td>{big(x)}</td></tr>' for nm, x in depts)}</table>
<p class="src">Gross expenditures by standard object as published in the Public Accounts of Canada; not adjusted for inflation. Per person uses Statistics Canada’s population on July 1 inside the fiscal year. Source: Receiver General for Canada (PSPC).</p>""",
          f"../../#mn=spend/{y}", "Explore 24 years of federal spending")
    # grants
    G2 = json.loads((WEB / "money/grants.json").read_text())
    gtot = sum(t for ys in G2["by_kind"].values() for t, _ in ys.values())
    recips = [r for r in G2["recipients"] if r["prov"] != "Batch reports"][:12]
    write("federal-grants", "Who gets federal grants and contributions? Every agreement over $25,000", f"{G2['agreements']:,} federal grant and contribution agreements: biggest recipients, programs, cities and provinces.",
          "Federal grants and contributions", "Follow the dollar · grants",
          f"""<p>Federal departments have disclosed <b>{G2['agreements']:,}</b> grant and contribution agreements over $25,000, worth <b>{big(gtot)}</b> in total commitments. These are totals over each agreement’s life, often several years, not one year’s payments; disclosure expanded a lot from 2018, so earlier years are incomplete.</p>
<h2>Largest recipients</h2><table><tr><th>Recipient (as disclosed)</th><th>All years</th></tr>{''.join(f'<tr><td>{e(r["name"])}</td><td>{big(r["t"])}</td></tr>' for r in recips)}</table>
<p class="src">Each agreement counted once at its latest amendment. Many small payments reported as “batch reports” are kept separate. Source: Government of Canada, Proactive Disclosure of Grants and Contributions (open.canada.ca).</p>""",
          "../../#mn=grants/all", "Explore every grant and contribution")
    # contracts
    C = json.loads((WEB / "money/contracts.json").read_text())
    ctot = sum(t for ys in C["by_proc"].values() for t, _ in ys.values())
    tn = sum(t for t, _ in C["by_proc"].get("TN", {}).values())
    write("federal-contracts", "Who wins federal contracts? Every contract over $10,000", f"{C['contracts']:,} federal contracts: biggest vendors, departments, what was bought and how much was non-competitive.",
          "Federal contracts", "Follow the dollar · contracts",
          f"""<p>Federal departments have disclosed <b>{C['contracts']:,}</b> contracts over $10,000, worth <b>{big(ctot)}</b> including amendments. <b>{tn / ctot * 100:.0f}%</b> of that value is marked non-competitive.</p>
<h2>Largest vendors</h2><table><tr><th>Vendor (as disclosed)</th><th>All years</th></tr>{''.join(f'<tr><td>{e(v["name"])}</td><td>{big(v["t"])}</td></tr>' for v in C['vendors'][:12])}</table>
<p class="src">Each contract counted once at its latest value. Contract value is the total over the contract’s life. Source: Government of Canada, Proactive Publication of Contracts (open.canada.ca).</p>""",
          "../../#mn=contracts/all", "Explore every federal contract")
    body = "<ul class='links'>" + "".join(f'<li><a href="{s[7:]}">{e(t)}</a></li>' for s, t in made) + "</ul><p>And <a href='../cities/'>neighbourhood maps for 50 cities</a>.</p>"
    (out / "topics").mkdir(exist_ok=True)
    (out / "topics/index.html").write_text(page("../", "Topics: climate, glaciers, federal spending, grants and contracts", "Plain pages for the biggest topics in Canada Through Time.", "Topics", "Canada Through Time", body, "../", "Open the explorer", None, "topics/", site_url))
    return [m[0] for m in made] + ["topics/"]


def build(out: Path, site_url: str):
    (out / "pages.css").write_text(CSS)
    urls = [""] + city_pages(out, site_url) + topic_pages(out, site_url)
    (out / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "".join(f"<url><loc>{site_url}{u}</loc></url>\n" for u in urls) + "</urlset>\n")
    (out / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {site_url}sitemap.xml\n")
    return len(urls)
