"""Assemble the migration Short: add the original music bed, write captions/transcript from the frames log, key frames, safe-area preview, cover."""
import json, subprocess, shutil
from pathlib import Path
from PIL import Image, ImageDraw
import sys
ROOT = Path(__file__).resolve().parents[1]; ID = sys.argv[1]
E = ROOT / "exports/timelapses" / ID; OUT = ROOT / "exports" / sys.argv[2]; OUT.mkdir(exist_ok=True)
V = E / f"{ID}_1080x1920.mp4"; cfg = json.loads((E / "config.json").read_text()); log = json.loads((E / f"{ID}.frames.json").read_text()); fps = cfg["fps"]
dur = len(log) / fps
subprocess.run(["python3", str(ROOT / "tools/make_bed.py"), f"{dur:.3f}", str(OUT / "bed_raw.wav")], check=True)
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(OUT / "bed_raw.wav"), "-af", "loudnorm=I=-18:TP=-2:LRA=7", "-ar", "48000", str(OUT / "bed.wav")], check=True)
final = OUT / f"{ID}_1080x1920.mp4"
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(V), "-i", str(OUT / "bed.wav"), "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", str(final)], check=True)
ts = lambda f: "%02d:%02d:%02d,%03d" % (f // fps // 3600, f // fps // 60 % 60, f // fps % 60, round(f % fps * 1000 / fps))
def runs(key):
    out = []
    for r in log:
        v = key(r)
        if out and out[-1][0] == v: out[-1][2] = r["frame"] + 1
        else: out.append([v, r["frame"], r["frame"] + 1])
    return out
ph = {}
for p, a, b in runs(lambda r: r["phase"]): ph.setdefault(p, (a, b))
strip = lambda s: s.replace("<em>", "").replace("</em>", "")
cues = [(ph["intro"], " ".join(strip(h) for h in cfg["hook"]))]
cues += [((a, b), t) for t, a, b in runs(lambda r: r["annotation"]) if t]
sa, sb = ph["summary"]; items = cfg["summary"]["items"]; w = (sb - sa) / len(items)
cues += [((round(sa + i * w), round(sa + (i + 1) * w)), f"{cfg['summary']['title']}: {it['place']} {it['big']} ({it['text']}).") for i, it in enumerate(items)]
oa, ob = ph["outro"]; cues.append(((oa, ob), " ".join(l["text"] for l in cfg["outro_card"]["lines"] if l.get("cls") in ("src", "lim"))))
cues.sort(key=lambda c: c[0][0])
(OUT / f"{ID}.srt").write_text("".join(f"{i}\n{ts(a)} --> {ts(b)}\n{t}\n\n" for i, ((a, b), t) in enumerate(cues, 1)))
tr = ["# On-screen text transcript (no narration; original instrumental music)", ""] + [f"[{ts(a)[3:8]}–{ts(b)[3:8]}] {t}" for (a, b), t in cues]
tr += ["", "Between beats, the period counts from 1971–72 to 2024–25 and one sentence names the province with the largest net gain and the largest net loss that period."]
tr += [f"Outro card: {l['text']}" for l in cfg["outro_card"]["lines"]]
(OUT / "transcript.md").write_text("\n".join(tr) + "\n")
def frame(f, name):
    p = OUT / name; subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(V), "-vf", f"select=eq(n\\,{f})", "-vframes", "1", str(p)], check=True); return p
mid = lambda p: (ph[p][0] + ph[p][1]) // 2
beat_fr = [(a + b) // 2 for t, a, b in runs(lambda r: r["annotation"]) if t]
shots = [("opening", mid("intro") - 20), ("beat", beat_fr[0]), ("middle", (ph["run"][0] + ph["summary"][0]) // 2), ("summary", mid("summary") + 30), ("source", ph["outro"][1] - 30)]
ims = [Image.open(frame(f, f"frame_{n}.png")).convert("RGB") for n, f in shots]
shutil.copy(OUT / "frame_opening.png", OUT / "cover.png")
Z = dict(top=135, bottom=405, right=150)
def overlay(im):
    im = im.convert("RGBA"); o = Image.new("RGBA", im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(o); W, H = im.size
    d.rectangle([0, 0, W, Z["top"]], fill=(200, 40, 40, 70)); d.rectangle([0, H - Z["bottom"], W, H], fill=(200, 40, 40, 70)); d.rectangle([W - Z["right"], H // 2, W, H - Z["bottom"]], fill=(200, 120, 0, 70))
    d.rectangle([0, Z["top"], W - 1, H - Z["bottom"]], outline=(200, 40, 40, 255), width=3); return Image.alpha_composite(im, o).convert("RGB")
for name, f in (("key_frames.png", lambda im: im), ("safe_area_preview.png", overlay)):
    sheet = Image.new("RGB", (432 * len(ims), 768), "white")
    for i, im in enumerate(ims): sheet.paste(f(im).resize((432, 768)), (432 * i, 0))
    sheet.save(OUT / name)
for x in ("config.json", "sources.json"): shutil.copy(E / x, OUT / x)
print("\n".join(sorted(p.name for p in OUT.iterdir())))
