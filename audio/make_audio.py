"""Synthesise the full soundtrack from a show.json (numpy only).
Usage: python audio/make_audio.py [show.json] [out.wav]      (defaults: build/show.json build/audio_raw.wav)
Goal sound (v2): one of three original short sounds A/B/C (config/audio.json "goal_sfx"); samples are written to
output/goal_sfx_samples/ and a peak/loudness/masking report to build/audio_goal_report.json.
Sound effects are placed from the event list; music is original (synthesised here).
Output: build/audio_raw.wav (48 kHz stereo 16-bit). Loudness normalisation (-14 LUFS) is done by ffmpeg loudnorm.
"""
import json, sys, wave, os
import numpy as np

SR = 48000
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SHOW_PATH = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'build', 'show.json')
OUT_PATH = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'build', 'audio_raw.wav')
show = json.load(open(SHOW_PATH, encoding='utf8'))
ACFG = show.get('audioCfg') or {'goal_sfx': 'A', 'music_seed': 1234}
rng = np.random.default_rng(ACFG.get('music_seed', 1234))
FPS = show['fps']
DUR = show['totalFrames'] / FPS + 0.5
N = int(DUR * SR)
fx = np.zeros((2, N), np.float32)
fx_goal = np.zeros(N, np.float32)   # mono stems used only for the masking report
fx_other = np.zeros(N, np.float32)
mus = np.zeros(N, np.float32)

def t_(d): return np.arange(int(d * SR)) / SR
def env_ad(n, a, d):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / d)
    return e
def bandnoise(n, lo, hi):
    x = rng.standard_normal(n)
    X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR)
    m = 1 / (1 + ((f - (lo + hi) / 2) / ((hi - lo) / 2 + 1)) ** 4)
    y = np.fft.irfft(X * m, n)
    return y / (np.max(np.abs(y)) + 1e-9)
def lowpass(x, fc):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X / (1 + (f / fc) ** 4), len(x))
def norm(x, p=1.0): return (x / (np.max(np.abs(x)) + 1e-9) * p).astype(np.float32)
def place(sig, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N or i + len(sig) <= 0: return
    j = min(N, i + len(sig)); s = sig[: j - i] * gain
    l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
    fx[0, i:j] += s * l * 1.41; fx[1, i:j] += s * r * 1.41
    (fx_goal if _stem[0] == 'goal' else fx_other)[i:j] += s
_stem = ['other']

# ---------------- sound effect templates ----------------
def snd_thump(f0=85, d=0.18):
    t = t_(d); f = f0 * (1 + 0.6 * np.exp(-t * 40))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 22)
    s += 0.35 * bandnoise(len(t), 200, 1800) * np.exp(-t * 90)
    return norm(s)
def snd_knock(f0=520, d=0.16):
    t = t_(d)
    s = np.sin(2 * np.pi * f0 * t) * np.exp(-t * 40) + 0.5 * np.sin(2 * np.pi * f0 * 2.7 * t) * np.exp(-t * 70)
    s += 0.6 * bandnoise(len(t), 800, 3500) * np.exp(-t * 120)
    return norm(s)
def snd_slap(d=0.14):
    t = t_(d)
    s = bandnoise(len(t), 300, 2500) * np.exp(-t * 55) + 0.6 * np.sin(2 * np.pi * 180 * t) * np.exp(-t * 35)
    return norm(s)
def snd_metal(d=0.55):
    t = t_(d)
    parts = [(1180, 1.0, 9), (2710, 0.6, 12), (4130, 0.4, 16), (5650, 0.25, 22)]
    s = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t * k) for f, a, k in parts)
    s += 0.3 * bandnoise(len(t), 3000, 8000) * np.exp(-t * 200)
    return norm(s)
def snd_click(d=0.07):
    t = t_(d)
    s = np.sin(2 * np.pi * 1350 * t) * np.exp(-t * 90) + 0.6 * bandnoise(len(t), 1500, 6000) * np.exp(-t * 160)
    return norm(s)
def snd_pop(d=0.12):
    t = t_(d); f = 260 + 900 * (t / d)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * np.minimum(1, t / d)) ** 2
    return norm(s)
def snd_whoosh(d=0.5, lo=400, hi=3000, rev=False):
    n = int(d * SR); t = np.arange(n) / SR
    e = np.sin(np.pi * t / d) ** 2
    if rev: e = e * (t / d) ** 1.5
    return norm(bandnoise(n, lo, hi) * e)
def snd_net(d=0.35):
    t = t_(d)
    return norm(bandnoise(len(t), 1500, 7000) * np.exp(-t * 12) * np.minimum(1, t / 0.01))
def snd_whistle(pattern):
    out = []
    for dur, gap in pattern:
        t = t_(dur)
        trill = np.sin(2 * np.pi * 27 * t)
        f = 2900 + 140 * trill
        tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * (0.75 + 0.25 * trill)
        tone += 0.18 * bandnoise(len(t), 2400, 3600)
        e = np.minimum(1, t / 0.02) * np.minimum(1, (dur - t) / 0.04)
        out.append(tone * e); out.append(np.zeros(int(gap * SR)))
    return norm(np.concatenate(out), 0.9)
def snd_horn(d=1.1):
    t = t_(d); s = np.zeros_like(t)
    for f0 in (233.1, 277.2):
        vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * t)
        for h in range(1, 14):
            s += np.sin(2 * np.pi * f0 * h * np.cumsum(vib) / SR) / h ** 1.1
    e = np.minimum(1, t / 0.04) * np.minimum(1, (d - t) / 0.15)
    return norm(lowpass(s * e, 2400))
def snd_crowd(d=3.0, swell=0.4, excite=1.0):
    n = int(d * SR); t = np.arange(n) / SR
    base = bandnoise(n, 250, 2600)
    voices = sum(bandnoise(n, f * 0.8, f * 1.25) * (0.5 + 0.5 * np.sin(2 * np.pi * (0.7 + k * 0.37) * t + k)) for k, f in enumerate((450, 800, 1250, 2100)))
    s = base * 0.7 + voices * 0.5 * excite
    e = np.minimum(1, t / swell) * np.minimum(1, (d - t) / (d * 0.45))
    return norm(lowpass(s, 3500) * e)
def snd_applause(d=3.5):
    n = int(d * SR); s = np.zeros(n)
    clap = lambda: bandnoise(int(0.03 * SR), 900, 5000) * np.exp(-np.arange(int(0.03 * SR)) / SR * 140)
    for _ in range(int(d * 90)):
        i = rng.integers(0, n - 2000); c = clap(); s[i:i + len(c)] += c * rng.uniform(0.3, 1)
    t = np.arange(n) / SR
    return norm(s * np.minimum(1, t / 0.2) * np.minimum(1, (d - t) / 1.2))
def tone(f, d, harm=6, bright=1.0, a=0.01, r=0.3):
    t = t_(d); s = np.zeros_like(t)
    for h in range(1, harm + 1): s += np.sin(2 * np.pi * f * h * t) / h ** (1.6 / bright)
    e = np.minimum(1, t / a) * np.exp(-t / r)
    return s * e
def snd_sting():  # golden ball: bright rising arpeggio + shimmer
    notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]
    out = np.zeros(int(1.8 * SR))
    for i, f in enumerate(notes):
        s = tone(f, 1.2, 5, 1.3, 0.005, 0.5); j = int(i * 0.09 * SR); out[j:j + len(s)] += s * (0.6 + 0.1 * i)
    n = len(out); t = np.arange(n) / SR
    out += 0.25 * bandnoise(n, 5000, 12000) * np.minimum(1, t / 0.6) * np.exp(-t * 1.5)
    return norm(out)
def snd_chime(notes, step=0.12, d=1.0):
    out = np.zeros(int((len(notes) * step + d) * SR))
    for i, f in enumerate(notes):
        s = tone(f, d, 4, 1.5, 0.003, 0.35); j = int(i * step * SR); out[j:j + len(s)] += s
    return norm(out)
def brass(f, d, a=0.03):
    t = t_(d); s = np.zeros_like(t)
    br = np.minimum(1, t / 0.08)
    for h in range(1, 16):
        s += np.sin(2 * np.pi * f * h * t) * (1 / h) * (br ** (h * 0.25))
    e = np.minimum(1, t / a) * np.minimum(1, (d - t) / 0.08)
    return lowpass(s * e, 4000)
def snd_fanfare():
    seq = [(392, 0.18), (523.25, 0.18), (659.25, 0.18), (783.99, 0.55), (659.25, 0.18), (783.99, 1.4)]
    out = np.zeros(int(3.2 * SR)); pos = 0
    for f, d in seq:
        s = brass(f, d + 0.05); out[pos:pos + len(s)] += s; s2 = brass(f / 1.498, d + 0.05) * 0.5; out[pos:pos + len(s2)] += s2; pos += int(d * SR)
    # final chord + timpani roll
    t = t_(1.6)
    tim = np.sin(2 * np.pi * 98 * t) * (0.6 + 0.4 * np.sin(2 * np.pi * 18 * t)) * np.exp(-t * 2)
    j = int(0.5 * SR); out[j:j + len(tim)] += tim * 0.6
    return norm(out)
def snd_brass_hit():
    out = sum(brass(f, 0.9) for f in (293.66, 369.99, 440.0, 587.33))
    t = np.arange(len(out)) / SR
    out = out * np.exp(-t * 2.5) + 0.4 * bandnoise(len(out), 4000, 11000) * np.exp(-t * 4)
    return norm(out)

S = {
    'ground': [snd_thump(f) for f in (75, 85, 95)],
    'wall': [snd_thump(110, 0.14)],
    'mill': [snd_knock(f) for f in (480, 540, 600)],
    'keeper': [snd_slap() for _ in range(3)],
    'bar': [snd_metal()],
    'ballball': [snd_click() for _ in range(2)],
    'pop': [snd_pop()],
    'whoosh': [snd_whoosh(0.55, 300, 2000)],
    'net': [snd_net()],
    'horn': snd_horn(),
    'goal_crowd': snd_crowd(3.2, 0.25, 1.4),
    'end_crowd': snd_crowd(2.6, 0.5, 1.0),
    'w_start': snd_whistle([(0.75, 0)]),
    'w_half': snd_whistle([(0.25, 0.12), (0.55, 0)]),
    'w_end': snd_whistle([(0.25, 0.12), (0.25, 0.12), (0.9, 0)]),
    'golden': snd_sting(),
    'added': snd_chime([880, 1174.7], 0.1, 0.8),
    'qualify': snd_chime([523.25, 659.25, 783.99, 1046.5], 0.11, 1.0),
    'swoosh': snd_whoosh(0.6, 500, 4000),
    'replay': snd_whoosh(0.7, 300, 5000, rev=True),
    'fanfare': snd_fanfare(),
    'cheer': snd_crowd(5.5, 0.3, 1.5),
    'applause': snd_applause(5.0),
    'intro': snd_brass_hit(),
}

# ---------------- v2 goal sounds (own rng: the v1 effects and music stay bit-identical) ----------------
grng = np.random.default_rng(777)
def gnoise(n, lo, hi):
    x = grng.standard_normal(n)
    X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR)
    m = 1 / (1 + ((f - (lo + hi) / 2) / ((hi - lo) / 2 + 1)) ** 4)
    y = np.fft.irfft(X * m, n)
    return y / (np.max(np.abs(y)) + 1e-9)
def bell(f, d, decay=3.2):
    t = t_(d)
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 6) + 0.12 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 12)
    return s * np.minimum(1, t / 0.004) * np.exp(-t * decay)
def goal_A():  # bright net-swish + soft rising two-note chime, no crowd
    d = 1.6; n = int(d * SR); t = np.arange(n) / SR; out = np.zeros(n)
    sw = gnoise(n, 2500, 9000) * np.minimum(1, t / 0.015) * np.exp(-t * 9)
    out += 0.55 * sw
    for k, (f, t0) in enumerate(((1046.5, 0.06), (1568.0, 0.20))):
        b = bell(f, d - t0, 3.0); j = int(t0 * SR); out[j:j + len(b)] += (0.42 + 0.08 * k) * b
    out *= np.minimum(1, (d - t) / 0.25)
    return norm(out)
def goal_B():  # low whoosh + gentle crowd swell (band-pass noise, low level, fades quickly), no horn
    d = 1.75; n = int(d * SR); t = np.arange(n) / SR
    wh = gnoise(n, 120, 900) * np.sin(np.pi * np.minimum(1, t / 0.55)) ** 2 * (t < 0.55)
    crowd = (0.6 * gnoise(n, 300, 2400) + 0.4 * gnoise(n, 700, 1600) * (0.7 + 0.3 * np.sin(2 * np.pi * 3.1 * t)))
    ce = np.minimum(1, np.maximum(0, t - 0.15) / 0.35) * np.exp(-np.maximum(0, t - 0.5) * 2.6)
    out = 0.8 * wh + 0.32 * crowd * ce
    out = lowpass(out, 3200) * np.minimum(1, (d - t) / 0.3)
    return norm(out)
def goal_C():  # short percussive thump + marimba-like three-note flourish
    d = 1.5; n = int(d * SR); t = np.arange(n) / SR; out = np.zeros(n)
    tt = t_(0.25); f = 62 + 70 * np.exp(-tt * 35)
    th = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 16) + 0.25 * gnoise(len(tt), 150, 1200) * np.exp(-tt * 80)
    out[:len(th)] += 0.9 * th
    def marimba(f0, dd):
        x = t_(dd)
        return (np.sin(2 * np.pi * f0 * x) + 0.22 * np.sin(2 * np.pi * f0 * 3.93 * x) * np.exp(-x * 25)) * np.minimum(1, x / 0.002) * np.exp(-x * 7)
    for k, (f0, t0) in enumerate(((523.25, 0.10), (659.25, 0.21), (783.99, 0.32))):
        m = marimba(f0, d - t0); j = int(t0 * SR); out[j:j + len(m)] += (0.5 + 0.08 * k) * m
    out *= np.minimum(1, (d - t) / 0.2)
    return norm(out)
GOAL_V2 = {'A': goal_A(), 'B': goal_B(), 'C': goal_C()}   # P1 sounds, still selectable as "v2_A".."v2_C"

# ---------------- P1b crowd goal sounds (own rng; all other effects and the music stay bit-identical) ----------------
# A stadium roar built from layered band-limited noise: an STFT filter bank applies vowel-like formants that glide
# from "oooh" to "aaah" while the level swells; several layers (lower/higher voices, slightly different timing),
# slow random surges, soft release, plus a short net-thump at the start.
crng = np.random.default_rng(4242)
VOW = {'oo': (300, 870, 2240), 'ah': (730, 1090, 2440), 'eh': (530, 1840, 2480)}
def formant_env(f, F, bw=(110, 160, 240), floor=0.12, lo=140, hi=4200):
    e = floor + sum(np.exp(-0.5 * ((f - Fk) / b) ** 2) * g for Fk, b, g in zip(F, bw, (1.0, 0.75, 0.35)))
    band = 1 / (1 + (lo / np.maximum(f, 1)) ** 4) / (1 + (f / hi) ** 4)
    return e * band
def crowd_layer(d, shift=1.0, delay=0.0, glide=0.45, v0='oo', v1='ah', surge=0.18, nfft=2048, hop=512):
    n = int(d * SR); x = crng.standard_normal(n + nfft)
    win = np.hanning(nfft)
    f = np.fft.rfftfreq(nfft, 1 / SR)
    out = np.zeros(n + nfft)
    for i in range(0, n, hop):
        tau = i / SR
        m = float(np.clip((tau - delay - 0.05) / glide, 0, 1)); m = m * m * (3 - 2 * m)
        F = [(a + (b - a) * m) * shift for a, b in zip(VOW[v0], VOW[v1])]
        seg = x[i:i + nfft] * win
        out[i:i + nfft] += np.fft.irfft(np.fft.rfft(seg) * formant_env(f, F), nfft) * win
    out = out[:n]
    t = np.arange(n) / SR
    # slow random surges (low-passed noise, 2-5 Hz)
    sv = np.convolve(crng.standard_normal(n // 480 + 8), np.ones(6) / 6, 'same')[: n // 480 + 1]
    am = 1 + surge * np.interp(t, np.arange(len(sv)) * 0.01, sv / (np.max(np.abs(sv)) + 1e-9))
    return out / (np.max(np.abs(out)) + 1e-9) * am
def net_thump(n):
    out = np.zeros(n); tt = t_(0.22); f = 58 + 60 * np.exp(-tt * 30)
    th = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 18)
    sw = crng.standard_normal(len(tt)); sw = lowpass(sw, 6000) * np.exp(-tt * 40) * 0.25
    out[:len(tt)] += th + sw
    return out
def envelope(n, swell, peak_t, d, rel):
    t = np.arange(n) / SR
    a = 1 - np.exp(-np.maximum(0, t) / swell)
    a *= 0.75 + 0.25 * np.clip(t / peak_t, 0, 1)
    r = np.clip((d - t) / rel, 0, 1); r = r * r * (3 - 2 * r)
    return a * r
def mix_layers(d, specs):
    n = int(d * SR); out = np.zeros(n)
    for sp in specs:
        g = sp.pop('g'); out += g * crowd_layer(d, **sp)
    return out
def crowd_A():  # big stadium roar: 4 layers, wide band, long swell, oooh -> AAAH
    d = 2.4; n = int(d * SR)
    r = mix_layers(d, [dict(g=1.0, shift=0.9, glide=0.5), dict(g=0.8, shift=1.15, delay=0.04, glide=0.45),
                       dict(g=0.55, shift=1.35, delay=0.08, glide=0.55, v1='eh'), dict(g=0.5, shift=0.75, delay=0.02, glide=0.6)])
    r = r / (np.max(np.abs(r)) + 1e-9) * envelope(n, 0.22, 0.7, d, 0.9)
    return norm(r + 0.55 * net_thump(n))
def crowd_B():  # roar + short rising chime
    d = 2.2; n = int(d * SR); t = np.arange(n) / SR
    r = mix_layers(d, [dict(g=1.0, shift=0.95, glide=0.4), dict(g=0.7, shift=1.2, delay=0.05, glide=0.4)])
    r = r / (np.max(np.abs(r)) + 1e-9) * envelope(n, 0.2, 0.6, d, 0.8)
    ch = np.zeros(n)
    for k, (f0, t0) in enumerate(((880.0, 0.10), (1174.7, 0.22), (1568.0, 0.34))):
        b = bell(f0, d - t0, 4.0); j = int(t0 * SR); ch[j:j + len(b)] += (0.32 + 0.05 * k) * b
    return norm(r + 0.45 * net_thump(n) + 0.55 * ch)
def crowd_C():  # smaller, closer crowd: fewer voices, individual shouts more audible, shorter
    d = 1.8; n = int(d * SR); t = np.arange(n) / SR
    r = mix_layers(d, [dict(g=1.0, shift=1.05, glide=0.3, surge=0.35), dict(g=0.6, shift=1.3, delay=0.06, glide=0.3, surge=0.4, v1='eh')])
    shouts = np.zeros(n)
    for k in range(5):  # a few individual voices ("aaah!") with a pitch, through vowel formants
        t0 = 0.05 + 0.09 * k + 0.04 * crng.random(); dd = 0.45 + 0.35 * crng.random(); f0 = 150 + 110 * crng.random()
        tt = t_(dd); ph = 2 * np.pi * np.cumsum(f0 * (1 + 0.06 * tt / dd)) / SR
        src = sum(np.sin(h * ph) / h for h in range(1, 18))
        F = [v * (1 + 0.15 * crng.random()) for v in VOW['ah']]
        X = np.fft.rfft(src); fr = np.fft.rfftfreq(len(src), 1 / SR)
        v = np.fft.irfft(X * formant_env(fr, F, floor=0.05), len(src)) * np.sin(np.pi * np.minimum(1, tt / dd)) ** 1.5
        j = int(t0 * SR); m = min(n - j, len(v)); shouts[j:j + m] += v[:m] / (np.max(np.abs(v)) + 1e-9) * (0.35 + 0.15 * crng.random())
    r = r / (np.max(np.abs(r)) + 1e-9) * envelope(n, 0.12, 0.4, d, 0.6)
    return norm(0.85 * r + 0.5 * shouts * envelope(n, 0.02, 0.1, d, 0.5) + 0.6 * net_thump(n))
def golden_goal_sfx():  # bigger roar (crowd A, longer) + a short bright sting
    d = 2.5; n = int(d * SR)
    r = mix_layers(d, [dict(g=1.0, shift=0.9, glide=0.45), dict(g=0.9, shift=1.15, delay=0.03, glide=0.4), dict(g=0.7, shift=1.4, delay=0.06, glide=0.5, v1='eh'), dict(g=0.6, shift=0.72, glide=0.55)])
    r = r / (np.max(np.abs(r)) + 1e-9) * envelope(n, 0.15, 0.5, d, 0.9)
    st = np.zeros(n)
    for i, f0 in enumerate((783.99, 1046.5, 1318.5, 1568.0)):
        b = bell(f0, 1.2, 3.5); j = int((0.04 + i * 0.06) * SR); st[j:j + len(b)] += 0.4 * b
    return norm(r + 0.5 * net_thump(n) + 0.5 * st)
CROWD = {'A': crowd_A(), 'B': crowd_B(), 'C': crowd_C()}
GOLDEN_GOAL = golden_goal_sfx()
# loudness match: every goal sound gets the same max short-term (400 ms) RMS, so switching A/B/C does not change the mix level
def _st(x, w=int(0.4 * SR), hop=int(0.1 * SR)): return max(float(np.sqrt(np.mean(x[i:i + w] ** 2))) for i in range(0, max(1, len(x) - w + 1), hop))
ST_TARGET = 0.20
for _k in list(CROWD): CROWD[_k] = (CROWD[_k] * ST_TARGET / _st(CROWD[_k])).astype(np.float32)
GOLDEN_GOAL = (GOLDEN_GOAL * ST_TARGET * 1.25 / _st(GOLDEN_GOAL)).astype(np.float32)   # a bit bigger than a normal goal
GOAL_SFX = dict(CROWD); GOAL_SFX.update({'v2_' + k: v for k, v in GOAL_V2.items()})
SEL = ACFG.get('goal_sfx', 'A')
GOAL = GOAL_SFX[SEL]
CUSTOM = os.path.join(ROOT, 'audio', 'custom', 'goal.wav')
CUSTOM_USED = False
if os.path.exists(CUSTOM):  # Max's own royalty-free recording overrides the synthesised sound
    with wave.open(CUSTOM, 'rb') as w:
        ch, sw, fr, nf = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
        raw = w.readframes(nf)
    if sw != 2: raise SystemExit('audio/custom/goal.wav must be 16-bit PCM WAV')
    xx = np.frombuffer(raw, np.int16).astype(np.float32) / 32768.0
    if ch > 1: xx = xx.reshape(-1, ch).mean(axis=1)
    if fr != SR: xx = np.interp(np.arange(int(len(xx) * SR / fr)) / SR, np.arange(len(xx)) / fr, xx).astype(np.float32)
    xx = xx[: int(3.0 * SR)]
    fo = min(len(xx), int(0.3 * SR)); xx[-fo:] *= np.linspace(1, 0, fo)
    GOAL = (xx * ST_TARGET / max(_st(xx), 1e-6)).astype(np.float32); CUSTOM_USED = True; SEL = 'custom'
GOAL_GAIN = 0.55
# P7 season finale (league only; never used by the cups): firework boom + crackle, short original music sting
def snd_firework(d=1.6):
    n = int(d * SR); t = t_(d)
    boom = np.sin(2 * np.pi * (55 + 30 * np.exp(-t * 9)) * t) * np.exp(-t * 5.5)
    lr = np.random.default_rng(9090)  # own generator: the shared rng (approved cup sounds) is not advanced
    X = np.fft.rfft(lr.standard_normal(n)); f = np.fft.rfftfreq(n, 1 / SR)
    hiss = np.fft.irfft(X / (1 + ((f - 5750) / 3250) ** 4), n); hiss /= (np.max(np.abs(hiss)) + 1e-9)
    crackle = hiss * (lr.random(n) > 0.985) * np.exp(-np.maximum(0, t - 0.25) * 3) * (t > 0.25)
    whistle = np.sin(2 * np.pi * (1800 - 900 * np.minimum(t, 0.3) / 0.3) * t) * (t < 0.3) * 0.12
    return norm(boom + 0.45 * crackle + whistle)
def snd_ceremony_sting():
    seq = [(523.25, 0.16), (659.25, 0.16), (783.99, 0.16), (1046.5, 0.5), (987.77, 0.16), (1046.5, 1.6)]
    out = np.zeros(int(3.6 * SR)); pos = 0
    for f, d in seq:
        a = brass(f, d + 0.06); out[pos:pos + len(a)] += a; b = brass(f / 2, d + 0.06) * 0.45; out[pos:pos + len(b)] += b; pos += int(d * SR)
    return norm(out)
S['firework'] = snd_firework(); S['ceremony_sting'] = snd_ceremony_sting()
S['w_reg'] = S['w_half']   # 90' whistle (before the added-time shots): same two-blast pattern as half-time

def pan_x(x): return float(np.clip((x / 1280.0) * 2 - 1, -1, 1)) * 0.6
cnt = {}
goal_times = []
cine_windows = []
for e in show['audio']:
    t = e['t']; ty = e['type']; v = e.get('v', 300)
    # v1 look/sound kept: v1 collision events always had x=0 (bug), so collision sounds were panned by pan_x(0).
    pan = pan_x(0) if 'x' in e else 0.0
    cnt[ty] = cnt.get(ty, 0) + 1
    vol = float(np.clip(v / 650.0, 0.15, 1.0))
    k = cnt[ty]
    if ty in ('ground', 'wall'):  place(S[ty][k % len(S[ty])], t, 0.45 * vol, pan)
    elif ty == 'mill':            place(S['mill'][k % 3], t, 0.55 * vol, pan)
    elif ty == 'keeper':          place(S['keeper'][k % 3], t, 0.6 * vol, pan)
    elif ty == 'bar':             place(S['bar'][0], t, 0.55 * max(vol, 0.5), pan)
    elif ty == 'ballball':        place(S['ballball'][k % 2], t, 0.35 * vol, pan)
    elif ty == 'pop':             place(S['pop'][0], t, 0.35, -0.45)
    elif ty == 'whoosh':          place(S['whoosh'][0], t, 0.18, -0.8)
    elif ty == 'net':             place(S['net'][0], t, 0.35, 0.6)
    elif ty == 'goal':
        _stem[0] = 'goal'; place(GOLDEN_GOAL if e.get('golden') else GOAL, t, GOAL_GAIN, 0.0); _stem[0] = 'other'; goal_times.append(t)
    elif ty == 'cine_in':  # good hit: a rising "oooh" from the crowd until the cinematic ends, plus a music swell (below)
        co = next((x for x in show['audio'] if x['type'] == 'cine_out' and x.get('match') == e.get('match') and x.get('k') == e.get('k')), None)
        d = min(6.0, ((co['t'] if co else t + 3.0) - t) + 0.8)
        sw = crowd_layer(d, shift=1.0, glide=d * 0.8, v0='oo', v1='oo', surge=0.1) * envelope(int(d * SR), d * 0.5, d, d, 0.7)
        place(norm(sw), t, 0.16, 0.0); cine_windows.append((t, t + d))
    elif ty == 'whistle':
        place(S['w_' + e['kind']], t, 0.5, 0.0)
        if e['kind'] == 'end': goal_times.append(t)
    elif ty == 'golden':          place(S['golden'], t, 0.7, 0.0); goal_times.append(t)
    elif ty == 'added':           place(S['added'], t, 0.4, 0.0)
    elif ty == 'crowd_end':       place(S['end_crowd'], t, 0.45, 0.0)
    elif ty in ('swoosh',):       place(S['swoosh'], t, 0.35, 0.0)
    elif ty == 'qualify':         place(S['qualify'], t, 0.45, 0.0)
    elif ty == 'replay_in':       place(S['replay'], t, 0.4, 0.0)
    elif ty == 'replay_goal':     _stem[0] = 'goal'; place(GOAL, t, GOAL_GAIN * 0.5, 0.0); _stem[0] = 'other'
    elif ty == 'fanfare':         place(S['fanfare'], t + 0.2, 0.75, 0.0); goal_times.append(t)
    elif ty == 'cheer':           place(S['cheer'], t, 0.7, 0.0); place(S['applause'], t + 0.2, 0.5, 0.0)
    elif ty == 'sting_intro':     place(S['intro'], t + 0.1, 0.6, 0.0)
    elif ty == 'firework':        place(S['firework'], t, 0.42, float(np.clip(((e.get('k', 0) * 37) % 10) / 10.0 * 1.2 - 0.6, -0.6, 0.6)))
    elif ty == 'ceremony_sting':  place(S['ceremony_sting'], t, 0.7, 0.0); goal_times.append(t)

# ambient crowd murmur during matches
for seg in show['segments']:
    if seg['type'] in ('match', 'matchPre', 'fulltime', 'lgPre'):
        d = seg['len'] / FPS
        amb = snd_crowd(d, 0.6, 0.6) if d < 60 else snd_crowd(d, 0.6, 0.6)
        place(amb, seg['start'] / FPS, 0.06, 0.0)

# ---------------- music (original, synthesised) ----------------
# P3: per-theme music variant from the map (config/maps/<theme>.json "music": {transpose, bpm, progression, arp});
# no "music" field = the approved v2 track, bit-identical.
MUS = (show.get('map') or {}).get('music') or {}
BPM = float(MUS.get('bpm', 112.0)); beat = 60.0 / BPM; bar = 4 * beat
TRANS = int(MUS.get('transpose', 0))
def midi(n): return 440.0 * 2 ** ((n + TRANS - 69) / 12)
PROGS = {
    # D major: D - A - Bm - G | D - A - G - A (v2)
    'v2': [(50, [62, 66, 69]), (45, [61, 64, 69]), (47, [62, 66, 71]), (43, [62, 67, 71]),
           (50, [62, 66, 69]), (45, [61, 64, 69]), (43, [62, 67, 71]), (45, [61, 64, 69])],
    # D - Bm - G - A (calm, open)
    'open': [(50, [62, 66, 69]), (47, [62, 66, 71]), (43, [62, 67, 71]), (45, [61, 64, 69]),
             (50, [62, 66, 69]), (47, [62, 66, 71]), (43, [62, 67, 71]), (45, [61, 64, 69])],
    # D - G - D - A | Bm - G - A - A (anthem-like, still soft)
    'stride': [(50, [62, 66, 69]), (43, [62, 67, 71]), (50, [62, 66, 69]), (45, [61, 64, 69]),
               (47, [62, 66, 71]), (43, [62, 67, 71]), (45, [61, 64, 69]), (45, [61, 64, 69])],
    # Bm - G - D - A (warm, slightly minor)
    'warm': [(47, [62, 66, 71]), (43, [62, 67, 71]), (50, [62, 66, 69]), (45, [61, 64, 69]),
             (47, [62, 66, 71]), (43, [62, 67, 71]), (50, [62, 66, 69]), (45, [61, 64, 69])],
}
prog = PROGS[MUS.get('progression', 'v2')]
ARP = MUS.get('arp', 'up')
loop_len = int(len(prog) * bar * SR)
loop = np.zeros(loop_len)
def addm(sig, t, g):
    i = int(t * SR); j = min(loop_len, i + len(sig)); loop[i:j] += sig[: j - i] * g
for bi, (root, ch) in enumerate(prog):
    t0 = bi * bar
    # pad
    d = bar + 0.05; tt = t_(d); pad = np.zeros_like(tt)
    for n in ch:
        for det in (-0.07, 0.07):
            f = midi(n) * 2 ** (det / 12)
            for h in range(1, 7): pad += np.sin(2 * np.pi * f * h * tt + h) / h ** 1.8
    pad *= np.minimum(1, tt / 0.25) * np.minimum(1, (d - tt) / 0.2)
    addm(lowpass(pad, 1800), t0, 0.05)
    # bass
    for k, off in enumerate((0, 1.5, 2, 3.5)):
        tt = t_(beat * 0.9); f = midi(root - 12 + (12 if off == 3.5 else 0))
        b = (np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(4 * np.pi * f * tt)) * np.exp(-tt * 3) * np.minimum(1, tt / 0.01)
        addm(b, t0 + off * beat, 0.32)
    # arpeggio (8ths)
    arp = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[1] + 12, ch[0] + 24, ch[2] + 12, ch[1] + 12, ch[2] + 12]
    if ARP == 'down': arp = [ch[2] + 12, ch[1] + 12, ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[0] + 24, ch[2] + 12, ch[1] + 12]
    elif ARP == 'wave': arp = [ch[0] + 12, ch[2] + 12, ch[1] + 12, ch[2] + 12, ch[0] + 24, ch[1] + 12, ch[2] + 12, ch[0] + 24]
    for k, n in enumerate(arp):
        addm(tone(midi(n), 0.5, 4, 1.2, 0.003, 0.16), t0 + k * beat / 2, 0.07)
    # drums
    for k in range(4):
        tk = t0 + k * beat
        if k in (0, 2):
            tt = t_(0.25); f = 55 + 90 * np.exp(-tt * 30)
            addm(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 14), tk, 0.45)
        else:
            tt = t_(0.18); addm(bandnoise(len(tt), 1200, 6000) * np.exp(-tt * 25), tk, 0.12)
        for hh in (0, 0.5):
            tt = t_(0.05); addm(bandnoise(len(tt), 6000, 12000) * np.exp(-tt * 80), tk + hh * beat, 0.05)
loop = loop / np.max(np.abs(loop))
reps = int(np.ceil(N / loop_len)) + 1
mus_full = np.tile(loop, reps)[:N].astype(np.float32)

# music level automation: louder on title/bracket/winner screens, softer under matches
lvl = np.full(N, 0.16, np.float32)
for seg in show['segments']:
    a = int(seg['start'] / FPS * SR); b = int((seg['start'] + seg['len']) / FPS * SR)
    if seg['type'] in ('intro', 'bracket', 'roundCard', 'hook', 'end'): lvl[a:b] = 0.42  # reels: hook + end card  # P2: round title cards like bracket screens
    elif seg['type'] in ('lgIntro', 'lgTable', 'lgTableFull', 'lgResults', 'lgScorers', 'lgGotwCard', 'lgNext', 'lgEurope', 'lgBoot', 'lgPodium', 'lgStats'): lvl[a:b] = 0.36  # P7 league screens
    elif seg['type'] in ('winner', 'lgChampion', 'ceremony'): lvl[a:b] = 0.30
    elif seg['type'] == 'replay': lvl[a:b] = 0.22
# ducking under goals / whistles / fanfare
duck = np.ones(N, np.float32)
for t in goal_times:
    a = int(t * SR); b = min(N, a + int(2.5 * SR))
    ramp = np.linspace(0.35, 1.0, b - a).astype(np.float32)
    duck[a:b] = np.minimum(duck[a:b], ramp)
# smooth level changes (avoid clicks): moving average over 0.3 s via cumulative sum
def smooth_curve(x, w):
    c = np.cumsum(np.concatenate([[0], x])); y = (c[w:] - c[:-w]) / w
    return np.concatenate([np.full(w // 2, y[0]), y, np.full(len(x) - len(y) - w // 2, y[-1])]).astype(np.float32)
for a_, b_ in cine_windows:  # music swell during a cinematic good hit (+3.5 dB, eased by the smoothing below)
    lvl[int(a_ * SR):int(b_ * SR)] *= 1.5
lvl = smooth_curve(lvl, int(0.3 * SR))
music = mus_full * lvl * duck
# fade out at the very end
fo = int(1.2 * SR); music[-fo:] *= np.linspace(1, 0, fo)

mix = fx * 0.9 + music[None, :]
end = int((show['totalFrames'] / FPS) * SR)
mix = mix[:, :end]
fo = int(0.8 * SR); mix[:, -fo:] *= np.linspace(1, 0, fo)[None, :]
peak = np.max(np.abs(mix)); mix = mix / peak * 0.89
out = (mix.T * 32767).astype(np.int16)
path = OUT_PATH
with wave.open(path, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(out.tobytes())
print('audio written', path, 'seconds', end / SR, 'events', sum(cnt.values()), json.dumps(cnt))

if show.get('reel'): sys.exit(0)  # reels: no goal-sample report (it belongs to the long video)
# ---------------- goal sound samples + peak / loudness / masking report ----------------
def write_wav(pth, x):
    x = np.clip(x, -1, 1)
    with wave.open(pth, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x * 32767).astype(np.int16).tobytes())
def db(x): return float(20 * np.log10(max(x, 1e-9)))
def rms(x): return float(np.sqrt(np.mean(np.square(x)))) if len(x) else 0.0
def st_max(x, w=int(0.4 * SR), hop=int(0.1 * SR)):  # max short-term (400 ms) RMS
    if len(x) < w: return rms(x)
    return max(rms(x[i:i + w]) for i in range(0, len(x) - w + 1, hop))
sdir = os.path.join(ROOT, 'output', 'goal_sfx_samples'); os.makedirs(sdir, exist_ok=True)
scale = 0.9 / peak  # same scaling as the final mix (before ffmpeg loudnorm)
rep = {'selected': SEL, 'custom_file_used': CUSTOM_USED, 'samples': {}, 'reference_effects': {}, 'in_mix': []}
SAMPLES = {k: v for k, v in CROWD.items()}; SAMPLES['golden_goal'] = GOLDEN_GOAL
if CUSTOM_USED: SAMPLES['custom'] = GOAL
for k, x in SAMPLES.items():
    if k in CROWD: write_wav(os.path.join(sdir, f'crowd_{k}.wav'), x / (np.max(np.abs(x)) + 1e-9) * 0.89)
    elif k == 'golden_goal': write_wav(os.path.join(sdir, 'crowd_golden_goal.wav'), x / (np.max(np.abs(x)) + 1e-9) * 0.89)
    placed = x * GOAL_GAIN * 0.9 * 1.41 * scale
    rep['samples'][k] = {'duration_s': round(len(x) / SR, 3), 'peak_dBFS_in_mix': round(db(np.max(np.abs(placed))), 1), 'max_shortterm_rms_dBFS_in_mix': round(db(st_max(placed)), 1)}
for name, x, g in (('whistle_end', S['w_end'], 0.5), ('bar_metal', S['bar'][0], 0.55), ('ground_thump', S['ground'][0], 0.45), ('windmill_knock', S['mill'][0], 0.55), ('golden_sting', S['golden'], 0.7), ('net', S['net'][0], 0.35)):
    placed = x * g * 0.9 * 1.41 * scale
    rep['reference_effects'][name] = {'peak_dBFS_in_mix': round(db(np.max(np.abs(placed))), 1), 'max_shortterm_rms_dBFS_in_mix': round(db(st_max(placed)), 1)}
# masking in the real mix: per goal event, goal stem vs everything else in the 1.8 s after the goal
for e in show['audio']:
    if e['type'] != 'goal': continue
    a = int(e['t'] * SR); b = min(N, a + int(1.8 * SR))
    g_ = fx_goal[a:b] * 0.9 * scale; o_ = fx_other[a:b] * 0.9 * scale; m_ = music[a:b] * scale
    rep['in_mix'].append({'t': round(e['t'], 2), 'goal_rms_dBFS': round(db(rms(g_)), 1), 'other_fx_rms_dBFS': round(db(rms(o_)), 1),
        'music_rms_dBFS': round(db(rms(m_)), 1), 'goal_minus_other_dB': round(db(rms(g_)) - db(rms(o_)), 1), 'goal_peak_dBFS': round(db(np.max(np.abs(g_))), 1)})
ref_peak = max(v['peak_dBFS_in_mix'] for v in rep['reference_effects'].values())
ref_st = max(v['max_shortterm_rms_dBFS_in_mix'] for v in rep['reference_effects'].values())
sel = rep['samples'][rep['selected']] if rep['selected'] in rep['samples'] else rep['samples']['A']
rep['criteria'] = {'goal_peak_not_above_loudest_effect_peak': sel['peak_dBFS_in_mix'] <= ref_peak, 'goal_shortterm_not_above_loudest_effect_shortterm': sel['max_shortterm_rms_dBFS_in_mix'] <= ref_st,
                   'crowd_samples_le_2_5s': all(rep['samples'][k]['duration_s'] <= 2.5 for k in ('A', 'B', 'C', 'golden_goal')), 'loudest_ref_peak_dBFS': ref_peak, 'loudest_ref_shortterm_dBFS': ref_st}
json.dump(rep, open(os.path.join(ROOT, 'build', 'audio_goal_report.json'), 'w'), indent=1)
print('goal sfx report', json.dumps(rep['criteria']))
