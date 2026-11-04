Există: 3 reel-uri verticale 1080×1920 (`output/reels/reel1..3_*/reel.mp4`, 53–54 s, −14 LUFS), fiecare cu `suggestions.txt`, plus `output/reels/selection.json`.
Mai există 4 teme de hartă (cer albastru, stadion ziua, stadion noaptea, apus), 3 competiții noi (MARBLE CONTINENTAL, MARBLE WORLD NATIONS, MARBLE EURO NATIONS) cu jucători, sigle și steaguri, și folderul `plan/` (reguli, plan pe 12 videouri, verificarea unicității).
De văzut: `output/screenshots_f03/` (reel 1, câte o captură pe secundă), `output/screenshots_f04/variants.png` (4 teme × 2 competiții) și previzualizările `output/screenshots_f04/preview_*_720p.mp4`.
Nu am verificat: mișcarea camerei verticale în video (poate părea că „plutește” între zone) și sunetul ascultat. Testele P3: 25/25.
Decizie: la EURO am scos Rusia (suspendată de UEFA) și am pus Ucraina. Numerele marcate cu * în `players_review.md` nu apar în sursă.

# P3 — Vertical reels + variants + `plan/`: details

## Part A — reels
| # | Match (long video) | Why | Length |
|---|---|---|---|
| 1 | R16 tie 1 leg 2: PSG 2–3 Dortmund (agg 3–4) | strong comeback (trailed by 2), decisive goal 73' | 54.3 s |
| 2 | R16 tie 3 leg 2: Liverpool 3–2 Club Brugge (agg 5–4) | comeback, decisive goal 90+2' | 53.1 s |
| 3 | R16 tie 6 leg 2: Real Betis 2–1 Stuttgart (agg 3–2) | comeback, decisive goal 90+1' | 53.5 s |

All 7 comebacks are R16/QF candidates; the semi-finals and final are never used.

- **Command:** `npm run reels -- --competition config/competitions/ucl_2026_top16.json` (optional `--map`, `--only N`, `--fast`).
  1. The tournament is rebuilt from the seed cache, so the reels use the same seeds and timeline hashes as the long video.
  2. The script then runs: selection → `sim/reels.js` timeline → vertical render (`render/draw.js` `renderReelFrame`) → same audio synth (`make_audio.py`) → two-pass loudnorm to −14 LUFS → suggestions.
  3. The silent video is cached per reel (key = reel timeline + `draw.js`).
- **Layout** (design 720×1280, ×1.5), top to bottom:
  - competition name;
  - bracket strip of the current round with the tie highlighted;
  - big scoreboard: clock, LEG n, AGG, and an added-time shot / golden-ball line;
  - 720×610 playfield with a follow camera that eases between the windmill zone and the goal zone;
  - lower third for the replay caption;
  - SIMULATION label.

  Everything except the playfield sits inside the central 80 % (x 72..648, y 128..1152), checked by pixel and text-box tests.
- **Cut:**
  - **Hook:** 2 s, the deficit score frozen on screen with the clock.
  - **Match:** quiet stretches fast-forwarded ×2 with a `>> x2` pill, each stretch ≤ 1.5 s of output. Goals, shots, added time and the final whistle always play at normal speed; the half-time whistle may be fast-forwarded. If a reel is still too long, only the quiet opening before the first goal may be dropped.
  - **Replay:** the decisive goal at 0.5× with the caption `S. Guirassy · 73'`.
  - **MOTM card** (2 s), then an **end card**: "Full simulation on the channel" / "Computer simulation · not real results".
- **Audio:** the same effects, re-timed. No fanfare, cheer or horn. Music is louder on the hook and end card.
- **Player names:** shown only in the replay caption and on the MOTM card. During play the goal banner shows only the team and the minute; this is tested.
- **Suggestions (`suggestions.txt`):**
  - The title ends with `| SIMULATION`.
  - The description says it is a computer simulation, not real results.
  - Tags are club names only.
  - Publish order: after the long video, at most 2 reels a day.
  - A lint checks for player names, official names (UEFA, FIFA, Champions League, …) and the SIMULATION wording.

## Part B — variants
- **Map themes** (`config/maps/`; the physics layout is identical in all of them):

  | Theme | Look | Music (transpose / bpm / progression / arp) |
  |---|---|---|
  | `sky_clean` | the approved v2 look (pixel-identical windmill and keeper) | v2 track |
  | `stadium_day` | light stands and 2 floodlight towers, blue windmill, yellow keeper | +2 / 116 / stride / up |
  | `stadium_night` | navy sky with sparse stars, soft floodlight glow, white windmill, teal keeper | −3 / 104 / open / wave |
  | `sunset` | purple→orange sky, low sun, two hill silhouettes, navy windmill, blue keeper | +5 / 108 / warm / arp down |

  - `--map <id>` overrides the competition's theme without changing any simulation result (tested: same hashes).
- **Competitions** (own names only):

  | Preset | Name | Teams | Snapshot source | Map |
  |---|---|---|---|---|
  | `uel_top16` | MARBLE CONTINENTAL | top 16 of the Europa League league phase | Wikipedia template, updated 22 Oct 2026; squads from UEFA club pages, 2026-11-04 | stadium_day |
  | `nations_world_16` | MARBLE WORLD NATIONS | FIFA ranking ranks 1–16 | ranking of 7 Oct 2026 via ESPN (FIFA.com did not render); squads from the Wikipedia "Current squad" section, 2026-11-04 | sunset |
  | `nations_euro_16` | MARBLE EURO NATIONS | top 16 European teams in the same ranking | same as World | stadium_night |

  - Euro 16: Russia (35) is excluded because it is suspended from UEFA competitions; Ukraine (36) is in.
- **`seed_salt`:** new per-competition field (11 / 23 / 37). Without it, competitions with the same format replayed identical matches. UCL has no salt, so its seed cache and the P2 video are unchanged.
- **Crests and flags:**
  - 16 Europa League club crests and 22 national flags, downloaded on Max's instruction ("Caută tu pe web").
  - All are in `assets/logos/manifest.json` with source, licence and kind.
  - Flags are printed over the whole ball, with the team-colour ring kept.
  - Several crests are "Fair use" files on Wikipedia, so the risk is Max's; switch them off with `logos_on_balls: false`.
- **Unverified / placeholder data:**
  - Kit colours of Lyon and Sparta Prague (`colours_verified: false`).
  - Shirt numbers marked * (unnumbered in the source): Argentina, Brazil, Croatia, USA, and A. Isak for Sweden.
  - Some well-known players are missing because they are not in the current squads (for example Mbappé, Messi).
  - Real Sociedad and Sparta squads on UEFA list few forwards; we used what was listed.
- **`plan/` folder:**
  - `OPERATING_RULES.md`: the PLAN.md §3 rules and the CLAUDE.md content rules (verbatim), plus the plan rules.
  - `content_plan.json`: 12 videos from the week of 9 Nov 2026, with the P2 video as history. It rotates 4 competitions × 4 themes, never repeats a map or competition back to back, and includes one example `real_match_slot`.
  - `validate.js` (`npm run plan:validate`) writes `uniqueness.json`.
  - **Similarity score:** 0.30 map + 0.30 competition + 0.15 accent closeness + 0.10 music profile + 0.15 bracket overlap.
  - **Threshold:** 0.60, compared against the previous 5 videos. Same map + same competition alone reaches 0.60, so any extra likeness fails.
  - The current plan's maximum is 0.474. A broken plan is rejected (tested).

## Tests
`node tests/p3_tests.js` → 25/25 (`logs/p3_tests.log`). It is now part of `npm test`. It covers:
- reel selection and determinism;
- reel length, structure, fast-forward limits and audio;
- safe area (pixels and text boxes), contrast, names during play, replay caption;
- map/competition switching with pixel assertions;
- presets and player data;
- plan validate (good and broken);
- suggestions lint, ffprobe of the 3 reels, loudness.

## Self-review
- **Reel 1:** 54 stills at 1 per second (`output/screenshots_f03`) reviewed.
  - Fixed: the clock showed "[object Object]"; the SIMULATION label and captions sat outside the safe area; a reel was 57 s.
- **Themes:** 4×2 contact sheet reviewed; the night floodlight glow was made smaller.
- **Known limitation:** the playfield shows the whole scene height at 0.85× scale, so balls are about 23 px wide on a phone. While the camera moves between zones, some moments show the open middle of the field.

## Not verified
Motion smoothness of the follow camera and the ×2 stretches, the music variants by ear, and how the reels look in the YouTube Shorts UI.
