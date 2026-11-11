"""Frame-exact timelapse renderer.

Drives the real map (web/index.html) in headless Chrome, captures every frame and
pipes it into ffmpeg. The video is a true render of the visualization: each frame is
produced by the same render(frame) function the interactive explorer uses.

  python3 render/render.py --story population-provinces-1971-2026 --fmt 16x9
  python3 render/render.py --story ... --fmt 9x16 --scale 2        # 4K-class output
  python3 render/render.py --story ... --stills 0,600,1019         # PNG checks only
"""
from __future__ import annotations

import argparse
import functools
import http.server
import json
import subprocess
import sys
import threading
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
CHROME_ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist",
               "--enable-webgl", "--disable-background-timer-throttling", "--font-render-hinting=none"]


def serve(port: int) -> http.server.ThreadingHTTPServer:
    handler = functools.partial(QuietHandler, directory=str(WEB))
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):  # keep render logs readable
        pass


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--story", required=True)
    ap.add_argument("--fmt", default="16x9", choices=["16x9", "9x16", "1x1"])
    ap.add_argument("--scale", type=float, default=1.0)
    ap.add_argument("--out", default=None)
    ap.add_argument("--stills", default=None, help="comma-separated frame numbers to save as PNG instead of video")
    ap.add_argument("--crf", type=int, default=18)
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--page", default="index.html", help="e.g. v2/index.html")
    ap.add_argument("--extra", default="", help="extra query string, e.g. safe=1")
    ap.add_argument("--tag", default="")
    a = ap.parse_args()

    story = json.loads((WEB / "stories" / f"{a.story}.json").read_text())
    f = story["formats"][a.fmt]
    w, h = int(f["width"] * a.scale), int(f["height"] * a.scale)
    out_dir = ROOT / "exports" / a.story
    out_dir.mkdir(parents=True, exist_ok=True)

    httpd = serve(a.port)
    url = f"http://127.0.0.1:{a.port}/{a.page}?render=1&story={a.story}&fmt={a.fmt}&scale={a.scale}&{a.extra}"
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=CHROME_ARGS)
        page = browser.new_page(viewport={"width": w, "height": h}, device_scale_factor=1)
        errors: list[str] = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: m.type == "error" and errors.append(m.text))
        page.goto(url)
        page.wait_for_function("window.CTT && window.CTT.ready === true", timeout=120_000)
        if errors:
            sys.exit("Page errors:\n" + "\n".join(errors))
        n = page.evaluate("CTT.frameCount")
        fps = page.evaluate("CTT.fps")

        if a.stills:
            for fr in [int(x) for x in a.stills.split(",")]:
                page.evaluate(f"CTT.renderFrame({fr})")
                path = out_dir / f"still{a.tag}_{a.fmt}_{fr:05d}.png"
                page.screenshot(path=str(path))
                print(path.relative_to(ROOT))
            browser.close()
            return

        out = Path(a.out) if a.out else out_dir / f"{a.story}{a.tag}_{a.fmt}_{h}p.mp4"
        tmp = out.with_suffix(".partial.mp4")
        ff = subprocess.Popen([
            "ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(fps), "-c:v", "png", "-i", "-",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", str(a.crf), "-pix_fmt", "yuv420p",
            "-movflags", "+faststart", "-r", str(fps), str(tmp)], stdin=subprocess.PIPE)
        t0 = time.time()
        log = []
        for fr in range(n):
            info = page.evaluate(f"CTT.renderFrame({fr})")
            ff.stdin.write(page.screenshot(type="png"))
            log.append(info)
            if fr % 60 == 0:
                el = time.time() - t0
                print(f"{a.fmt} frame {fr}/{n}  {el:.0f}s elapsed  ~{el / max(fr, 1) * (n - fr):.0f}s left", flush=True)
        ff.stdin.close()
        if ff.wait() != 0:
            sys.exit("ffmpeg failed")
        tmp.replace(out)
        (out.with_suffix(".frames.json")).write_text(json.dumps(log))
        browser.close()
        if errors:
            print("WARNING page errors during render:\n" + "\n".join(errors))
        print(f"wrote {out.relative_to(ROOT)} ({n} frames, {time.time() - t0:.0f}s)")
    httpd.shutdown()


if __name__ == "__main__":
    main()
