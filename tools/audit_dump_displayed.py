"""Dump every value the explorer would display (all layers, places, years) by asking the running page itself.
usage: python3 tools/audit_dump_displayed.py explore-signoff audit/displayed.json"""
import sys, json, functools, http.server, threading
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]
build, out = sys.argv[1], sys.argv[2]
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Q, directory=str(ROOT / "web")))
threading.Thread(target=srv.serve_forever, daemon=True).start()
JS = """(() => { const G = ['CAN','NL','PE','NS','NB','QC','ON','MB','SK','AB','BC','YT','NT','NU','NT+NU'], out = { layers: {}, meta: {}, cities: {} };
  for (const m of Object.values(CTX.M)) { const o = {}; out.meta[m.id] = { label: m.label, kind: m.kind, years: m.years, only: m.only || null, unit: m.unit, src: m.src, tag: m.tag, rng: m.rng || null };
    if (m.kind === 'party') continue;
    for (const g of G) for (let y = m.years[0]; y <= m.years[1]; y++) { if (m.only && !m.only.includes(y)) continue; let v = null; try { v = m.value(g, y); } catch (e) { v = 'ERR'; } if (v != null) o[g + '|' + y] = v; }
    out.layers[m.id] = o; }
  out.cities = CTX.CITIES.map(c => ({ name: c.name, geo: c.geo, mapped: !!c.xy, vacancy: c.vacancy, rent2br: c.rent2br, rent2br_status: c.rent2br_status }));
  return out; })()"""
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": 1440, "height": 900})
    pg.goto(f"http://127.0.0.1:{srv.server_address[1]}/{build}/index.html"); pg.wait_for_function("window.READY === true", timeout=60000)
    d = pg.evaluate(JS); b.close()
Path(out).write_text(json.dumps(d))
print({k: len(v) for k, v in d["layers"].items()}, len(d["cities"]), "cities")
