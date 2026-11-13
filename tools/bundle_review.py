"""Bundle the explorer review build into one self-contained HTML file (data, fonts and deck.gl inlined).

Opens by double-click from disk (no server, no network), so it can be reviewed without publishing anything.

  python3 tools/bundle_review.py            # → dist/canada-through-time-explorer-review.html
  SRC=explore-qa OUT=canada-through-time-explorer-qa.html python3 tools/bundle_review.py
"""
import base64
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
import os
SRC = WEB / os.environ.get("SRC", "explore-next")
OUT = ROOT / "dist" / os.environ.get("OUT", "canada-through-time-explorer-review.html")


def main():
    html = (SRC / "index.html").read_text()
    css = (SRC / "explore.css").read_text()
    used = set(re.findall(r"url\(\.\./fonts/([^)]+)\)", css))
    for f in used:   # only the fonts the stylesheet actually references
        b64 = base64.b64encode((WEB / "fonts" / f).read_bytes()).decode()
        css = css.replace(f"url(../fonts/{f})", f"url(data:font/woff2;base64,{b64})")
    js = (SRC / "explore.js").read_text()
    extra = SRC / "cities.js"   # neighbourhood view (second module)
    cjs = extra.read_text() if extra.exists() and "cities.js" in html else ""
    paths = set(re.findall(r"J\('(\.\./data/[^']+)'\)", js + cjs))
    paths |= {f"../data/housing/{n}.json" for n in re.findall(r"\[('construction'[^\]]+)\]\.map\(n => J", js)[0].replace("'", "").split(", ")}
    if "../data/more/" in js:   # loaded by a template literal: include every file in that folder
        paths |= {f"../data/more/{f.name}" for f in (WEB / "data/more").glob("*.json")}
    data = {p: json.loads((SRC / p).resolve().read_text()) for p in sorted(paths)}
    for img in re.findall(r"'(\.\./data/[^']+\.png)'", js):   # images (shaded relief) go in as data URIs
        data[img] = "data:image/png;base64," + base64.b64encode((SRC / img).resolve().read_bytes()).decode()
    deck = (WEB / "vendor" / "deck.min.js").read_text().replace("</script", "<\\/script")
    js = js.replace("</script", "<\\/script")
    html = html.replace('<link rel="stylesheet" href="explore.css">', f"<style>\n{css}\n</style>")
    html = html.replace('<script src="../vendor/deck.min.js"></script>', f"<script>{deck}</script>\n<script>window.__DATA = {json.dumps(data, separators=(',', ':')).replace("</", "<\\/")};</script>")
    html = html.replace('<script type="module" src="explore.js"></script>', f'<script type="module">\n{js}\n</script>')
    if cjs:
        html = html.replace('<script type="module" src="cities.js"></script>', f'<script type="module">\n{cjs.replace("</script", "<\\/script")}\n</script>')
    assert "src=\"explore.js\"" not in html and "src=\"cities.js\"" not in html and "../vendor" not in html
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(html)
    print(f"{OUT.relative_to(ROOT)}: {OUT.stat().st_size / 1e6:.1f} MB · {len(data)} data files · {len(used)} fonts")


if __name__ == "__main__":
    main()
