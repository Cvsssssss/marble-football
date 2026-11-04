# PROGRESS

- 09:20 Env check: Node 24.22, npm 11.19, pnpm 12.16, Python 3.14 + numpy 2.5.2 present. ffmpeg missing on PATH.
- Installed via npm (no admin needed): matter-js 0.19.0, playwright 1.48.2 (+ chromium), ffmpeg-static 5.2.0 (ffmpeg 6.0, libx264 + aac), ffprobe-static 3.1.0.
- scipy not present -> audio uses numpy only; loudness normalisation done with ffmpeg `loudnorm` (EBU R128).
- Sim: matter-js 0.19, 120 Hz, mulberry32. Engine gravity disabled; gravity applied manually to balls so kinematic bodies (windmill, keeper parts) don't drift. Kinematic driving: setPosition/setAngle + positionPrev/anglePrev = cur - (next-cur) so contacts see the true velocity; mass 1e7, inertia Infinity.
- Windmill tuning, attempt 1 (g=650, w=4.5, e=0.6, free toss): only ~1% of tosses reach the right side (launch angles 60-75 deg, too steep: ball floats to apex before an arm arrives).
- Attempt 2: grid over g/w/restitution: best 42% at w=6, still mostly steep launches.
- Attempt 3 (kept): outlet tosses at a windmill phase window (TOSS_PHASE=2.75 rad +-0.22 jitter); g=500, w=4.5 rad/s CCW, windmill restitution 0.85 -> ~70% reach right platform/goal, ~28% void, ~2% back left.
- Strength: bigger ball wins more often. +-5% radius -> 55.5% (800 matches, balanced A/B) -> raised to +-6.5%.
- Keeper bob saturated (8 identical frames) -> fixed bob range; golden-ball random finals 59/61 resolved in 40 s -> added in-sim "widen flow x1.3 after 20 s of golden ball" (spec remedy).
- Renderer stage-1 review: fixed camera zoom showing black outside the scene (clamped camera), olive golden pill (alpha) -> solid, tiny HUD ball indicators -> bigger, duplicate FINAL label, translucent full-time card.
- Audio: numpy synth (SFX from events + original music loop in D major, 112 bpm) -> ffmpeg loudnorm two-pass to -14 LUFS.
- Bug: show builder overwrote event time with undefined -> fixed.
- Full render started (10 workers).
- Full render #1: 9399 frames in 147 s (10 Chromium pages). Mux failed: loudnorm -> channel layout negotiation error; fixed with aformat=stereo + -ac 2. Final probe OK (1920x1080, 30 fps, H.264 High, AAC 48k stereo, -14.1 LUFS, TP -1.5).
- Strength re-measured: +-6.5% -> 53.1%, +-8% -> 53%, +-3% -> 56%, +-5% -> 55.1% / 58.8% (same seeds, roles swapped). Size lever is weak/noisy; kept +-5% and made the test play every seed in both orientations.
- Rebuild via `node build_all.js` (tests -> tournament -> screenshots -> audio -> render -> mux -> re-check).

## P1 — demo v2 (2026-11-04)
- Baseline v1 tests 26/26. Config architecture in config/ + sim/config_loader.js (schema). build_all.js --competition.
- Crossbar: swept one-way top (collider == drawing): max overlap 25.8 px -> 0.0 px over 5000 throws.
- Windmill boost 68-72': first try lowered goal rate (-17%), fixed by ramping the toss phase to 2.9 -> launch +34%, goals +10%.
- v1 bug found: matter-js deep-copies plugin -> collision events x/y=0; data fixed, v1 look/sound kept.
- pixel_probe heredoc lost a backslash -> fixed (no repeated failures beyond that).
- Final: 45/45 tests, output/demo_v2_1080p.mp4 5:35, -14.1 LUFS. Details: reports/P1_REPORT.md
