# PROMPT_DEMO.md — un singur prompt, video demo livrat de Claude Code

(Note pentru Max, în română: acest fișier ESTE promptul. Îl rulezi o singură dată, vezi comanda la final. Claude Code lucrează singur, fără să se oprească, și la sfârșit îți lasă videoul și un raport. Nu garantează calitatea; de aceea promptul îl obligă să-și verifice singur rezultatul cu capturi și să corecteze.)

---

## PROMPT (de la această linie în jos se dă lui Claude Code)

You are building a **demo video** of a marble-football tournament. Work **fully autonomously from start to finish in this single run**. Do NOT stop to ask me questions and do NOT wait for approval. If something is ambiguous, pick the simplest reasonable option consistent with this document, write the decision in `REPORT.md`, and continue. Only stop if the environment makes progress impossible, and then say exactly what blocks you.

**Final deliverable:** `output/demo_final_1080p.mp4` (about 4–6 minutes, 1920×1080, 16:9, 30 fps, H.264 + AAC, with sound), plus `output/screenshots/` (key moments) and `REPORT.md` (what works, what does not, every decision you took, how to re-run).

**Scope:** ONLY the demo video. No server, no Telegram, no database, no YouTube upload, no web app, no Docker. Do not add features that are not in this document.

### 0. Environment
Windows PC. Check and install what is missing: Node.js, pnpm (or npm), ffmpeg, Python 3 with numpy (for audio), Chromium via Playwright (`npx playwright install chromium`). Use a clean project folder structure (`sim/`, `render/`, `audio/`, `output/`, `tests/`). Keep a `PROGRESS.md` log. Never loop on the same failing step more than 3 times; try a different approach and note it.

### 1. Architecture (use this, do not switch without a strong reason)
1. **Deterministic simulation** in Node: 2D physics with matter-js, fixed timestep (120 Hz), seeded RNG (mulberry32). Output a **timeline JSON** (per-frame ball/keeper/windmill state + event list).
2. **Seed gate:** simulate many seeds per match and automatically select one that satisfies all rules in §6.
3. **Renderer:** draw each frame with Canvas 2D in headless Chromium (Playwright), **frame-by-frame, deterministic**, 1920×1080 (design in a 1280×720 coordinate space and scale ×1.5 with supersampling). Render **in parallel** across CPU cores, write JPEG/PNG frames.
4. **Audio:** generate from the event list (numpy), mix with original music, normalise to about −14 LUFS.
5. **ffmpeg** to mux the final MP4.

Physics lessons already learned (apply them): use `friction=0, frictionStatic=0` on balls and statics; cap ball speed to avoid tunnelling; matter-js velocity units are per **base step of ~16.67 ms**, not per your sub-step, so convert (px/s ÷ 60); drive kinematic bodies (windmill, keeper) with `Body.setPosition(body, pos, true)` and `Body.setAngle(body, angle, true)`; give kinematic bodies huge mass and infinite inertia.

### 2. The match scene (all coordinates in a 1280×720 design space)
- **Sky:** clean blue vertical gradient. No clouds, no sun.
- **Two earth platforms**, left and right, with grass on top, top surface at y≈560, each about 380 px wide, rock below with soft texture. A **void** (gap) between them. Anything falling below the screen bottom is "out".
- **RIGHT side: exactly ONE goal**, flush with the right screen edge, standing on the grass, mouth facing the centre. Thick white **front post**, net with a fine square grid, **flat top** (not slanted), crossbar at y≈390 (goal ≈170 px tall, ≈118 px deep). A **goalkeeper** stands about two steps in front of the post, drawn in **profile facing the centre**, small (≈78 % of a first draft), neutral orange kit.
- **LEFT side: exactly ONE windmill ("moriscă")**: a **single straight bar** (~190 px) rotating about a hub, with **small curved hooks at both ends**, each hook about one ball in size (curling-stone look, gently curved, NOT strongly curled). Hub placed so that, when the bar is vertical, its tip is **exactly one ball diameter above the ground**. **Hook direction must be the INVERSE of my previous demo**: orient the hooks so that they **cradle/scoop the ball in the direction of rotation** (leading side curved toward the direction of travel), and **verify with a test** (see §6) that a ball tossed from the spout is picked up and thrown toward the right platform/goal. Tune the angular speed by experiment (the earlier value around 4.5 rad/s counter-clockwise reached the goal area).
- **Spout (ball outlet):** a hole in the left platform's ground, just to the **right of and below the windmill hub**. Balls come out **one at a time, in turn**, tossed upward gently so the windmill hits them. A small collar marks the spout and a tiny ring pop-effect plays on release.
- **Return pipe:** a long simple pipe along the **left screen edge** from the top of the screen straight down, then under the left platform to the right, then up to the spout. **Simple, flat, muted, low-contrast colour** so that attention stays on the balls. **No portals, no flanges, no rivets, no metallic details.** A ball that falls into the void, or flies over the goal, is **teleported** to the top of the pipe, falls through it, travels underground and queues at the spout.
- **Balls:** realistic football look (shading, highlight, patches, soft shadow), team-coloured (team A light blue, team B white), noticeably **larger than in the earlier demo** (radius ≈ 18 px in design space; tune for readability at 1080p, minimum clearly visible on a phone).

### 3. Rules of play
- Two teams per match, `BALLS_PER_TEAM = 3` (parameter). Outlet order alternates A, B, A, B… (FIFO queue), interval randomised in about 1.6–2.4 s of video time.
- Balls collide with: **other balls, the goalkeeper, the windmill, the ground and side walls**. The **crossbar** is solid **only on its top surface** (a ball falling from above bounces off it). Otherwise there is **no collision with the goal frame**: the ball enters the goal, falls, or flies over. No collision with posts.
- **Goalkeeper never stands still.** Repeating cycle with random variation in timing and jump height: **crouch with hands down**, then **jump with both hands up**. Make the pose and the collider match (arms up add reach while jumping). Beautiful goals happen when the ball enters while he is crouched, or passes under him while he is in the air.
- **Goal:** the point goes to the team **of the ball that entered** ("who scores, wins the point"). **The ball does NOT stay in the goal**: play a goal animation, then **teleport the ball into the return pipe**; it continues playing.
- Anti-stuck rule: a ball nearly motionless for more than about 1.3 s is teleported into the pipe (technical rule, keep the count low).
- **Cards and superpowers are OFF** in this demo (flags `CARDS=false`, `POWERS=false`; keep the code path optional but unused).
- **Team strength** (illustrative): slightly favour the stronger team via a small ball-size/weight difference (±5–8 %) or slightly different keeper jump; **measure** win rates over many simulated matches and keep the favourite around 55–62 %. The strength numbers are illustrative, not real data.

### 4. Match clock and results
- Display a game clock **0' to 90'** plus **added time of 1, 2 or 3 minutes** announced at 90' ("+2"). **1 second of video = 2 game minutes** (parameter `GAME_MIN_PER_SEC`), so a match is about 45–55 s of video. A short half-time flash at 45'.
- **Goals per match between 1 and 10** (seed gate).
- **No penalties. Tie-break = GOLDEN BALL:** if the result that decides who advances is level after 90'+added time, show a "GOLDEN BALL" banner; the clock keeps running; **the first ball that enters the goal decides the match** (the team of that ball wins).
- **Two-legged ties (semifinals):** after the second leg compare the **aggregate** score; if level → golden ball in the second leg. The second-leg display shows the match score **and the aggregate in brackets**, e.g. `2–1 (3–2)`.
- **Final:** a single match; level after 90'+added time → golden ball.
- The seed gate must pick simulations where golden ball resolves within about 40 s of video time. If a golden ball does not resolve in the cap, widen the spout flow slightly (do not decide by random draw).

### 5. The demo video: structure and interface
Four teams, names as **plain text only** (no logos, no official emblems, no official competition names, no real trophy design, no anthem). Defaults: **Manchester City, Real Madrid, Bayern Munich, Arsenal** (text only). Competition name: **MARBLE CUP**. Semifinal 1: team 1 vs team 4; semifinal 2: team 2 vs team 3.

Order of the video:
1. **Intro (4–6 s):** title card, the four teams.
2. **Bracket intro (4 s):** the bracket with the four teams placed.
3. **Semifinal 1:** leg 1 match → animated bracket update (≈2–3 s) → leg 2 match (score + aggregate in brackets) → bracket update with the aggregate and the team that advances moving to the final line.
4. **Semifinal 2:** same.
5. **Bracket (4 s):** both finalists, qualification animation.
6. **Final** (single match, golden ball if level).
7. **Winner:** trophy animation (original, simple trophy drawing), confetti, cheering sound. **The video ends when the final is won.**

Interface: bracket 4 → 2 → 1, team name + team colour, clear typography, minimal style. In-match overlay: score, game clock (with "+N" and "GOLDEN BALL" states), "LEG 1 / LEG 2 / FINAL", per-team balls indicator. Text must stay readable on a phone.

### 6. Automatic checks (write them as tests and make them pass; run them before rendering)
- No ball permanently stuck; anti-stuck teleports per match ≤ a small limit (record it).
- No ball remains in the goal after a goal; every ball is accounted for at every frame.
- Goals per match between 1 and 10.
- Golden ball resolves within the cap.
- Determinism: same seed → identical timeline hash.
- Clock: ends at 90' + added time (1–3), aggregate computed correctly, correct team advances in the bracket in every case including golden ball.
- **Windmill test:** over many tosses from the spout, a good share of balls reach the right platform or goal (report the percentage); balls are not simply returned or dropped into the void every time.
- Crossbar: balls bounce only off its top; no collision with posts.
- Keeper: crouch/jump cycle present, both poses visible in screenshots.

### 7. Visual and audio quality bar
- 1920×1080, 30 fps, anti-aliased, clean flat-vector look with soft gradients and shadows.
- Effects: goal moment gets a **short camera zoom and slight screen shake**, motion trail on fast balls, **slow-motion replay of the goal of the match** (short), confetti and trophy animation at the end. Keep the return pipe discreet.
- **Sound effects:** ball on ground, ball on windmill, ball on keeper, ball on the top of the crossbar (short metallic), ball-ball, outlet pop, pipe whoosh, goal (short horn + crowd), whistles (start, half-time, end), golden-ball sting, trophy fanfare. **Music:** simple, pleasant, **original (synthesised by you)**, no third-party tracks. Mix so effects are clear over music.

### 8. Self-review loop (mandatory, this replaces my approval)
After each stage (scene stills, one match, the full tournament):
1. Render **screenshots at key moments** (kick-off, ball leaving the outlet, windmill hit, keeper crouched, keeper jumping, goal, bar hit, golden ball banner, bracket, trophy) and **open them with the image-reading tool** to inspect them yourself.
2. Compare against this document item by item. List every deviation.
3. **Fix and re-render** until the deviations are gone or you cannot fix them. Repeat at most 4 times per stage.
4. Record what remains imperfect, honestly, in `REPORT.md`.
Finish by checking the final MP4 with `ffprobe` (resolution, fps, duration, audio stream) and by sampling frames from the beginning, middle and end.

### 9. Report
`REPORT.md` must contain: what was built; file map; how to re-run (one command); the checks and their results; windmill reach percentage; win-rate result for strength; known problems; decisions taken instead of asking me; the final video path and duration.

Start now.

---

## Cum îl rulezi (Windows, PowerShell)

1. Creează un folder gol, de exemplu `C:\Users\maxym\Desktop\marble-demo`, și pune acolo acest fișier.
2. În PowerShell, în acel folder:

```
claude -p (Get-Content .\PROMPT_DEMO.md -Raw) --permission-mode acceptEdits --max-turns 400 --max-budget-usd 25
```

- `--max-budget-usd 25` este un plafon de siguranță ales de mine, nu o estimare de cost. Dacă se oprește pe plafon, relansezi cu aceeași comandă și Claude Code reia din `PROGRESS.md`.
- Dacă vrei să-l vezi lucrând interactiv, poți lipi textul de după „PROMPT" direct în `claude` (fără `-p`).
