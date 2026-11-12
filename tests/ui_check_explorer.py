"""Browser checks for the explorer review build (needs Playwright + Chrome; not part of the fast pytest suite).

  python3 tests/ui_check_explorer.py            # prints PASS/FAIL per check, exits 1 on any failure
"""
from pathlib import Path as _P
ROOT = _P(__file__).resolve().parents[1]
import functools, http.server, sys, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

WEB = Path(__file__).resolve().parent.parent / "web"
import os
PAGE = os.environ.get("PAGE", "explore-qa/index.html")
LAYERS = ["pop", "chg", "rate", "dens", "share", "nat", "imm", "npr", "emi", "ipm", "flow", "fed",
          "starts", "comp", "hhg", "vac", "rent", "rentrel", "chn", "inc"]
results = []


def check(name, ok, detail=""):
    results.append((name, ok)); print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail else ""))


class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass


def main():
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 8821), functools.partial(Q, directory=str(WEB)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:8821/{PAGE}"
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        for label, vp, mobile in [("desktop", (1440, 900), False), ("phone", (390, 844), True)]:
            pg = b.new_page(viewport={"width": vp[0], "height": vp[1]}, is_mobile=mobile, has_touch=mobile, device_scale_factor=2 if mobile else 1)
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.goto(base + "#pop-2026"); pg.wait_for_function("window.READY === true", timeout=60000)
            # every layer renders without errors
            for m in LAYERS:
                pg.evaluate(f"CTX.state.m='{m}'; CTX.state.y=CTX.clampYear(CTX.M['{m}'], 2026); CTX.update()")
            pg.wait_for_timeout(400)
            check(f"{label}: all {len(LAYERS)} layers render without page errors", not errs, "; ".join(errs[:2]))
            pg.evaluate("CTX.state.m='pop'; CTX.state.p=null; CTX.update()")
            fit = pg.evaluate("CTX.fitView().zoom")
            # zoom bounds
            box = pg.locator("#map").bounding_box(); cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] * 0.55
            if not mobile:
                pg.mouse.move(cx, cy)
                for _ in range(60): pg.mouse.wheel(0, 400)
            else:
                cdp = pg.context.new_cdp_session(pg)
                for _ in range(4): cdp.send("Input.synthesizePinchGesture", {"x": cx, "y": cy, "scaleFactor": 0.25, "relativeSpeed": 2000})
            pg.wait_for_timeout(900)
            z = pg.evaluate("CTX.getView().zoom")
            check(f"{label}: zooming out stops at the bound", z >= fit - 0.32 - 1e-6, f"zoom {z:.2f}, fitted {fit:.2f}, floor {fit - 0.32:.2f}")
            # extreme pan is clamped
            v = pg.evaluate("CTX.boundView({...CTX.getView(), target:[99999, -99999, 0], zoom: -99})")
            f = pg.evaluate("CTX.fitView()")
            check(f"{label}: pan and zoom are clamped near Canada", abs(v["target"][0] - f["target"][0]) <= 2600 * 1.01 and v["zoom"] >= f["zoom"] - 0.33)
            pg.wait_for_timeout(1500)   # let wheel inertia / pinch settle before resetting
            pg.click("[data-act=reset]")
            pg.wait_for_timeout(1200)
            z2 = pg.evaluate("CTX.getView().zoom")
            check(f"{label}: reset returns to the fitted view", abs(z2 - fit) < 0.05, f"{z2:.2f} vs {fit:.2f}")
            # migration flows
            pg.evaluate("CTX.state.m='flow'; CTX.state.y=2023; CTX.state.p=null; CTX.update()")
            n = pg.evaluate("CTX.deck.props.layers.find(l => l.id==='arcs').props.data.length")
            check(f"{label}: national flows show the 12 largest only", n == 12, f"{n} arcs")
            txt = pg.locator("#legend").inner_text()
            check(f"{label}: flows legend says the view is aggregated", "12 largest" in txt and "% of all moves" in txt)
            pg.evaluate("CTX.state.p='AB'; CTX.update()")
            d = pg.evaluate("CTX.deck.props.layers.find(l => l.id==='arcs').props.data.map(r => r.o + '>' + r.d)")
            check(f"{label}: province flows show every flow in and out", len(d) > 12 and all("AB" in r for r in d), f"{len(d)} arcs")
            pg.close()
        # data presentation rules (desktop page)
        pg = b.new_page(viewport={"width": 1440, "height": 900}); pg.goto(base + "#starts-2025"); pg.wait_for_function("window.READY === true", timeout=60000)
        r = pg.evaluate("['YT','NT','NU'].map(g => CTX.M.starts.value(g, 2025))")
        check("territories have no starts value (missing, not zero)", all(x is None for x in r), str(r))
        check("completions end in 2022 and the slider clamps to it", pg.evaluate("CTX.M.comp.years[1] === 2022 && CTX.clampYear(CTX.M.comp, 2025) === 2022"))
        check("completions are null after 2022", pg.evaluate("CTX.M.comp.value('CAN', 2023) === null"))
        check("core housing need snaps to census years only", pg.evaluate("CTX.clampYear(CTX.M.chn, 2019) === 2021 && CTX.clampYear(CTX.M.chn, 2017) === 2016 && CTX.M.chn.value('CAN', 2018) === null"))
        check("rent-vs-prices layer starts after the 2019 method change", pg.evaluate("CTX.M.rentrel.years[0] === 2020 && CTX.M.rentrel.value('ON', 2010) === null"))
        pg.evaluate("CTX.state.m='rent'; CTX.state.y=2010; CTX.update()")
        t = pg.locator("#sheet-body").inner_text()
        check("unmapped metro areas are listed in the panel", ("not mapped" in t or "not on map" in t) and "Guelph" in t)
        sup = pg.evaluate("CTX.CITIES.some(c => Object.keys(c.rent2br_status).length)")
        check("suppressed rents exist in source and are flagged, not filled", (not sup) or "suppressed" in pg.locator("#sheet-body").inner_text() or pg.evaluate("CTX.CITIES.every(c => Object.keys(c.rent2br_status).every(y => !(y in c.rent2br)))"))
        pg.evaluate("CTX.state.m='fed'; CTX.state.y=2025; CTX.update()")
        check("election layer still renders party fills", pg.evaluate("CTX.deck.props.layers.find(l => l.id==='land') != null") and "Liberal" in pg.locator("#legend").inner_text())
        # quality-pass features
        pg.evaluate("CTX.state.m='chg'; CTX.state.y=2026; CTX.state.p='AB'; CTX.state.cmp='ON'; CTX.update()")
        t = pg.locator("#sheet-body").inner_text()
        check("comparison shows both places, values and a difference", "Ontario" in t and "+206%" in t and "+107%" in t and "percentage points" in t)
        pg.evaluate("CTX.state.m='starts'; CTX.state.y=2025; CTX.state.p='AB'; CTX.state.cmp='YT'; CTX.update()")
        t = pg.locator("#sheet-body").inner_text()
        check("comparison with a missing value says why and shows no difference", "no territorial data" in t and "No difference shown" in t)
        pg.evaluate("CTX.state.m='chg'; CTX.state.cmp=null; CTX.state.p='AB'; CTX.update()")
        pg.hover("#sheet-body .chartwrap .hit", position={"x": 20, "y": 40}); pg.wait_for_timeout(200)
        ro = pg.locator("#sheet-body .readout").first.inner_text()
        check("chart hover gives an exact value for an earlier year", "Alberta" in ro and "%" in ro and "2026" not in ro.split("·")[0], ro)
        y_before = pg.evaluate("CTX.state.y"); pg.mouse.move(5, 5); pg.focus("#sheet-body .chartwrap svg"); pg.keyboard.press("ArrowLeft"); pg.wait_for_timeout(400)
        check("arrow keys on the chart move the year", pg.evaluate("CTX.state.y") == y_before - 1, f"{y_before} -> {pg.evaluate('CTX.state.y')}")
        pg.evaluate("CTX.state.m='inc'; CTX.state.y=2010; CTX.state.p='ON'; CTX.update()")
        check("income chart marks the 1993 and 2012 survey changes", pg.locator("#sheet-body .chartwrap svg").first.inner_html().count("survey change") == 2)
        pg.evaluate("CTX.state.p='YT'; CTX.update()")
        t = pg.locator("#sheet-body").inner_text()
        check("territory income before 2018 says why it is missing", "2018" in t)
        pg.evaluate("CTX.state.m='chn'; CTX.state.y=2021; CTX.state.p='ON'; CTX.update()")
        svg = pg.locator("#sheet-body .chartwrap svg").first.inner_html()
        check("core housing need chart is two points, no line", svg.count("<circle") >= 2 and "<path" not in svg)
        pg.evaluate("CTX.openPath('rent')")
        check("a starting question opens real data with limits", pg.evaluate("CTX.state.m") == "rent" and "doesn't tell you" in pg.locator("#pathcard").inner_text())
        pg.evaluate("CTX.state.y=2025; CTX.update()"); pg.wait_for_timeout(600); pg.evaluate("CTX.update()")
        n = pg.evaluate("CTX.state.cityLabelled")
        check("dense city map labels a subset without overlap and lists every city", 0 < n < 30 and pg.locator("tr[data-city]").count() == 33, f"{n} labels drawn")
        pg.fill("[data-cityfilter]", "guel")
        check("city search filters the list", pg.locator("tr[data-city]:not([hidden])").count() == 1)
        # final-pass checks (only where the build has the features)
        if pg.evaluate("typeof CTX.measureFit === 'function'"):
            pg.evaluate("CTX.state.m='inc'; CTX.state.y=2010; CTX.state.p='YT'; CTX.state.cmpY=null; CTX.update()"); pg.wait_for_timeout(300)
            st = pg.evaluate("(CTX.deck.props.layers.find(l => l.id==='nodata-stipple')||{props:{data:[]}}).props.data.length")
            check("no published value is stippled on the map and named in the legend", st > 0 and "no published value" in pg.locator("#legend").inner_text(), f"{st} stipple points")
            t = pg.locator("#sheet-body").inner_text()
            check("no-value panel says Not published, why, and that nothing is filled in", "Not published" in t and "2018" in t and "Nothing is estimated" in t)
            pg.evaluate("CTX.state.m='inc'; CTX.state.y=2024; CTX.state.p='BC'; CTX.state.cmpY=2005; CTX.update()")
            t = pg.locator(".tcmp").inner_text()
            check("then-and-now refuses a difference across the 2012 income survey change", "$63,500" in t and "$75,800" in t and "No difference shown" in t and "2012" in t)
            pg.evaluate("CTX.state.cmpY=2015; CTX.update()")
            t = pg.locator(".tcmp .cmpdiff").inner_text()
            check("then-and-now shows a difference when both dates are comparable", "From 2015 to 2024" in t and "+$8,200" in t, t)
            pg.evaluate("CTX.state.m='chn'; CTX.state.y=2021; CTX.state.p='NU'; CTX.state.cmpY=null; CTX.update()")
            if pg.locator("#palpop").count():   # atlas build: buttons for few dates, slider for many
                opts = pg.locator(".tcmp button[data-cmpy]").all_inner_texts()
                check("then-and-now offers census years only for core housing need", len(opts) == 1 and "2016" in opts[0], str(opts))
                pg.evaluate("CTX.state.m='inc'; CTX.state.y=2024; CTX.state.p='YT'; CTX.state.cmpY=null; CTX.update()")
                opts = pg.locator(".tcmp button[data-cmpy]").all_inner_texts()
                check("then-and-now offers only the published years for a short series (Yukon income)", len(opts) == 6 and "2018" in opts[0] and "2023" in opts[-1], str(opts))
                pg.evaluate("CTX.state.m='rent'; CTX.state.p=null; CTX.state.city='Toronto'; CTX.state.y=2025; CTX.update()")
                sl = pg.locator("[data-cmpyr]"); sl.focus(); pg.keyboard.press("ArrowLeft"); pg.wait_for_timeout(300)
                yrs = pg.locator("[data-cmpyr]").get_attribute("data-yrs").split(",")
                check("then-and-now slider works from the keyboard and lands on a published year", str(pg.evaluate("CTX.state.cmpY")) in yrs, str(pg.evaluate("CTX.state.cmpY")))
                pg.evaluate("CTX.state.city=null; CTX.state.cmpY=null; CTX.state.m='inc'; CTX.state.y=2024; CTX.state.p=null; CTX.update()"); pg.wait_for_timeout(700)
                ov = pg.evaluate("""(() => { const vp = CTX.deck.getViewports()[0], L = CTX.deck.layerManager.getLayers().find(l => l.id === 'val'); if (!L) return -1;
                  const bx = L.props.data.map(d => { const [x, y] = vp.project(L.props.getPosition(d)), o = L.props.getPixelOffset(d), w = L.props.getText(d).length * 8.4 / 2; return [x - w, y + o[1] - 8, x + w, y + o[1] + 8]; });
                  let n = 0; for (let i = 0; i < bx.length; i++) for (let j = i + 1; j < bx.length; j++) if (!(bx[i][2] < bx[j][0] || bx[i][0] > bx[j][2] || bx[i][3] < bx[j][1] || bx[i][1] > bx[j][3])) n++; return n; })()""")
                check("province value labels do not overlap on a dollar measure (desktop)", ov == 0, f"{ov} overlapping pairs, {pg.evaluate('CTX.state.valHidden')} values hidden")
                check("palette picker lists eight palettes and three map surfaces", pg.locator("#palpop [data-pal]").count() == 8 and pg.locator("#palpop [data-tx]").count() == 3)
                pg.evaluate("CTX.state.m='fed'; CTX.state.y=2025; CTX.update()")
                acc = pg.evaluate("[getComputedStyle(document.querySelector('#layers .plates .opt.on')).backgroundColor, getComputedStyle(document.body).getPropertyValue('--accent').trim()]")
                check("interface accent is not used on the election layer", acc[0] != "rgb(184, 71, 47)", str(acc))
                pg.evaluate("CTX.state.m='rent'; CTX.update()"); pg.wait_for_timeout(600)
                check("shaded relief layer is drawn below the data marks", pg.evaluate("(() => { const ids = CTX.deck.props.layers.map(l => l.id); return ids.includes('relief') && ids.indexOf('relief') < ids.indexOf('cities') && ids.indexOf('relief') < ids.indexOf('bounds'); })()"))
                if pg.evaluate("typeof CTX.over === 'function'"):   # sign-off build
                    pg.evaluate("CTX.state.m='inc'; CTX.state.y=2024; CTX.state.p=null; CTX.state.city=null; CTX.update()"); pg.wait_for_timeout(700)
                    lg = pg.locator("#legend").inner_text()
                    check("values above the colour scale are named with exact figures in the legend", "Above the colour scale" in lg and "Northwest Territories $116,100" in lg and "Nunavut $109,600" in lg, lg[-160:])
                    lab = pg.evaluate("(() => { const L = CTX.deck.layerManager.getLayers().find(l => l.id === 'val'); return L.props.data.map(d => d.k + ':' + L.props.getText(d)).filter(t => t.includes('▲')).join(' | '); })()")
                    check("over-scale provinces carry a marker on the map; others do not", "NT:$116,100 ▲" in lab and "NU:$109,600 ▲" in lab and "YT" not in lab, lab)
                    check("over-scale values are unchanged in the data", pg.evaluate("CTX.M.inc.value('NT', 2024) === 116100 && CTX.M.inc.value('NU', 2024) === 109600"))
                    pg.evaluate("CTX.state.m='hhg'; CTX.state.y=2025; CTX.update()")
                    check("a layer with nothing beyond its scale shows no over-scale note", "the colour scale" not in pg.locator("#legend").inner_text())
                    pg.evaluate("CTX.state.m='pop'; CTX.state.y=2026; CTX.update()"); pg.wait_for_timeout(700)
                    r = pg.evaluate("""(() => { const L = CTX.deck.props.layers.find(l => l.id === 'spikes'), e = k => L.props.getElevation(L.props.data.find(d => d.k === k));
                      const ids = CTX.deck.props.layers.map(l => l.id); return { ratio: e('ON') / e('QC'), pop: CTX.M.pop.value('ON', 2026) / CTX.M.pop.value('QC', 2026), order: ids.indexOf('relief') >= 0 && ids.indexOf('relief') < ids.indexOf('foot') && ids.indexOf('relief') < ids.indexOf('spikes') }; })()""")
                    check("spike height is still proportional to population, and relief is drawn beneath the spikes", abs(r["ratio"] - r["pop"]) < 1e-9 and r["order"], str(r))
                    pg.evaluate("CTX.state.m='flow'; CTX.state.y=2025; CTX.state.p='BC'; CTX.update()"); pg.wait_for_timeout(500)
                    f = pg.evaluate("""(() => { const L = CTX.deck.props.layers.find(l => l.id === 'arcs'), ids = CTX.deck.props.layers.map(l => l.id); const ab = L.props.data.find(r => r.o === 'AB' && r.d === 'BC'), ba = L.props.data.find(r => r.o === 'BC' && r.d === 'AB');
                      return { tilt: L.props.getTilt, wRatio: (L.props.getWidth(ab) - 1.5) / (L.props.getWidth(ba) - 1.5), vRatio: Math.sqrt(ab.v / ba.v), order: ids.indexOf('relief') < ids.indexOf('arcs'), n: L.props.data.length }; })()""")
                    check("flow arcs: opposite directions separated, width still follows the flow, relief beneath", f["tilt"] != 0 and abs(f["wRatio"] - f["vRatio"]) < 1e-6 and f["order"], str(f))
                    lg = pg.locator("#legend").inner_text()
                    check("flow legend keeps direction and the side-by-side note", "leaving BC" in lg and "arriving in BC" in lg and "side by side" in lg)
                    pg.evaluate("CTX.state.p=null; CTX.update()")
                    lg = pg.locator("#legend").inner_text()
                    check("national flow legend names the destination end correctly and keeps the aggregation note", "Dark end = destination" in lg and "12 largest of" in lg, lg[:120])
                    pg.locator("button[data-why=src]").first.click(); pg.wait_for_timeout(300)
                    dr = pg.locator("#drawer-body").inner_text()
                    check("Source & method identifies the relief as context with source, licence and limits", "Shaded relief" in dr and "Natural Earth" in dr and "Public domain" in dr and "not “Migration flows”" in dr, dr[-200:])
                    pg.keyboard.press("Escape")
            else:
                opts = pg.locator("[data-cmpy] option").all_inner_texts()
                check("then-and-now offers census years only for core housing need", len(opts) == 2 and "2016" in opts[1], str(opts))
            pg.evaluate("CTX.state.m='rent'; CTX.state.y=2025; CTX.state.p=null; CTX.state.city='Toronto'; CTX.state.cmpY=2015; CTX.update()")
            t = pg.locator(".tcmp").inner_text()
            check("city then-and-now flags current dollars as not inflation-adjusted", "not adjusted for inflation" in t, t[-160:])
            pg.evaluate("CTX.state.cmpY=null; CTX.state.city=null")
            ok = pg.evaluate("document.fonts.load('500 16px ' + getComputedStyle(document.body).getPropertyValue('--font-display').split(',')[0], 'Montréal Québec Trois-Rivières').then(f => f.length > 0)")
            tn = pg.evaluate("getComputedStyle(document.getElementById('yearhero')).fontVariantNumeric")
            check("display face covers French place names; year uses tabular figures", ok and "tabular-nums" in tn, tn)
        pg.close()
        pt = b.new_page(viewport={"width": 820, "height": 1180}); errs = []
        pt.on("pageerror", lambda e: errs.append(str(e)))
        pt.goto(base + "#chg-2026-on"); pt.wait_for_function("window.READY === true", timeout=60000); pt.wait_for_timeout(800)
        check("tablet 820 px renders without errors", not errs and pt.evaluate("isFinite(CTX.getView().zoom)"), "; ".join(errs[:1]))
        pt.close()
        if "release" in PAGE or "studio" in PAGE:   # corrections from docs/DATA_INTEGRITY_AUDIT.md
            pr = b.new_page(viewport={"width": 1440, "height": 900})
            pr.goto(base + "#fed-2025-bc"); pr.wait_for_function("window.READY === true", timeout=60000); pr.wait_for_timeout(600)
            v = pr.evaluate("CTX.M.fed.value('BC', 2025)"); t = pr.locator("#reading").inner_text()
            check("C1: British Columbia 2025 is Liberal 20 and the House total is 343", v[0] == "Liberal Party of Canada" and v[1] == 20 and "343 seats" in t, f"{v} | {t[-90:]}")
            pr.evaluate("CTX.state.p=null; CTX.update()")
            check("C1: national line says Liberal 169 of 343", "169 of 343" in pr.locator("#finding").inner_text(), pr.locator("#finding").inner_text())
            pr.evaluate("CTX.state.y=1980; CTX.state.p='SK'; CTX.update()")
            v = pr.evaluate("CTX.M.fed.value('SK', 1980)"); t = pr.locator("#finding").inner_text()
            check("C2: a tie for most seats is shown as a tie, not a win", v[0] == "TIE" and v[1] == 7 and "tied" in t and "Tied for most seats" in pr.locator("#legend").inner_text(), t)
            check("C3: Canada's interprovincial figure is shown only where the source publishes one (0 from 1998/99; nothing before)", pr.evaluate("CTX.M.ipm.value('CAN', 1985) === null && CTX.M.ipm.value('CAN', 2020) === 0 && CTX.M.ipm.value('AB', 2020) !== null"))
            pr.evaluate("CTX.state.m='inc'; CTX.state.y=2021; CTX.state.p='NU'; CTX.update()")
            check("C4: income shows the source's quality grade where it is below B", "quality grade C (good" in pr.locator("#sheet-body").inner_text())
            pr.evaluate("CTX.state.m='rent'; CTX.state.y=2025; CTX.state.p=null; CTX.update()")
            check("C5: rent legend shows 'suppressed' only when a value is suppressed", "suppressed" not in pr.locator("#legend").inner_text())
            check("C6: flows layer cites both tables it uses", pr.evaluate("CTX.M.flow.src.length === 2"))
            pr.evaluate("CTX.state.m='pop'; CTX.state.y=2024; CTX.update()"); t24 = pr.locator("#r-meta").inner_text()
            pr.evaluate("CTX.state.y=2019; CTX.update()"); t19 = pr.locator("#r-meta").inner_text()
            pr.evaluate("CTX.state.y=2026; CTX.update()"); t26 = pr.locator("#r-meta").inner_text()
            check("C7: 2021–2025 population is marked as subject to revision; 2026 preliminary; earlier years unmarked", "will be revised" in t24 and "will be revised" not in t19 and "Preliminary" in t26 and "will be revised" not in t26, f"{t24!r} {t19!r} {t26!r}")
            pr.close()
        if "studio" in PAGE:   # flagship story and Timelapse Studio
            import json as _json, base64 as _b64, zipfile as _zip, csv as _csv, io as _io
            ps = b.new_page(viewport={"width": 1440, "height": 900}); errs = []; ps.on("pageerror", lambda e: errs.append(str(e)[:160]))
            ps.goto(base + "#pop-2026"); ps.wait_for_function("window.READY === true", timeout=60000)
            raw = {}
            z = _zip.ZipFile(ROOT / "data/raw/statcan/17100009-eng.zip"); nm = [x for x in z.namelist() if "MetaData" not in x][0]
            for r in _csv.DictReader(_io.TextIOWrapper(z.open(nm), encoding="utf-8-sig")):
                if r["GEO"] == "Canada" and r["REF_DATE"] in ("1971-07-01", "2026-07-01"): raw[r["REF_DATE"][:4]] = float(r["VALUE"])
            n = ps.evaluate("CTX.STORY.chapters.length"); texts = []
            for i in range(n):
                ps.evaluate(f"CTX.openStory({i})"); ps.wait_for_timeout(120); texts.append(ps.locator("#pathcard").inner_text())
            bad = [t[:60] for t in texts if any(k in t for k in ("NaN", "undefined", "null", "Infinity"))]
            check("story: ten chapters, each with text, a caveat and no broken numbers", n == 10 and not bad and all("Keep in mind" in t for t in texts), str(bad))
            a71, a26 = f"{raw['1971'] / 1e6:.1f} million", f"{raw['2026'] / 1e6:.1f} million"
            check("story: chapter 1 figures equal the raw Statistics Canada file", a71 in texts[0] and a26 in texts[0], f"{a71}, {a26} | {texts[0][80:260]}")
            check("story: each chapter switches the map to its own layer", ps.evaluate("(() => { const out = []; for (let i = 0; i < CTX.STORY.chapters.length; i++) { CTX.openStory(i); out.push(CTX.state.m === CTX.STORY.chapters[i].m); } return out.every(Boolean); })()"))
            ps.evaluate("CTX.openStory(1); CTX.state.m = 'rent'; CTX.update()")
            check("story: picking another layer leaves the story", ps.evaluate("CTX.state.story == null") and "Keep in mind" not in ps.locator("#pathcard").inner_text())
            ps.evaluate("CTX.state.m='pop'; CTX.state.y=2026; CTX.state.p=null; CTX.update()"); ps.locator("[data-studio-open]").click(); ps.wait_for_timeout(200)
            check("studio: the dialog opens with period, camera and notes controls", ps.locator("#studiodlg [name=from]").count() == 1 and ps.locator("#studiodlg [name=camera] option").count() == 4 and "1998: Canada passes 30 million" in ps.locator("#studiodlg textarea").input_value())
            cfg = ps.evaluate("CTX.studioConfig({layer:'chn', place:null})")
            check("studio: a census layer gets only its census dates and no invented years", cfg["from"] == 2016 and cfg["to"] == 2021)
            tok = _b64.urlsafe_b64encode(_json.dumps(cfg).encode()).decode().rstrip("=")
            pv = b.new_page(viewport={"width": 1280, "height": 720}); pv.goto(base.replace("index.html", "index.html?render=1&studio=" + tok)); pv.wait_for_function("window.CTT && CTT.ready === true", timeout=60000)
            yrs = pv.evaluate("CTT.years"); f0 = pv.evaluate("CTT.renderFrame(0)"); fl = pv.evaluate("CTT.renderFrame(CTT.frameCount - 1)")
            check("studio: frames step through published dates only (2016, 2021) and report what is on screen", yrs == [2016, 2021] and f0["year"] == 2016 and fl["year"] == 2021 and fl["phase"] == "outro" and "Sources and method" in pv.locator("#st-out").inner_text(), str(yrs))
            pv.close()
            cfg2 = _json.loads((ROOT / "timelapses/people-1971-2026.json").read_text()); tok2 = _b64.urlsafe_b64encode(_json.dumps(cfg2, ensure_ascii=False).encode()).decode().rstrip("=")
            pv = b.new_page(viewport={"width": 1280, "height": 720}); pv.goto(base.replace("index.html", "index.html?render=1&studio=" + tok2)); pv.wait_for_function("window.CTT && CTT.ready === true", timeout=60000)
            a = pv.evaluate("CTT.renderFrame(700)"); a2 = pv.evaluate("CTT.renderFrame(700)"); v1 = pv.evaluate("JSON.stringify(CTX.getView())"); pv.evaluate("CTT.renderFrame(40)"); pv.evaluate("CTT.renderFrame(700)"); v2 = pv.evaluate("JSON.stringify(CTX.getView())")
            raw_y = None
            for r in _csv.DictReader(_io.TextIOWrapper(z.open(nm), encoding="utf-8-sig")):
                if r["GEO"] == "Canada" and r["REF_DATE"] == f"{a['year']}-07-01": raw_y = int(float(r["VALUE"]))
            check("studio: a frame is reproducible (same frame number gives the same camera and text)", a == a2 and v1 == v2)
            check("studio: the figure on a rendered frame equals the raw file for that year", f"{raw_y:,}" in a["finding"], f"{a['year']}: {raw_y:,} | {a['finding'][:70]}")
            check("studio/story pages raised no script errors", not errs, str(errs[:2]))
            pv.close(); ps.close()
        if any(k in PAGE for k in ("final", "atlas", "signoff", "release", "studio")):
            ph = b.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
            ph.goto(base.replace(PAGE, PAGE + "?city=Toronto") + "#rent-2025"); ph.wait_for_function("window.READY === true", timeout=60000); ph.wait_for_timeout(800)
            box = """(() => { const v = CTX.getView(), vp = new deck.OrbitView({orbitAxis:'Z', fovy:38}).makeViewport({width: innerWidth, height: innerHeight, viewState: v});
              let b = [1e9,-1e9,1e9,-1e9]; for (const q of CTX.FIT_PTS) { const [x,y] = vp.project([q[0],q[1],0]); b = [Math.min(b[0],x), Math.max(b[1],x), Math.min(b[2],y), Math.max(b[3],y)]; }
              const c = CTX.CITIES.find(c => c.name === 'Toronto'), t = vp.project([...c.xy, 0]); return {b, t, sheet: document.getElementById('sheet').getBoundingClientRect().top}; })()"""
            r = ph.evaluate(box)
            check("phone: the whole country fits the screen width", r["b"][0] >= -2 and r["b"][1] <= 392, str([round(x) for x in r["b"]]))
            ph.evaluate("CTX.setSheet(1)"); ph.wait_for_timeout(900)
            r = ph.evaluate(box)
            check("phone: with the sheet half up the selected city stays above the sheet", r["t"][1] < r["sheet"] - 8, f"city y {round(r['t'][1])}, sheet top {round(r['sheet'])}")
            if ph.evaluate("typeof CTX.over === 'function'"):
                ph.evaluate("CTX.state.city=null; CTX.setSheet(0); CTX.state.m='pop'; CTX.state.y=2026; CTX.update()"); ph.wait_for_timeout(1200)
                r = ph.evaluate("(() => { const L = CTX.deck.layerManager.getLayers().find(l => l.id === 'val'); return { rx: CTX.getView().rotationX, n: L ? L.props.data.length : 0 }; })()")
                check("phone: people layer tilts so columns stand, and shows values", 45 <= r["rx"] <= 55 and r["n"] >= 8, str(r))
                ph.evaluate("CTX.state.m='inc'; CTX.state.y=2024; CTX.update()"); ph.wait_for_timeout(900)
                ab = ph.evaluate("(() => { const L = CTX.deck.layerManager.getLayers().find(l => l.id === 'abbr'); return L.props.data.map(d => L.props.getText(d)).filter(t => t.includes('▲')).join(','); })()")
                check("phone: over-scale territories are marked on the map and listed in the legend", "NT ▲" in ab and "NU ▲" in ab and "Above the colour scale" in ph.locator("#legend").inner_text(), ab)
            ph.close()
        b.close()
    srv.shutdown()
    bad = [n for n, ok in results if not ok]
    print(f"\n{len(results) - len(bad)}/{len(results)} passed")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
