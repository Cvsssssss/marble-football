# Configurare

Totul e în fișiere JSON. După orice modificare rulează opțiunea **6** din meniu (sau `npm run plan:validate`): îți spune exact ce câmp e greșit.

## Echipe — `config/teams/<id>.json`
- `name` (text simplu), `short` (3 litere pe tabelă), `short_name`
- `primary`, `secondary` — cele două culori (ex. `"#A50044"`), folosite pentru inelul bilei și interfață
- `strength` — 0–100; influențează doar puțin șansele (vezi `strength_edge`). **Mărimea bilelor nu se schimbă niciodată.**
- `players` — 3 atacanți: `name` în formatul `L. Yamal`, `number`, `position`, `source_url`, `retrieved`, `verified`
- echipe naționale: `"national": true` (pe bilă apare steagul)
- echipă nouă: copiază un fișier existent, schimbă `id` (= numele fișierului), apoi pune id-ul în `teams` al competiției. Sigla (opțional): `assets/logos/<id>.png` + o intrare în `assets/logos/manifest.json` cu sursa.

## Competiții — `config/competitions/*.json`
- `name` — numele nostru (MARBLE CHAMPIONS, MARBLE CONTINENTAL, MARBLE WORLD NATIONS, MARBLE EURO NATIONS, sau altul propriu, ex. MARBLE LEAGUE). Niciodată nume oficiale.
- `teams` — exact 16 id-uri, în ordinea clasamentului
- `map` — tema implicită (`stadium_day`, `stadium_night`, `sunset`, `sky_clean`)
- `forced_pairs` — perechi forțate permanente, ex. `[{"a":"barcelona","b":"aston_villa","round":"R16"}]` (mai simplu: din meniu, opțiunea 1)
- `real_names` — `true` = nume reale (doar în reluare, Omul meciului, ecranul câștigătorului, podium); `false` = nume fictive
- `GAME_MIN_PER_SEC` — minute de joc pe secundă de video (mai mare = meciuri mai scurte)
- `seed_salt` — schimbă-l ca să obții alte meciuri cu aceleași echipe

## Reguli de joc — `config/rules/base.json`
- `BALLS_PER_TEAM` (acum 3; 5 = mai aglomerat), `GAME_MIN_PER_SEC`, `ADDED_MIN` (prelungiri), `GOALS_MIN`/`GOALS_MAX`
- `ball_radius` — o singură valoare pentru toate bilele
- `logos_on_balls` — `false` = bile doar cu culori, fără sigle/steaguri
- `strength_edge` — cât contează `strength` (0 = deloc)

## Hărți / teme — `config/maps/*.json`
Culori pentru cer, rocă, iarbă, moară, portar, decor (`scenery`) și muzică (`music`: `transpose`, `bpm`, `progression`, `arp`). O temă nouă = copie a unui fișier cu alt `id`.

## Muzică și sunet — `config/audio.json`
`music_seed` (alt număr = altă melodie generată), `goal_sfx` (sunetul de gol).

## Planul — `plan/`
- `content_plan.json` — următoarele videouri (competiție, hartă, accent); `next` îl folosește când nu e meci tare
- `strong_match_rules.json` — lista de cluburi mari, poziția maximă, ora de publicare (19:00), câte zile înainte se uită
- `fixtures_manual.json` — meciurile reale viitoare, scrise de tine (dacă nu ai `FOOTBALL_DATA_TOKEN` în `.env`)
- `history.json` — ce s-a generat; poți marca o rulare `"status": "published"` sau `"discarded"`
