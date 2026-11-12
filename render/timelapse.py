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
        page.evaluate("CTT.renderFrame(0)"); page.wait_for_timeout(400)
        if a.stills:
            for fr in [int(x) for x in a.stills.split(",")]:
                page.evaluate(f"CTT.renderFrame({fr})"); path = out_dir / f"still_{fr:05d}.png"; page.screenshot(path=str(path)); print(path.relative_to(ROOT))
            b.close(); return
        log = []
        if a.log_only:
            log = [page.evaluate(f"CTT.renderFrame({fr})") for fr in range(n)]
        else:
            out = out_dir / f"{cfg['id']}_{'1080x1920' if vert else '1080p'}.mp4"; tmp = out.with_suffix(".partial.mp4")
            ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(fps), "-c:v", "mjpeg", "-i", "-", "-vf", f"scale={ow}:{oh}:flags=lanczos",
                                   "-c:v", "libx264", "-preset", "medium", "-crf", str(a.crf), "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-r", str(fps), str(tmp)], stdin=subprocess.PIPE)
            t0 = time.time()
            for fr in range(n):
                log.append(page.evaluate(f"CTT.renderFrame({fr})")); ff.stdin.write(page.screenshot(type="jpeg", quality=97))
                if fr == n - int(fps * cfg.get("outro", 5)) - 1: page.screenshot(path=str(out_dir / "poster.png"))
                if fr % 90 == 0: el = time.time() - t0; print(f"frame {fr}/{n}  {el:.0f}s elapsed  ~{el / max(fr, 1) * (n - fr):.0f}s left", flush=True)
            ff.stdin.close()
            if ff.wait() != 0: sys.exit("ffmpeg failed")
            tmp.replace(out); print(f"wrote {out.relative_to(ROOT)} ({n} frames, {time.time() - t0:.0f}s)")
        srcs = page.evaluate("CTX.M[CTT.config.layer].src"); b.close()
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
        "method": ("Each frame shows the published value for one year. No values are interpolated between years. Camera movement is the only continuous motion." if cfg.get("motion") == "stepped" else "Every printed figure (labels, sentence, year) is the published value for the year on screen. Column heights and fill colours move linearly between consecutive published years as animation only; each published value is reached exactly at the middle of its year's time slot. In-between positions are not estimates and are never printed. The frames log records which two years each frame sits between.")}, indent=1, ensure_ascii=False))
    print("package:", out_dir.relative_to(ROOT))

if __name__ == "__main__":
    main()
