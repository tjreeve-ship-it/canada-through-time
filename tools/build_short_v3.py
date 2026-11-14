"""Package a v3 Short: music bed + sound effects placed from the page's own cue log, captions and transcript from the
frames log, key frames, safe-area preview, loop check.

  python3 tools/build_short_v3.py <timelapse-id> <exports-subdir>
"""
import json
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ID, SUB = sys.argv[1], sys.argv[2]
E = ROOT / "exports/timelapses" / ID; OUT = ROOT / "exports" / SUB; OUT.mkdir(parents=True, exist_ok=True)
V = E / f"{ID}_1080x1920.mp4"
cfg = json.loads((E / "config.json").read_text()); log = json.loads((E / f"{ID}.frames.json").read_text()); fps = cfg["fps"]
dur = len(log) / fps
run = lambda *a: subprocess.run(list(a), check=True)

# ---- audio: bed (quieter under effects) + effects at the frames the page flagged
# audio style: "calm" (default since Nov 2026: pad bed, soft knocks, no bright dings) or "lofi" (the original v3 mix)
STYLE = cfg.get("audio", "calm")
run("python3", str(ROOT / ("tools/make_bed_calm.py" if STYLE == "calm" else "tools/make_bed.py")), f"{dur:.3f}", str(OUT / "bed_raw.wav"))
run("python3", str(ROOT / "tools/make_sfx.py"), str(OUT / "sfx"))
cues = [(r["frame"], r["cue"]) for r in log if r.get("cue")]
GAIN = {"tick": 0.30, "riser": 0.55, "hit": 0.85}
FILE = {"tick": "tick", "riser": "riser", "hit": "hit"}
if STYLE == "calm":
    GAIN = {"tick": 0.0, "riser": 0.12, "hit": 0.35}     # no per-year ticks; a quiet swell and a soft low bloom on reveals
    FILE = {"tick": "soft_tick", "riser": "swell", "hit": "soft_hit"}
def load(p):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(p), "-f", "f32le", "-ac", "2", "-ar", "48000", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2)
bed = load(OUT / "bed_raw.wav"); bed = bed / max(1e-9, np.abs(bed).max()) * (0.32 if STYLE == "calm" else 0.5)
mix = bed.copy()
sfx = {k: load(OUT / "sfx" / f"{FILE[k]}.wav") for k in GAIN}
for fr, kind in cues:
    x = sfx[kind] * GAIN[kind]; i0 = int(fr / fps * 48000)
    if kind == "riser": i0 = max(0, i0)            # the page flags the riser where it should start
    n = min(len(x), len(mix) - i0)
    if n > 0: mix[i0:i0 + n] += x[:n]
    if kind == "hit":                              # duck the bed under the hit
        d = min(int(1.2 * 48000), len(mix) - i0); mix[i0:i0 + d] -= bed[i0:i0 + d] * np.linspace(0.6, 0, d)[:, None]
# loop: fade the last 0.25 s into the first 0.25 s level so the audio seam is soft
k = int(0.25 * 48000); mix[-k:] *= np.linspace(1, 0.35, k)[:, None]; mix[:k] *= np.linspace(0.35, 1, k)[:, None]
(OUT / "mix_raw.f32").write_bytes(mix.astype(np.float32).tobytes())
run("ffmpeg", "-y", "-v", "error", "-f", "f32le", "-ar", "48000", "-ac", "2", "-i", str(OUT / "mix_raw.f32"), "-af", "loudnorm=I=-21:TP=-3:LRA=7" if STYLE == "calm" else "loudnorm=I=-16:TP=-1.5:LRA=9", "-ar", "48000", str(OUT / "mix.wav"))
(OUT / "mix_raw.f32").unlink()
final = OUT / f"{ID}_1080x1920.mp4"
run("ffmpeg", "-y", "-v", "error", "-i", str(V), "-i", str(OUT / "mix.wav"), "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", str(final))

# ---- captions / transcript from the log
ts = lambda f: "%02d:%02d:%02d,%03d" % (f // fps // 3600, f // fps // 60 % 60, f // fps % 60, round(f % fps * 1000 / fps))
def runs(key):
    out = []
    for r in log:
        v = key(r)
        if out and out[-1][0] == v: out[-1][2] = r["frame"] + 1
        else: out.append([v, r["frame"], r["frame"] + 1])
    return out
strip = lambda s: __import__("re").sub(r"<[^>]+>", "", s)
caps = [((0, round(cfg["hook"]["seconds"] * fps)), strip(cfg["hook"]["question"]))]
caps += [((a, b), t) for t, a, b in runs(lambda r: r["annotation"]) if t]
caps.sort(key=lambda c: c[0][0])
(OUT / f"{ID}.srt").write_text("".join(f"{i}\n{ts(a)} --> {ts(b)}\n{t}\n\n" for i, ((a, b), t) in enumerate(caps, 1)))
tr = ["# On-screen text transcript (no narration; original music and sound effects)", ""] + [f"[{ts(a)[3:8]}–{ts(b)[3:8]}] {t}" for (a, b), t in caps]
tr += ["", cfg.get("between") or f"Between cards, the year counts up and the #1 {cfg.get('noun', 'country')} and its published value for that year are shown.", f"Footer: {strip(cfg['note'])}",
       "", "Sound cues (frame: kind): " + ", ".join(f"{f}: {k}" for f, k in cues)]
(OUT / "transcript.md").write_text("\n".join(tr) + "\n")

# ---- frames: key frames, safe-area preview, loop check
def frame(f, name):
    p = OUT / name; run("ffmpeg", "-y", "-loglevel", "error", "-i", str(V), "-vf", f"select=eq(n\\,{f})", "-vframes", "1", str(p)); return p
beat_fr = [(a + b) // 2 for t, a, b in runs(lambda r: r["annotation"]) if t]
n = len(log)
shots = [("opening", 0), ("early", int(1.5 * fps)), *[(f"beat{i}", f) for i, f in enumerate(beat_fr)], ("last", n - 1)]
ims = [Image.open(frame(f, f"frame_{nm}.png")).convert("RGB") for nm, f in shots]
shutil.copy(OUT / "frame_opening.png", OUT / "cover.png")
a = np.asarray(ims[0], float); b = np.asarray(ims[-1], float); loop_diff = float(np.abs(a - b).mean())
Z = dict(top=135, bottom=405, right=150)
def overlay(im):
    im = im.convert("RGBA"); o = Image.new("RGBA", im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(o); W, H = im.size
    d.rectangle([0, 0, W, Z["top"]], fill=(200, 40, 40, 70)); d.rectangle([0, H - Z["bottom"], W, H], fill=(200, 40, 40, 70)); d.rectangle([W - Z["right"], H // 2, W, H - Z["bottom"]], fill=(200, 120, 0, 70))
    return Image.alpha_composite(im, o).convert("RGB")
for name, fn in (("key_frames.png", lambda im: im), ("safe_area_preview.png", overlay)):
    sheet = Image.new("RGB", (360 * len(ims), 640), "white")
    for i, im in enumerate(ims): sheet.paste(fn(im).resize((360, 640)), (360 * i, 0))
    sheet.save(OUT / name)
for x in ("config.json", "sources.json"): shutil.copy(E / x, OUT / x)
print(f"duration {dur:.1f}s · cues {len(cues)} ({', '.join(sorted(set(k for _, k in cues)))}) · loop seam mean pixel diff {loop_diff:.2f}")
print("\n".join(sorted(p.name for p in OUT.iterdir())))
