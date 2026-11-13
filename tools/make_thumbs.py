"""Thumbnails / covers for the Shorts: a clean map frame from the video's own page (story text hidden) under one big number.
Usage: make_thumbs.py  (writes exports/<dir>/thumb_vertical.png and thumb_landscape.png for each entry below)"""
import json, base64, functools, http.server, threading, sys, urllib.parse
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]; sys.path.insert(0, str(ROOT / "render")); import timelapse as T
JOBS = [
  dict(cfg="timelapses/short-who-moved-where.json", build="short-migration", frame=1300, out="short-migration", kicker="Who moved where", big="700,000+", line="people gained by B.C. and by Alberta from the rest of Canada since 1971"),
  dict(cfg="timelapses/short-where-canadians-live-v2.json", build="short-population", frame=1150, out="short-population-v2", kicker="Where Canadians live", big="+19.8M", line="people added to Canada since 1971"),
  dict(cfg="timelapses/short-canada-getting-older.json", build="short-aging", frame=1100, out="short-aging", kicker="Canada is getting older", big="2016", line="the first year Canada had more seniors than kids"),
  dict(cfg="timelapses/short-where-growth-came-from.json", build="short-growth", frame=0, at="(()=>{const h=CTX.SEG.find(s=>s.kind==='hold'),s=CTX.SEG.find(s=>s.kind==='run'&&s.k===h.k-1&&s.u1===s.k);return s.f0+s.n-1})()", out="short-growth", kicker="Where growth came from", big="92%", line="of Canada's growth in 2024–25 came from international migration"),
]
import sys
if len(sys.argv) > 1: JOBS = [j for j in JOBS if j["out"] in sys.argv[1:]]
HIDE = "#top,#hook,#beat,#summary,#outro,#race,#credit,#legend{display:none!important}"
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(T.Quiet, directory=str(ROOT / "web"))); threading.Thread(target=srv.serve_forever, daemon=True).start()
base = f"http://127.0.0.1:{srv.server_address[1]}"
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=T.CHROME)
    for j in JOBS:
        cfg = json.loads((ROOT / j["cfg"]).read_text()); tok = base64.urlsafe_b64encode(json.dumps(cfg, ensure_ascii=False).encode()).decode().rstrip("=")
        pg = b.new_page(viewport={"width": 720, "height": 1280}, device_scale_factor=1.5)
        pg.goto(f"{base}/{j['build']}/index.html?studio={tok}&render=1"); pg.wait_for_function("window.CTT && CTT.ready", timeout=120000)
        pg.add_style_tag(content=HIDE); fr = pg.evaluate(j.get("at") or "CTX.SEG.find(s => s.kind === 'hold').f0 + 4"); pg.evaluate(f"CTT.renderFrame({fr})"); pg.evaluate("new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))")
        bgp = ROOT / "web/thumbs" / f"bg_{j['out']}.png"; pg.screenshot(path=str(bgp)); pg.close()
        t = dict(bg=bgp.name, kicker=j["kicker"], big=j["big"], line=j["line"]); q = urllib.parse.quote(json.dumps(t))
        for f, (w, h), name in (("v", (1080, 1920), "thumb_vertical.png"), ("h", (1280, 720), "thumb_landscape.png")):
            tp = b.new_page(viewport={"width": w, "height": h}); tp.goto(f"{base}/thumbs/index.html?f={f}&t={q}"); tp.wait_for_function("window.READY === true", timeout=30000)
            out = ROOT / "exports" / j["out"] / name; out.parent.mkdir(parents=True, exist_ok=True); tp.screenshot(path=str(out)); tp.close(); print(out.relative_to(ROOT))
