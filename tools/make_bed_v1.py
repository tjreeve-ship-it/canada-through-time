"""Original ambient bed for The Canadian Data Project Shorts. Synthesized from scratch (no samples, no third-party audio).
Soft additive pads (Dmaj7 - F#m7 - Bm7 - Gmaj7), a sine bass, sparse pentatonic plucks, convolution reverb. Seeded: same output every run."""
import numpy as np, sys
from scipy.signal import fftconvolve
from scipy.io import wavfile
SR = 48000; DUR = float(sys.argv[1]) if len(sys.argv) > 1 else 48.7; OUT = sys.argv[2] if len(sys.argv) > 2 else "bed.wav"
rng = np.random.default_rng(7); n = int(SR * (DUR + 3)); t = np.arange(n) / SR
mtof = lambda m: 440 * 2 ** ((m - 69) / 12)
L = np.zeros(n); R = np.zeros(n)
CH = [[50, 54, 57, 61, 64], [54, 57, 61, 64, 69], [47, 50, 54, 57, 62], [43, 50, 54, 57, 62]]   # Dmaj9-ish, F#m7, Bm7(add11), Gmaj7
step = 6.1
def env(start, length, att, rel):
    e = np.zeros(n); i0 = int(start * SR); i1 = min(n, int((start + length + rel) * SR)); tt = (np.arange(i0, i1) - i0) / SR
    a = np.clip(tt / att, 0, 1); r = np.clip((start + length + rel - (tt + start)) / rel, 0, 1); e[i0:i1] = np.sin(a * np.pi / 2) ** 2 * np.sin(np.minimum(r, 1) * np.pi / 2) ** 2; return e
k = 0; s = 0.0
while s < DUR + 1:
    ch = CH[k % 4]; e = env(s, step, 2.2, 2.6)
    for m in ch:
        f = mtof(m)
        for side, det in ((L, -4), (R, 4)):
            ff = f * 2 ** (det / 1200); lfo = 1 + 0.0015 * np.sin(2 * np.pi * 0.11 * t + m)
            tone = sum(np.sin(2 * np.pi * ff * h * t * lfo + h) / h ** 2.2 for h in range(1, 6))
            side += 0.05 * e * tone
    b = mtof(ch[0] - 12); be = env(s, step, 1.0, 2.0)
    L += 0.11 * be * np.sin(2 * np.pi * b * t); R += 0.11 * be * np.sin(2 * np.pi * b * t)
    k += 1; s += step
# sparse plucks from the D major pentatonic, two octaves up, on a slow grid with gaps
PENT = [74, 76, 78, 81, 83, 86, 88]
g = 2.0
while g < DUR - 3:
    if rng.random() < 0.62:
        m = PENT[rng.integers(len(PENT))]; f = mtof(m); i0 = int(g * SR); ln = int(3.2 * SR); tt = np.arange(ln) / SR
        p = (np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(2 * np.pi * 2 * f * tt) + 0.08 * np.sin(2 * np.pi * 3 * f * tt)) * np.exp(-tt * 1.9) * np.clip(tt / 0.006, 0, 1)
        pan = rng.uniform(0.25, 0.75); amp = rng.uniform(0.045, 0.075); j = min(n, i0 + ln)
        L[i0:j] += amp * (1 - pan) * p[: j - i0]; R[i0:j] += amp * pan * p[: j - i0]
    g += rng.choice([0.86, 1.72, 0.86, 2.58])
# soft air: filtered noise, very quiet
air = np.convolve(rng.standard_normal(n), np.ones(40) / 40, mode="same") * 0.004
L += air; R += np.roll(air, 900)
# reverb: decaying filtered noise impulse, different per side
def ir(seed):
    r = np.random.default_rng(seed); ln = int(2.8 * SR); x = r.standard_normal(ln) * np.exp(-np.arange(ln) / SR * 2.4)
    return np.convolve(x, np.ones(12) / 12, mode="same") * 0.012
L = 0.75 * L + fftconvolve(L, ir(1))[:n]; R = 0.75 * R + fftconvolve(R, ir(2))[:n]
m = int(DUR * SR); L, R = L[:m], R[:m]; tt = np.arange(m) / SR
fade = np.clip(tt / 1.5, 0, 1) * np.clip((DUR - tt) / 3.0, 0, 1); L *= fade; R *= fade
st = np.stack([L, R], 1); st /= np.abs(st).max() / 0.6
wavfile.write(OUT, SR, (st * 32767).astype(np.int16)); print(OUT, DUR)
