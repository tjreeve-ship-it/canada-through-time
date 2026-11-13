"""Assemble the review package for the Short from the rendered export: on-screen-text captions, transcript, cover, safe-area preview, key frames."""
import json, subprocess, shutil
from pathlib import Path
from PIL import Image, ImageDraw
ROOT = Path(__file__).resolve().parents[1]; ID = "short-where-canadians-live"
E = ROOT / "exports/timelapses" / ID; OUT = ROOT / "exports/short-pilot"; OUT.mkdir(exist_ok=True)
V = E / f"{ID}_1080x1920.mp4"; cfg = json.loads((E / "config.json").read_text()); log = json.loads((E / f"{ID}.frames.json").read_text()); fps = cfg["fps"]
ts = lambda f: "%02d:%02d:%02d,%03d" % (f // fps // 3600, f // fps // 60 % 60, f // fps % 60, round(f % fps * 1000 / fps))
def runs(key):
    out, cur = [], None
    for r in log:
        v = key(r)
        if cur and cur[0] == v: cur[2] = r["frame"] + 1
        else: cur = [v, r["frame"], r["frame"] + 1]; out.append(cur)
    return [c for c in out if c[0]]
ph = {p: (a, b) for p, a, b in runs(lambda r: r["phase"])}
cues = [(ph["intro"], " ".join(cfg["hook"]))]
cues += [((a, b), t) for t, a, b in runs(lambda r: r["annotation"])]
cues += [(ph["summary"], it["kicker"] + ": " + it["big"] + ". " + it["text"]) for it in cfg["summary"]["items"]]
cues.append((ph["outro"], f"Source: Statistics Canada, table 17-10-0009-01. July 1 estimates; 2026 is preliminary. {cfg['limit']}"))
# the three takeaways share the summary window: split it evenly so each caption is on screen long enough to read
(sa, sb) = ph["summary"]; n = len(cfg["summary"]["items"]); k = 0; fixed = []
for (a, b), t in cues:
    if (a, b) == (sa, sb): w = (sb - sa) / n; fixed.append(((round(sa + k * w), round(sa + (k + 1) * w)), t)); k += 1
    else: fixed.append(((a, b), t))
fixed.sort(key=lambda c: c[0][0])
(OUT / f"{ID}.srt").write_text("".join(f"{i}\n{ts(a)} --> {ts(b)}\n{t}\n\n" for i, ((a, b), t) in enumerate(fixed, 1)))
years = [r for r in log if r["phase"] == "run"]; first, last = years[0], years[-1]
tr = ["# On-screen text transcript (no narration)", "", f"Title, all the way through: {cfg['title']}", ""]
tr += [f"[{ts(a)[3:8]}–{ts(b)[3:8]}] {t}" for (a, b), t in fixed]
tr += ["", f"During {ts(ph['run'][0])[3:8]}–{ts(ph['run'][1])[3:8]} the year counts from {first['year']} to {last['year']} and one sentence updates each year.", f"First: {first['finding']}", f"Last: {last['finding']}",
       "", "On screen throughout: Source: Statistics Canada, table 17-10-0009-01. Every figure shown is a published annual value. Movement between years is animation. · The Canadian Data Project"]
(OUT / "transcript.md").write_text("\n".join(tr) + "\n")
def frame(f, name):
    p = OUT / name; subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(V), "-vf", f"select=eq(n\\,{f})", "-vframes", "1", str(p)], check=True); return p
mid = lambda p: (ph[p][0] + ph[p][1]) // 2
shots = [("opening", mid("intro")), ("middle", mid("run")), ("summary", mid("summary")), ("source", mid("outro"))]
ims = [Image.open(frame(f, f"frame_{n}.png")).convert("RGB") for n, f in shots]
shutil.copy(OUT / "frame_opening.png", OUT / "cover.png")
# Safe-area preview. These zones are this project's working assumption (the build's own layout margins), NOT official platform figures.
Z = dict(top=135, bottom=405, right=150)
def overlay(im):
    im = im.convert("RGBA"); o = Image.new("RGBA", im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(o); W, H = im.size
    d.rectangle([0, 0, W, Z["top"]], fill=(200, 40, 40, 70)); d.rectangle([0, H - Z["bottom"], W, H], fill=(200, 40, 40, 70)); d.rectangle([W - Z["right"], H // 2, W, H - Z["bottom"]], fill=(200, 120, 0, 70))
    d.rectangle([0, Z["top"], W - 1, H - Z["bottom"]], outline=(200, 40, 40, 255), width=3)
    return Image.alpha_composite(im, o).convert("RGB")
sheet = Image.new("RGB", (540 * 4, 960), "white")
for i, im in enumerate(ims): sheet.paste(im.resize((540, 960)), (540 * i, 0))
sheet.save(OUT / "key_frames.png")
safe = Image.new("RGB", (540 * 4, 960), "white")
for i, im in enumerate(ims): safe.paste(overlay(im).resize((540, 960)), (540 * i, 0))
safe.save(OUT / "safe_area_preview.png")
shutil.copy(V, OUT / V.name); shutil.copy(E / "config.json", OUT / "config.json"); shutil.copy(E / "sources.json", OUT / "sources.json")
print("\n".join(sorted(p.name for p in OUT.iterdir()))); print((OUT / f"{ID}.srt").read_text())
