"""Original lo-fi bed for The Canadian Data Project Shorts (v2). Synthesized from scratch: no samples, no third-party audio.
78 bpm, swung. FM electric piano (Fmaj9 - Em7 - Dm9 - Cmaj7), warm sine bass, soft kick / brushed snare / shaker, sparse
pentatonic melody, tape wow, vinyl crackle, gentle low-pass and a short room. Seeded, so the same length gives the same file.
Usage: make_bed.py <seconds> <out.wav>"""
import sys, numpy as np
from scipy.signal import fftconvolve, butter, sosfilt
from scipy.io import wavfile
SR = 48000; DUR = float(sys.argv[1]); OUT = sys.argv[2]
rng = np.random.default_rng(11); n = int(SR * (DUR + 4)); t = np.arange(n) / SR
BPM = 78; beat = 60 / BPM; bar = 4 * beat; swing = 0.58
mtof = lambda m: 440 * 2 ** ((m - 69) / 12)
L = np.zeros(n); R = np.zeros(n)
wow = 1 + 0.0022 * np.sin(2 * np.pi * 0.55 * t) + 0.0008 * np.sin(2 * np.pi * 5.1 * t)   # tape wow/flutter on pitched parts
def add(sig, i0, l, r):
    j = min(n, i0 + len(sig)); L[i0:j] += l * sig[: j - i0]; R[i0:j] += r * sig[: j - i0]
def ep(m, vel, ln=2.6):  # FM tine electric piano
    f = mtof(m); k = int(ln * SR); tt = np.arange(k) / SR; w = np.interp(tt, t[:k], wow[:k])
    idx = 1.6 * np.exp(-tt * 7) + 0.25
    mod = np.sin(2 * np.pi * f * 1.0 * tt * w); car = np.sin(2 * np.pi * f * tt * w + idx * mod)
    bell = 0.12 * np.sin(2 * np.pi * f * 4.0 * tt) * np.exp(-tt * 14)
    env = np.minimum(tt / 0.004, 1) * (0.65 * np.exp(-tt * 1.3) + 0.35 * np.exp(-tt * 0.45))
    return vel * (car + bell) * env
CH = [[53, 57, 60, 64, 67], [52, 55, 59, 62, 64], [50, 53, 57, 60, 64], [48, 52, 55, 59, 62]]   # Fmaj9, Em7(add11), Dm9, Cmaj7
BASS = [41, 40, 38, 36]
nb = int(np.ceil((DUR + 2) / bar))
for b in range(nb):
    t0 = b * bar; ch = CH[b % 4]
    for hit, vel in ((0, 1.0), (1.5 * beat + (swing - 0.5) * beat, 0.55)) if b % 2 == 0 else ((0, 0.95), (2.5 * beat + (swing - 0.5) * beat, 0.5)):
        for i, m in enumerate(ch):
            st = t0 + hit + i * 0.012 + rng.uniform(0, 0.006); pan = 0.35 + 0.3 * i / (len(ch) - 1)
            s = ep(m, 0.055 * vel * rng.uniform(0.85, 1.0)); add(s, int(st * SR), 1 - pan, pan)
    # bass: root on 1, a passing note before 3
    for st, m, ln in ((t0, BASS[b % 4], 1.7 * beat), (t0 + 2.5 * beat + (swing - 0.5) * beat, BASS[b % 4] + 7 if b % 2 else BASS[b % 4], 1.2 * beat)):
        k = int(ln * SR); tt = np.arange(k) / SR; f = mtof(m)
        s = (np.sin(2 * np.pi * f * tt) + 0.18 * np.sin(2 * np.pi * 2 * f * tt)) * np.minimum(tt / 0.01, 1) * np.exp(-tt * 1.1) * np.minimum((ln - tt) / 0.05, 1)
        add(np.tanh(1.4 * s) * 0.17, int(st * SR), 0.5, 0.5)
# drums enter in bar 2 and stop for the last bar
def kick():
    k = int(0.45 * SR); tt = np.arange(k) / SR; f = 45 + 75 * np.exp(-tt * 28); ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-tt * 7.5) * 0.33
def noise_hit(ln, lo, hi, dec, g):
    k = int(ln * SR); x = rng.standard_normal(k); sos = butter(2, [lo, hi], btype="band", fs=SR, output="sos")
    return sosfilt(sos, x) * np.exp(-np.arange(k) / SR * dec) * g
last = int(np.floor((DUR - 2.5) / bar))
for b in range(1, last):
    t0 = b * bar
    for st in (0, 2.5 * beat + (swing - 0.5) * beat) if b % 2 else (0, 2 * beat):
        add(kick(), int((t0 + st) * SR), 0.5, 0.5)
    for st in (beat, 3 * beat):
        i0 = int((t0 + st + 0.01) * SR); add(noise_hit(0.35, 900, 5000, 16, 0.07), i0, 0.48, 0.52); add(noise_hit(0.12, 180, 400, 30, 0.05), i0, 0.5, 0.5)
    for e in range(8):
        st = t0 + (e // 2) * beat + (e % 2) * swing * beat; v = 0.014 if e % 2 else 0.010
        add(noise_hit(0.07, 6000, 12000, 55, v * rng.uniform(0.7, 1.1)), int(st * SR), 0.62, 0.38)
# sparse melody from F major pentatonic, upper octave, on off-beats in the middle of the piece
PENT = [72, 74, 77, 79, 81, 84]
for b in range(2, last):
    if rng.random() < 0.55:
        for q in sorted(rng.choice(8, size=rng.integers(1, 3), replace=False)):
            st = b * bar + (q // 2) * beat + (q % 2) * swing * beat; add(ep(PENT[rng.integers(len(PENT))], 0.045, 2.0), int(st * SR), 0.4, 0.6)
# vinyl: hiss + sparse crackle
hiss = sosfilt(butter(2, [1500, 9000], btype="band", fs=SR, output="sos"), rng.standard_normal(n)) * 0.0025
cr = np.zeros(n); idx = rng.choice(n, size=int(DUR * 4), replace=False); cr[idx] = rng.uniform(-1, 1, len(idx)) * 0.025
cr = sosfilt(butter(2, 2500, btype="high", fs=SR, output="sos"), cr)
L += hiss + cr; R += np.roll(hiss, 311) + np.roll(cr, 97)
# room + warmth
def ir(seed):
    r = np.random.default_rng(seed); k = int(1.6 * SR); x = r.standard_normal(k) * np.exp(-np.arange(k) / SR * 4.0); return sosfilt(butter(1, 4000, fs=SR, output="sos"), x) * 0.02
L = L + fftconvolve(L, ir(3))[:n] * 0.5; R = R + fftconvolve(R, ir(4))[:n] * 0.5
lp = butter(2, 7500, fs=SR, output="sos"); L = sosfilt(lp, L); R = sosfilt(lp, R)
m = int(DUR * SR); L, R = L[:m], R[:m]; tt = np.arange(m) / SR
fade = np.clip(tt / 1.2, 0, 1) * np.clip((DUR - tt) / 2.8, 0, 1); L *= fade; R *= fade
st = np.stack([np.tanh(L * 1.2), np.tanh(R * 1.2)], 1); st /= np.abs(st).max() / 0.7
wavfile.write(OUT, SR, (st * 32767).astype(np.int16)); print(OUT, DUR)
