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
GOAL_SFX = {'A': goal_A(), 'B': goal_B(), 'C': goal_C()}
GOAL = GOAL_SFX[ACFG.get('goal_sfx', 'A')]
GOAL_GAIN = 0.55

def pan_x(x): return float(np.clip((x / 1280.0) * 2 - 1, -1, 1)) * 0.6
cnt = {}
goal_times = []
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
        _stem[0] = 'goal'; place(GOAL, t, GOAL_GAIN, 0.0); _stem[0] = 'other'; goal_times.append(t)
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

# ambient crowd murmur during matches
for seg in show['segments']:
    if seg['type'] in ('match', 'matchPre', 'fulltime'):
        d = seg['len'] / FPS
        amb = snd_crowd(d, 0.6, 0.6) if d < 60 else snd_crowd(d, 0.6, 0.6)
        place(amb, seg['start'] / FPS, 0.06, 0.0)

# ---------------- music (original, synthesised) ----------------
BPM = 112.0; beat = 60.0 / BPM; bar = 4 * beat
def midi(n): return 440.0 * 2 ** ((n - 69) / 12)
# D major: D - A - Bm - G | D - A - G - A
prog = [(50, [62, 66, 69]), (45, [61, 64, 69]), (47, [62, 66, 71]), (43, [62, 67, 71]),
        (50, [62, 66, 69]), (45, [61, 64, 69]), (43, [62, 67, 71]), (45, [61, 64, 69])]
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
    if seg['type'] in ('intro', 'bracket'): lvl[a:b] = 0.42
    elif seg['type'] == 'winner': lvl[a:b] = 0.30
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
rep = {'selected': ACFG.get('goal_sfx', 'A'), 'samples': {}, 'reference_effects': {}, 'in_mix': []}
for k, x in GOAL_SFX.items():
    write_wav(os.path.join(sdir, f'goal_{k}.wav'), x * 0.89)
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
sel = rep['samples'][rep['selected']]
rep['criteria'] = {'goal_peak_not_above_loudest_effect_peak': sel['peak_dBFS_in_mix'] <= ref_peak, 'goal_shortterm_not_above_loudest_effect_shortterm': sel['max_shortterm_rms_dBFS_in_mix'] <= ref_st,
                   'all_samples_le_1_8s': all(v['duration_s'] <= 1.8 for v in rep['samples'].values()), 'loudest_ref_peak_dBFS': ref_peak, 'loudest_ref_shortterm_dBFS': ref_st}
json.dump(rep, open(os.path.join(ROOT, 'build', 'audio_goal_report.json'), 'w'), indent=1)
print('goal sfx report', json.dumps(rep['criteria']))
