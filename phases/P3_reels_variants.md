# P3 — Vertical reels + variants + `plan/` folder

Depends on: P2. Requires from Max: nothing. Do part A, check it with Max briefly, then part B (or continue straight on if Max says so).
At the start: read `CLAUDE.md` (project rules and protocol). Max is present in this session.

## PART A — Vertical reels (YouTube Shorts) from the long video

## Goal
From the P2 tournament, produce **vertical 9:16 reels (1080×1920, 30 fps, H.264+AAC)**: one reel per selected match, plus an optional suggestions file for each (Max writes his own title and description). Max approved vertical reels with a small bracket on top and a big score.

## Spec
1. **Selection** (`sim/selectReels.js`, driven by `matches_index.json` from P2): pick **3 matches that are comebacks** from the **round of 16 or quarterfinals only** (never semifinal/final). Prefer `comeback_depth >= 2`, then the latest decisive goal, then goal count. Output `output/reels/selection.json` (match id, why chosen, start/end time inside the long video). If fewer than 3 qualify, take the best available and say so in the report.
2. **Vertical render mode** (not a crop): recompose the scene for 1080×1920 in design space 720×1280. Layout top to bottom: slim header (competition name, `SIMULATION` label), small bracket strip showing where this tie sits (highlight current tie), big scoreboard with clock and `LEG n` / aggregate, the playfield **zoomed on the action** (keep windmill, spout side and goal readable; follow-camera that eases between the windmill zone and the goal zone), lower third for replay caption and Man of the Match. Same physics, same timeline (the reel replays the **same seed** as the long video, so the match is identical).
3. **Reel cut**: 30–55 s. Structure: 2 s hook (score line, e.g. `0–2` with the clock), the comeback sequence (compress quiet stretches with a fast-forward ×2 indicator limited to 1.5 s, never cut goals), the decisive goal in slow-motion with caption `L. Yamal · 81'` (names allowed in video only), Man of the Match card (2 s), end card text: `Full simulation on the channel` (no link rendering needed; the link goes into the description).
4. **Audio**: reuse the same music (shortened with fade) and effects; loudness about −14 LUFS; no horn.
5. **Suggestions file per reel** (`output/reels/<id>/suggestions.txt`, optional help only: Max writes his own title and description): a suggested title and description that follow the rules (title ends with `| SIMULATION`, no player names, no official competition names; description states it is a computer simulation, not real results) and a tag list (club names as text, no player names). Also the suggested publish order and time (after the long video).
6. **Validation**: ffprobe checks (1080×1920, ≤ 60 s, audio present); safe-area test: scoreboard and captions stay inside the central 80 % (phone UI overlaps edges) via pixel checks on sample frames; contrast check on text; one screenshot per second sampled for the first reel and opened with the image tool.

## Definition of done
- `npm run reels -- --competition config/competitions/ucl_2026_top16.json` creates 3 reels + `selection.json` + suggestions.
- Tests: selection rule (no semifinal/final), determinism (reel seed = long-video seed), safe-area, ffprobe, suggestions lint (no player names, includes SIMULATION, no banned words list from CLAUDE.md).
- Screenshots of the vertical layout in `output/screenshots_f03/` reviewed by you with the image tool; deviations fixed (max 4 iterations).
- Honest note in the report about what you could not verify (motion smoothness, audio by ear).


---

## PART B — Variants (maps, competitions) and the `plan/` folder

## Goal
Make the generator produce **visibly different videos from files alone**: same game idea and nearly the same layout, different background theme, colours, competition and teams. Everything the planner will need later lives in `plan/`.

## Spec
1. **Map themes** (`config/maps/*.json`): keep the physics layout identical. Implement at least 4 themes by changing only visuals: `sky_clean` (current), `stadium_day` (clean football stand silhouettes + light floodlight towers, **sparse**: leave the screen airy), `stadium_night` (darker sky, soft floodlight glow, still clean), `sunset`. Platforms, grass and rock colours as theme parameters. Music seed per theme (same original synthesizer, different key/tempo/pattern; still calm like v2). Windmill/keeper colours configurable. Do NOT crowd the screen.
2. **Competition presets** (`config/competitions/*.json`), each with name, format, team list source, bracket, rules, flags:
   - `ucl_2026_top16` → **MARBLE CHAMPIONS** (from P2)
   - `uel_top16` → **MARBLE CONTINENTAL**: top 16 of the Europa League 2026–27 league phase (web search, snapshot with source URL + date; if unreliable, a clearly labelled placeholder list)
   - `nations_world_16` → **MARBLE WORLD NATIONS**: top 16 by current FIFA ranking (web search, snapshot with source/date; **national flags allowed**; kit colours only; 3 attackers each as real names `L. Yamal` format)
   - `nations_euro_16` → **MARBLE EURO NATIONS**: top 16 European national teams by the same ranking
   Names are config values. Never use official competition names, logos, trophies, anthems.
3. **Player data** for all new teams: 3 best-known attackers each, with `source_url`, `retrieved`, `verified`; review table in `config/players_review.md` (append sections). `real_names` flag per competition.
4. **`plan/` folder** (machine- and human-readable; the `next` recommender in P4 will read it):
   - `plan/OPERATING_RULES.md` — the posting rules from PLAN.md §3, verbatim, plus the content rules from CLAUDE.md.
   - `plan/content_plan.json` — the next **12 videos**: competition, map theme, colour accent, target week, role (`weekly_random` | `real_match_slot`), constraints (no same map or competition twice in a row; rotate across the 4 competitions and 4 themes; ≥ 1 week between the same competition). Include a validator (`npm run plan:validate`) that fails if rules are broken.
   - `plan/uniqueness.json` — per generated video a fingerprint (map, competition, colours, music seed, bracket) and a **similarity score** against the previous 5 videos; the validator rejects a plan whose similarity is above a threshold you choose and document.
5. **Variant test**: generate one **short preview** (one match, 720p) for each of the 4 themes and 2 competitions using only config; build a contact sheet `output/screenshots_f04/variants.png`; open it with the image tool; check every theme is clean, readable, and visibly different.

## Definition of done
- Switching `--competition` and `--map` changes the output with no code edits (test with pixel assertions for 2 themes).
- `npm run plan:validate` passes on the provided plan and fails on a deliberately broken plan (test both).
- Variant contact sheet reviewed; deviations fixed (max 4 iterations).
- Report lists snapshots with sources/dates, placeholders, and unverified player entries.
