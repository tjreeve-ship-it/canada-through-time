"""Pictures for the search pages (site/cities/*, site/topics/*), drawn by the explorer itself.

City and climate pictures use the explorer's own "Save picture" (window.SHARE.picture), so they match what visitors see.
Money pictures are screenshots of the top of each dashboard tab. Output: dist/page-img/*.jpg (kept between builds).

    python tools/make_page_images.py [--base http://localhost:8766/] [--only edmonton,calgary]
Needs the built site served at --base (python -m http.server in site/).
"""
import argparse
import base64
import json
import re
import unicodedata
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "dist/page-img"


def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s.replace(" / grand sudbury", "")).strip("-")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8766/")
    ap.add_argument("--only", default="")
    a = ap.parse_args()
    only = set(filter(None, a.only.split(",")))
    OUT.mkdir(parents=True, exist_ok=True)
    idx = json.loads((ROOT / "web/data/cities/cma_index.json").read_text())["cities"]
    jobs = [(f"city-{slug(n)}", f"#nb={code}/hhinc") for code, (n, _) in idx.items()]
    jobs += [("topic-climate-warming", "#cl=temp/2020"), ("topic-glaciers", "#cl=ice/2020")]
    shots = [("topic-federal-spending", "#mn=spend/2026"), ("topic-federal-grants", "#mn=grants/all"), ("topic-federal-contracts", "#mn=contracts/all")]
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
        pg = b.new_page(viewport={"width": 1440, "height": 900})
        pg.add_init_script("window.SHARE_HOST='tjreeve-ship-it.github.io/canada-through-time';try{localStorage.setItem('ctt-home-seen','1');['map','nb','cl','mn'].forEach(k=>localStorage.setItem('ctt-tour-'+k,'1'))}catch(e){}")
        for name, h in jobs:
            if only and not any(o in name for o in only):
                continue
            pg.goto("about:blank"); pg.goto(a.base + h); pg.wait_for_timeout(6500)
            data = pg.evaluate("""async () => { const c = await window.SHARE.picture(window.SHARE.current());
                const o = document.createElement('canvas'); o.width = 1200; o.height = 750; o.getContext('2d').drawImage(c, 0, 0, 1200, 750);
                return o.toDataURL('image/jpeg', 0.84); }""")
            (OUT / f"{name}.jpg").write_bytes(base64.b64decode(data.split(",", 1)[1]))
            print(name, (OUT / f"{name}.jpg").stat().st_size // 1000, "KB")
        for name, h in shots:
            if only and not any(o in name for o in only):
                continue
            pg.goto("about:blank"); pg.goto(a.base + h); pg.wait_for_timeout(5000)
            box = pg.evaluate("(() => { const a = document.querySelector('#mn-body .mhero').getBoundingClientRect(), b = document.querySelector('#mn-body .card.wide').getBoundingClientRect(); return { x: a.x, y: a.y, width: a.width, height: Math.min(b.bottom - a.y, 760) }; })()")
            pg.screenshot(path=str(OUT / f"{name}.jpg"), type="jpeg", quality=84, clip=box)
            print(name, (OUT / f"{name}.jpg").stat().st_size // 1000, "KB")
        b.close()


if __name__ == "__main__":
    main()
