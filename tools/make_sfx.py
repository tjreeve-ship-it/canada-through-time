"""Original sound effects for v3 Shorts, synthesized here (no samples): tick, riser, hit.

  python3 tools/make_sfx.py <out_dir>   -> tick.wav, riser.wav, hit.wav (48 kHz stereo)
"""
import sys
import wave
from pathlib import Path

import numpy as np

SR = 48000
rng = np.random.default_rng(7)


def env(n, a, d):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d)


def tick():
    n = int(0.18 * SR); t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * 1760 * t) * 0.6 + np.sin(2 * np.pi * 2640 * t) * 0.25
    click = rng.normal(0, 1, n) * np.exp(-t / 0.004)
    return (tone * env(n, 0.002, 0.045) + click * 0.25) * 0.55


def riser(sec=1.6):
    n = int(sec * SR); t = np.arange(n) / SR; x = t / sec
    noise = rng.normal(0, 1, n)
    # sweep a simple one-pole low-pass upward; plus a rising sine
    out = np.zeros(n); y = 0.0
    for i in range(n):
        a = 0.01 + 0.35 * x[i] ** 2
        y += a * (noise[i] - y); out[i] = y
    f = 180 + 900 * x ** 2
    sine = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25
    return (out * 0.9 + sine) * (x ** 1.6) * 0.7


def hit():
    n = int(1.8 * SR); t = np.arange(n) / SR
    f = 110 * np.exp(-t / 0.08) + 46
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.003, 0.45)
    shimmer = rng.normal(0, 1, n) * env(n, 0.001, 0.18)
    sh = np.convolve(shimmer, np.ones(6) / 6, mode="same") - np.convolve(shimmer, np.ones(40) / 40, mode="same")
    chord = sum(np.sin(2 * np.pi * fr * t) for fr in (220, 277.2, 329.6, 440)) / 4 * env(n, 0.01, 0.7) * 0.35
    return boom * 0.9 + sh * 0.5 + chord


def write(path, x, width=0.25):
    x = x / max(1e-9, np.abs(x).max()) * 0.9
    st = np.stack([x * (1 - width / 2), np.roll(x, 24) * (1 - width / 2)], axis=1)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((st * 32767).astype("<i2").tobytes())


if __name__ == "__main__":
    out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
    for name, fn in (("tick", tick), ("riser", riser), ("hit", hit)):
        write(out / f"{name}.wav", fn())
    print("wrote", ", ".join(f"{n}.wav" for n in ("tick", "riser", "hit")))
