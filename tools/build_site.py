"""Build the public website from web/explore-v2: a folder that any static host (GitHub Pages, Cloudflare Pages) can serve.

Unlike the single-file review bundle, nothing is inlined: the page loads only the national data at first, and each
section (neighbourhoods, climate, money) fetches its own files when it is opened. The app sits at the site root,
so the address is short and shareable.

    python tools/build_site.py            -> site/
Every data file the code references is copied (and must exist); nothing else from web/ is published.
"""
import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "web/explore-v2"
WEB = ROOT / "web"
OUT = ROOT / "site"
SITE_URL = "https://canadathroughtime.ca/"   # placeholder until the domain is chosen; only used in share-preview tags
TITLE = "Canada Through Time"
DESC = "People, places, money and climate: 55 years of official Canadian data on one map. Every number links back to its source."


def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    html = (SRC / "index.html").read_text()
    code = {p.name: p.read_text() for p in SRC.glob("*.js")}
    css = (SRC / "explore.css").read_text()

    # every data file the code asks for: J('../data/...') and template forms like `../data/more/${n}.json`
    refs = set()
    for src in list(code.values()) + [html]:
        refs |= set(re.findall(r"['`\"](\.\./data/[^'`\"$]+?\.(?:json|geojson|png))['`\"]", src))
        for tmpl, names in re.findall(r"\[([^\]]+)\]\.map\(n => J\(`(\.\./data/[^`]+)\$\{n\}\.json`\)\)", src):
            pass
    for m in re.finditer(r"\[((?:'[a-z_]+',?\s*)+)\]\.map\(n => J\(`(\.\./data/[^`$]+)\$\{n\}\.json`\)\)", "".join(code.values())):
        for n in re.findall(r"'([a-z_]+)'", m.group(1)):
            refs.add(f"{m.group(2)}{n}.json")
    missing = [r for r in refs if not (WEB / r[3:]).exists()]
    assert not missing, missing
    for r in sorted(refs):
        dst = OUT / r[3:]
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(WEB / r[3:], dst)

    # fonts used by the stylesheet
    for f in set(re.findall(r"url\(\.\./fonts/([^)]+)\)", css)):
        (OUT / "fonts").mkdir(exist_ok=True)
        shutil.copy2(WEB / "fonts" / f, OUT / "fonts" / f)
    (OUT / "vendor").mkdir()
    shutil.copy2(WEB / "vendor/deck.min.js", OUT / "vendor/deck.min.js")

    # the app at the root: data paths resolve against "." instead of ".."
    css = css.replace("url(../fonts/", "url(fonts/")
    html = html.replace("<html", '<html data-base="."', 1).replace('src="../vendor/', 'src="vendor/')
    assert "../" not in re.sub(r"<!--.*?-->", "", html, flags=re.S), "a ../ path is left in index.html"
    meta = f"""<meta name="description" content="{DESC}">
<meta property="og:type" content="website"><meta property="og:title" content="{TITLE}"><meta property="og:description" content="{DESC}">
<meta property="og:url" content="{SITE_URL}"><meta property="og:image" content="{SITE_URL}share.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:site" content="@CanadaAnalytics"><meta name="twitter:image" content="{SITE_URL}share.png">
<link rel="icon" href="favicon.svg" type="image/svg+xml">"""
    html = html.replace("</head>", meta + "\n</head>", 1)
    (OUT / "index.html").write_text(html)
    (OUT / "explore.css").write_text(css)
    for name, src in code.items():
        (OUT / name).write_text(src)
    # favicon: the three rising bars from the top bar
    (OUT / "favicon.svg").write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#23201a"/><rect x="7" y="17" width="5" height="9" rx="1.5" fill="#c4512f" opacity=".7"/><rect x="13.5" y="11" width="5" height="15" rx="1.5" fill="#c4512f" opacity=".85"/><rect x="20" y="5" width="5" height="21" rx="1.5" fill="#c4512f"/></svg>')
    (OUT / ".nojekyll").write_text("")   # GitHub Pages: serve files as they are
    if (ROOT / "dist/share.png").exists():
        shutil.copy2(ROOT / "dist/share.png", OUT / "share.png")
    size = sum(p.stat().st_size for p in OUT.rglob("*") if p.is_file())
    first = sum((OUT / r[3:]).stat().st_size for r in refs if not re.search(r"/(cities|climate|money)/", r))
    print(f"site/: {len(refs)} data files, {size / 1e6:.1f} MB in all; national view loads about {first / 1e6:.1f} MB of data, sections load theirs when opened")


if __name__ == "__main__":
    main()
