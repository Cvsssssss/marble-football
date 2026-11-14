"""P10 crowd + weather audio (numpy only, our own synthesis: filtered noise, formant bands, synthetic claps and drums;
no recordings, no music, no melodies). Driven by the crowd events that sim/atmosphere.js puts in show['audio']:
  crowd_bed (level follows the ball's proximity to the goal), weather_bed (wind / rain), crowd_roar (scoring side
  louder), crowd_groan (other side), crowd_gasp (bar/post, save, good hit, near miss), crowd_applause (final whistle),
  crowd_drums (non-melodic drum + clap rhythm in quiet moments), mill_thump (sub-bass on windmill bomb hits), lights_on.
Deterministic: every sound uses its own generator seeded from the match index and event order.
Used by audio/make_audio.py (render_into); standalone report for the tests:
  python audio/crowd.py <show.json> <report.json> [t0 t1]   -> crowd bus only, onset check per event + peak/RMS/LUFS
"""
import json, sys
import numpy as np

SR = 48000
SIDE_PAN = {'A': -0.55, 'B': 0.55}


def _rng(*k):
    return np.random.default_rng([int(x) & 0xffffffff for x in k])


def band(rng, n, lo, hi, order=4):
    x = rng.standard_normal(n)
    X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR)
    c, w = (lo + hi) / 2, (hi - lo) / 2 + 1
    y = np.fft.irfft(X / (1 + ((f - c) / w) ** order), n)
    return y / (np.max(np.abs(y)) + 1e-9)


def env(n, a, d, hold=0.0):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a - hold) / max(d, 1e-4))


def fade(x, fi=0.05, fo=0.2):
    n = x.shape[-1]; a = min(n, int(fi * SR)); b = min(n, int(fo * SR))
    x[..., :a] *= np.linspace(0, 1, a); x[..., n - b:] *= np.linspace(1, 0, b)
    return x


def crowd_voices(rng, n, formants, slow=0.7):
    """many voices: noise in a few formant bands with slow random swells (stereo pair, decorrelated)"""
    out = np.zeros((2, n))
    for ch in range(2):
        y = np.zeros(n)
        for (lo, hi, g) in formants:
            y += g * band(rng, n, lo, hi)
        k = max(2, int(n / SR * slow * 4))  # slow amplitude wobble
        pts = rng.uniform(0.75, 1.0, k + 1)
        y *= np.interp(np.arange(n), np.linspace(0, n, k + 1), pts)
        out[ch] = y
    return out / (np.max(np.abs(out)) + 1e-9)


def roar(rng, d=2.8, k=1.0):
    n = int(d * SR)
    v = crowd_voices(rng, n, [(250, 700, 1.0), (700, 1300, 0.9), (1300, 2600, 0.55), (2600, 5000, 0.2)])
    e = env(n, 0.12, 1.2 + 0.6 * k, hold=0.3 + 0.3 * k)
    return fade(v * e, 0.01, 0.4)


def groan(rng, d=1.1):
    n = int(d * SR)
    v = crowd_voices(rng, n, [(160, 480, 1.0), (480, 800, 0.45)])
    t = np.arange(n) / SR
    return fade(v * env(n, 0.1, 0.5) * (1 - 0.4 * t / d), 0.02, 0.25)


def gasp(rng, d=1.4):
    """'ooh' gliding into 'ahh': the low formant band fades out while a brighter one fades in"""
    n = int(d * SR); t = np.arange(n) / SR; u = np.clip(t / (d * 0.7), 0, 1)
    oo = crowd_voices(rng, n, [(260, 560, 1.0), (560, 900, 0.35)])
    ah = crowd_voices(rng, n, [(600, 1150, 1.0), (1150, 2200, 0.5)])
    x = oo * (1 - u) + ah * u
    return fade(x * env(n, 0.18, 0.7, hold=0.25), 0.02, 0.3)


def claps(rng, d, density, lo=900, hi=4000, n_tmpl=6):
    n = int(d * SR); out = np.zeros((2, n))
    tm = [band(rng, int(0.025 * SR), lo, hi) * env(int(0.025 * SR), 0.0008, 0.006) for _ in range(n_tmpl)]
    cnt = int(density * d)
    for _ in range(cnt):
        i = int(rng.uniform(0, n - len(tm[0]))); ch = rng.uniform(0.2, 1.0)
        s = tm[int(rng.integers(0, n_tmpl))] * rng.uniform(0.4, 1.0)
        out[0, i:i + len(s)] += s * ch; out[1, i:i + len(s)] += s * (1.2 - ch)
    return out


def applause(rng, d=4.5):
    x = claps(rng, d, 520)
    n = x.shape[1]; e = env(n, 0.4, 1.6, hold=1.4)
    x = x * e
    return x / (np.max(np.abs(x)) + 1e-9)


def drum_hit(rng):
    n = int(0.32 * SR); t = np.arange(n) / SR
    f = 62 + 40 * np.exp(-t * 28)  # fixed low drum (one pitch, a percussion hit, not a melody)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)
    return body + 0.25 * band(rng, n, 200, 1200) * np.exp(-t * 40)


def drums(rng, d=5.0, bpm=104):
    """non-melodic stadium rhythm: drum, drum-drum, then three claps from the crowd, repeated"""
    n = int(d * SR); out = np.zeros(n); beat = 60.0 / bpm
    dh = drum_hit(rng); cl = [band(rng, int(0.05 * SR), 900, 3500) * env(int(0.05 * SR), 0.001, 0.012) for _ in range(4)]
    pat = [(0, 'd'), (1, 'd'), (1.5, 'd'), (2, 'c'), (2.5, 'c'), (3, 'c')]
    t = 0.0
    while t < d - 0.4:
        for off, kind in pat:
            i = int((t + off * beat) * SR)
            if i >= n: break
            s = dh * 0.9 if kind == 'd' else sum(c * rng.uniform(0.6, 1) for c in cl) * 0.5  # a few hands at once
            j = min(n, i + len(s)); out[i:j] += s[:j - i]
        t += 4 * beat
    out *= np.minimum(1, np.arange(n) / (0.6 * SR)) * np.minimum(1, (n - np.arange(n)) / (0.8 * SR))
    return out / (np.max(np.abs(out)) + 1e-9)


def thump(rng):
    n = int(0.45 * SR); t = np.arange(n) / SR
    x = np.sin(2 * np.pi * (42 + 30 * np.exp(-t * 18)) * t) * np.exp(-t * 7) + 0.15 * band(rng, n, 80, 400) * np.exp(-t * 30)
    return x / (np.max(np.abs(x)) + 1e-9)


def lights_clunk(rng):
    n = int(0.5 * SR); t = np.arange(n) / SR
    x = 0.8 * np.sin(2 * np.pi * 110 * t) * np.exp(-t * 22) + 0.5 * band(rng, n, 1800, 6000) * np.exp(-t * 35) + 0.2 * band(rng, n, 50, 120) * np.exp(-t * 6)
    return x / (np.max(np.abs(x)) + 1e-9)


def wind_bed(rng, d, strength):
    n = int(d * SR)
    x = np.stack([band(rng, n, 60, 420, 2), band(rng, n, 60, 420, 2)])
    k = max(2, int(d / 2.5)); g = np.interp(np.arange(n), np.linspace(0, n, k + 1), rng.uniform(0.35, 1.0, k + 1))
    return x * g * (0.4 + 0.6 * strength)


def rain_bed(rng, d):
    n = int(d * SR)
    x = np.stack([band(rng, n, 2500, 9000, 2), band(rng, n, 2500, 9000, 2)]) * 0.6
    x += claps(rng, d, 160, 3000, 9000) * 0.5  # drops ticking on the stands
    return x


def bed_curve(show, e, n):
    """crowd bed level: 0.35 + 0.65 * proximity of the ball to the goal (10 Hz curve from show['atmo']); intro: rising"""
    if e.get('intro'):
        return np.linspace(0.25, 0.5, n)
    at = show['atmo']['matches'][e['match']]
    p = np.array(at['prox'] + [at['prox'][-1]], float)
    step = at.get('proxStep', 3) / show['fps']
    tt = np.arange(n) / SR
    return 0.35 + 0.65 * np.interp(tt, np.arange(len(p)) * step, p)


def plan(show):
    return [e for e in show['audio'] if e['type'] in ('crowd_bed', 'weather_bed', 'crowd_roar', 'crowd_groan', 'crowd_gasp', 'crowd_applause', 'crowd_drums', 'mill_thump', 'lights_on')]


def render_into(show, out, t_off=0.0, gain=1.0):
    """adds the crowd/weather bus into out (2 x N float array, starting at show time t_off); returns event counts"""
    N = out.shape[1]; cnt = {}
    g0 = gain * float((show.get('atmoCfg') or {}).get('crowd_gain', 1.0))

    def put(sig, t, g, pan=0.0):
        i = int(round((t - t_off) * SR))
        if sig.ndim == 1: sig = np.stack([sig, sig])
        if i >= N or i + sig.shape[1] <= 0: return
        a = max(0, -i); j = min(N, i + sig.shape[1])
        l = np.cos((pan + 1) * np.pi / 4) * 1.41; r = np.sin((pan + 1) * np.pi / 4) * 1.41
        out[0, i + a:j] += sig[0, a:j - i] * g * g0 * l; out[1, i + a:j] += sig[1, a:j - i] * g * g0 * r

    for k, e in enumerate(plan(show)):
        ty, t = e['type'], e['t']; cnt[ty] = cnt.get(ty, 0) + 1
        if t - t_off > N / SR or t + e.get('d', 6) < t_off: continue
        R = _rng(e.get('match', 0), k, 4242)
        if ty == 'crowd_bed':
            n = int(e['d'] * SR); v = crowd_voices(R, n, [(220, 650, 1.0), (650, 1400, 0.7), (1400, 3000, 0.3)], slow=0.4)
            put(fade(v * bed_curve(show, e, n), 0.3, 0.6), t, 0.075)
        elif ty == 'weather_bed':
            if e.get('kind') in ('day', 'overcast', 'evening', 'night'):
                put(fade(wind_bed(R, e['d'], e.get('wind', 0.4)), 0.4, 0.6), t, 0.035)
            if e.get('rain'): put(fade(rain_bed(R, e['d']), 0.4, 0.6), t, 0.03)
        elif ty == 'crowd_roar': put(roar(R, 2.4 + 0.5 * e.get('k', 1), e.get('k', 1)), t, 0.26 * min(1.5, e.get('k', 1)), SIDE_PAN.get(e.get('side'), 0))
        elif ty == 'crowd_groan': put(groan(R), t, 0.10, SIDE_PAN.get(e.get('side'), 0))
        elif ty == 'crowd_gasp': put(gasp(R), t, 0.20, 0.0)
        elif ty == 'crowd_applause': put(applause(R), t + 0.3, 0.22, 0.0)
        elif ty == 'crowd_drums': put(drums(R, e.get('d', 5)), t, 0.09, SIDE_PAN.get(e.get('side'), 0) * 0.8)
        elif ty == 'mill_thump': put(thump(R), t, 0.42, -0.35)
        elif ty == 'lights_on': put(lights_clunk(R), t, 0.22, 0.0)
    return cnt


# ---------- loudness (ITU-R BS.1770 style, K-weighting applied as a magnitude response in the frequency domain) ----------
def k_weight_mag(f):
    f = np.maximum(f, 1.0)
    hs = 1 + (10 ** (4 / 20) - 1) * (f / 1500) ** 2 / (1 + (f / 1500) ** 2)  # +4 dB high shelf above ~1.5 kHz
    hp = (f / 38) ** 2 / (1 + (f / 38) ** 2)                                  # RLB high-pass (~38 Hz)
    return hs * hp


def lufs(x):
    """integrated loudness of a stereo signal (2 x n), 400 ms blocks, absolute (-70) + relative (-10 LU) gates"""
    n = x.shape[1]
    if n < int(0.4 * SR): return -99.0
    f = np.fft.rfftfreq(n, 1 / SR); K = k_weight_mag(f)
    y = np.stack([np.fft.irfft(np.fft.rfft(c) * K, n) for c in x])
    w, hop = int(0.4 * SR), int(0.1 * SR)
    ms = np.array([np.mean(y[:, i:i + w] ** 2, axis=1).sum() for i in range(0, n - w + 1, hop)])
    L = -0.691 + 10 * np.log10(ms + 1e-12)
    g = ms[L > -70]
    if not len(g): return -99.0
    rel = -0.691 + 10 * np.log10(np.mean(g)) - 10
    g2 = ms[(L > -70) & (L > rel)]
    return float(-0.691 + 10 * np.log10(np.mean(g2) + 1e-12))


if __name__ == '__main__':
    show = json.load(open(sys.argv[1], encoding='utf8'))
    t0 = float(sys.argv[3]) if len(sys.argv) > 3 else 0.0
    t1 = float(sys.argv[4]) if len(sys.argv) > 4 else show['totalFrames'] / show['fps']
    out = np.zeros((2, int((t1 - t0) * SR)))
    cnt = render_into(show, out, t0)
    def st(a, b):
        i, j = int((a - t0) * SR), int((b - t0) * SR)
        if j <= i or i < 0 or j > out.shape[1]: return None
        return float(20 * np.log10(np.sqrt(np.mean(out[:, i:j] ** 2)) + 1e-9))
    onsets = []
    for e in plan(show):
        if e['type'] in ('crowd_roar', 'crowd_gasp', 'mill_thump', 'crowd_applause') and t0 + 1.2 < e['t'] < t1 - 1.5:
            d0 = 0.3 if e['type'] == 'crowd_applause' else 0.0
            onsets.append({'type': e['type'], 't': e['t'], 'before_dB': st(e['t'] - 0.9 + d0, e['t'] - 0.05 + d0), 'after_dB': st(e['t'] + 0.05 + d0, e['t'] + 0.9 + d0)})
    rep = {'t0': t0, 't1': t1, 'events': cnt, 'peak': float(np.max(np.abs(out))), 'rms_dBFS': float(20 * np.log10(np.sqrt(np.mean(out ** 2)) + 1e-9)), 'lufs': round(lufs(out), 1), 'onsets': onsets}
    json.dump(rep, open(sys.argv[2], 'w'), indent=1)
    print(json.dumps({k: rep[k] for k in ('peak', 'rms_dBFS', 'lufs', 'events')}))
