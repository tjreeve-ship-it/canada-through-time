"""Timelapse Studio export: one configuration file in, one reproducible video package out (1920x1080, or 1080x1920 when the configuration says format 9x16).

  python3 render/timelapse.py timelapses/people-1971-2026.json            # full export
  python3 render/timelapse.py timelapses/people-1971-2026.json --stills 0,300,1200
  python3 render/timelapse.py <config> --build explore-studio --log-only   # on-screen text for every frame, no video

Drives the real explorer page in headless Chrome. Every frame is produced by the page's own renderFrame(n), which shows
only published annual values (no interpolation between years). Output folder exports/timelapses/<id>/ contains:
  <id>_1080p.mp4, <id>.frames.json (title, year, finding and note shown on every frame), config.json (exact input),
  sources.json (registry entries, raw-file fingerprints and code revision), poster.png.
"""
from __future__ import annotations
import argparse, base64, functools, hashlib, http.server, json, subprocess, sys, threading, time
from pathlib import Path
import yaml
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parent.parent
CHROME = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl", "--disable-background-timer-throttling", "--font-render-hinting=none"]
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

def main() -> None:
    ap = argparse.ArgumentParser(); ap.add_argument("config"); ap.add_argument("--build", default="explore-studio"); ap.add_argument("--stills"); ap.add_argument("--log-only", action="store_true")
    ap.add_argument("--crf", type=int, default=17); ap.add_argument("--css-width", type=int, default=1280, help="layout width; output is always 1920x1080")
    ap.add_argument("--workers", type=int, default=2, help="browsers rendering in parallel; frames depend only on their number, so the result is the same")
    ap.add_argument("--range", help=argparse.SUPPRESS); ap.add_argument("--bitrate", default="8M", help="video bitrate ceiling target (platforms recommend 5-10 Mbps)")
    a = ap.parse_args()
    cfg = json.loads(Path(a.config).read_text()); out_dir = ROOT / "exports" / "timelapses" / cfg["id"]; out_dir.mkdir(parents=True, exist_ok=True)
    token = base64.urlsafe_b64encode(json.dumps(cfg, ensure_ascii=False).encode()).decode().rstrip("=")
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(ROOT / "web"))); threading.Thread(target=srv.serve_forever, daemon=True).start()
    vert = cfg.get("format") == "9x16"
    cw, ch, ow, oh = (720, 1280, 1080, 1920) if vert else (a.css_width, a.css_width * 9 // 16, 1920, 1080); scale = ow / cw
    url = f"http://127.0.0.1:{srv.server_address[1]}/{a.build}/index.html?studio={token}&render=1&p={cfg.get('theme', 'ember')}&tx={cfg.get('surface', 'relief')}"
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=CHROME)
        page = b.new_page(viewport={"width": cw, "height": ch}, device_scale_factor=scale); errors: list[str] = []
        page.on("pageerror", lambda e: errors.append(str(e))); page.on("console", lambda m: m.type == "error" and errors.append(m.text))
        page.goto(url); page.wait_for_function("window.CTT && window.CTT.ready === true", timeout=120_000)
        if errors: sys.exit("Page errors:\n" + "\n".join(errors))
        n, fps = page.evaluate("CTT.frameCount"), page.evaluate("CTT.fps")
        RAF = "new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))"   # deck draws once on the next animation frame; wait for it before the screenshot
        page.evaluate("CTT.renderFrame(0)"); page.wait_for_timeout(400)
        if a.stills:
            for fr in [int(x) for x in a.stills.split(",")]:
                page.evaluate(f"CTT.renderFrame({fr})"); page.evaluate(RAF); path = out_dir / f"still_{fr:05d}.png"; page.screenshot(path=str(path)); print(path.relative_to(ROOT))
            b.close(); return
        log = []
        if a.log_only:
            log = [page.evaluate(f"CTT.renderFrame({fr})") for fr in range(n)]
        else:
            out = out_dir / f"{cfg['id']}_{'1080x1920' if vert else '1080p'}.mp4"; tmp = out.with_suffix(".partial.mp4")
            enc = ["-vf", f"scale={ow}:{oh}:flags=lanczos", "-c:v", "libx264", "-preset", "medium", "-b:v", a.bitrate, "-maxrate", "10M", "-bufsize", "16M", "-x264-params", "keyint=30:scenecut=0", "-pix_fmt", "yuv420p", "-r", str(fps)]
            poster_frame = n - int(fps * (cfg.get("outro", 5) + (cfg.get("summary") or {}).get("seconds", 0) / 2)) - 1 if cfg.get("summary") else n - int(fps * cfg.get("outro", 5)) - 1
            def encode(lo, hi, dest):
                ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(fps), "-c:v", "mjpeg", "-i", "-", *enc, str(dest)], stdin=subprocess.PIPE); t0 = time.time(); lg = []
                for fr in range(lo, hi):
                    lg.append(page.evaluate(f"CTT.renderFrame({fr})")); page.evaluate(RAF); ff.stdin.write(page.screenshot(type="jpeg", quality=97))
                    if fr == poster_frame: page.screenshot(path=str(out_dir / "poster.png"))
                    if (fr - lo) % 90 == 0: el = time.time() - t0; print(f"frame {fr} of {lo}-{hi}  {el:.0f}s elapsed  ~{el / max(fr - lo, 1) * (hi - fr):.0f}s left", flush=True)
                ff.stdin.close()
                if ff.wait() != 0: sys.exit("ffmpeg failed")
                return lg
            if a.range:   # worker: one slice of frames to a segment file plus its log
                lo, hi = map(int, a.range.split("-")); seg = out_dir / f"seg_{lo:05d}.mp4"; lg = encode(lo, hi, seg); (out_dir / f"seg_{lo:05d}.json").write_text(json.dumps(lg)); b.close(); return
            t0 = time.time(); w = max(1, min(a.workers, n // 60 or 1))
            if w == 1: log = encode(0, n, tmp)
            else:
                b.close(); cuts = [round(n * k / w) for k in range(w + 1)]
                procs = [subprocess.Popen([sys.executable, __file__, a.config, "--build", a.build, "--crf", str(a.crf), "--bitrate", a.bitrate, "--css-width", str(a.css_width), "--range", f"{cuts[k]}-{cuts[k + 1]}"], stdout=(sys.stdout if k == 0 else subprocess.DEVNULL)) for k in range(w)]
                if any(pr.wait() != 0 for pr in procs): sys.exit("a render worker failed")
                segs = [out_dir / f"seg_{cuts[k]:05d}.mp4" for k in range(w)]; lst = out_dir / "segments.txt"; lst.write_text("".join(f"file '{x.name}'\n" for x in segs))
                subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(tmp)], check=True, cwd=out_dir)
                for x in segs: log += json.loads(x.with_suffix(".json").read_text()); x.unlink(); x.with_suffix(".json").unlink()
                lst.unlink(); b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=CHROME); page = b.new_page(viewport={"width": cw, "height": ch}, device_scale_factor=scale); page.goto(url); page.wait_for_function("window.CTT && window.CTT.ready === true", timeout=120_000)
            fin = out.with_suffix(".fs.mp4"); subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(tmp), "-c", "copy", "-movflags", "+faststart", str(fin)], check=True); tmp.unlink(); fin.replace(out)
            print(f"wrote {out.relative_to(ROOT)} ({n} frames, {time.time() - t0:.0f}s, {w} worker{'s' if w > 1 else ''})")
        srcs = cfg.get("sources") or page.evaluate("CTX.M[CTT.config.layer].src"); b.close()   # a standalone Short names its sources in the configuration
    if errors: print("WARNING page errors during render:\n" + "\n".join(errors[:5]))
    (out_dir / f"{cfg['id']}.frames.json").write_text(json.dumps(log))
    (out_dir / "config.json").write_text(json.dumps(cfg, indent=1, ensure_ascii=False))
    reg = yaml.safe_load((ROOT / "registry/sources.yaml").read_text())["sources"]
    sha = lambda f: hashlib.sha256((ROOT / f).read_bytes()).hexdigest()
    rev = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True, cwd=ROOT).stdout.strip()
    dirty = bool(subprocess.run(["git", "status", "--porcelain", f"web/{a.build}", "web/data"], capture_output=True, text=True, cwd=ROOT).stdout.strip())
    (out_dir / "sources.json").write_text(json.dumps({"timelapse": cfg["id"], "build": a.build, "code_revision": rev, "uncommitted_changes_in_build_or_data": dirty, "frames": n, "fps": fps, "format": cfg.get("format", "16x9"), "pixels": [ow, oh],
        "build_files": {f: sha(f"web/{a.build}/{f}") for f in ("explore.js", "explore.css", "index.html")},
        "sources": {s: {k: reg[s].get(k) for k in ("title", "publisher", "table_id", "landing_url", "licence", "retrieved", "sha256", "limitations")} for s in srcs},
        "method": cfg.get("method") or ("Each frame shows the published value for one year. No values are interpolated between years. Camera movement is the only continuous motion." if cfg.get("motion") == "stepped" else "Every printed figure (labels, sentence, year) is the published value for the year on screen. Column heights and fill colours move linearly between consecutive published years as animation only; each published value is reached exactly at the middle of its year's time slot. In-between positions are not estimates and are never printed. The frames log records which two years each frame sits between.")}, indent=1, ensure_ascii=False))
    print("package:", out_dir.relative_to(ROOT))

if __name__ == "__main__":
    main()
