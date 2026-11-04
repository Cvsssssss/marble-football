# OPERATING_RULES — reguli de operare (citite de planificator și de `npm run next`)

## A. Regulile de postare (din PLAN.md §3, textual)

1. 1 video lung/săptămână + 3 reel-uri eșalonate [?]. Maxim 1 video lung/zi, 2 reel-uri/zi.
2. Meci real tare în ziua D → video lung publicat în **D−1 seara** (Copenhaga), reel-uri în D−1 și D.
3. Fără meci tare: aleatoriu o dată pe săptămână din `content_plan.json`; nu aceeași hartă sau competiție de două ori la rând.
4. Reel-uri doar din optimi/sferturi; niciodată semifinală sau finală (spoiler).
5. Titlu descriptiv, cu „SIMULATION"; descriere care spune că e simulare pe calculator, nu rezultate reale; fără nume de jucători în titlu/descriere/taguri; fără clickbait care promite rezultate reale.
6. Încarci întâi **privat**, verifici, apoi publici. Tu răspunzi de ce publici.


## B. Regulile de conținut (din CLAUDE.md, textual)

- Team names as **plain text**. **Team crests/logos are allowed ONLY as decals printed on the balls** (config flag `logos_on_balls`, Max's explicit decision on 4 Nov 2026). They come from files Max provides in `assets/logos/`; download crests from the web **only if Max explicitly tells you to in the current session**, and then record every source URL in `assets/logos/manifest.json` and in a per-run `LOGO_USAGE.md`. No competition logos, kit designs, sponsors, official trophy designs, anthems or third-party music. Kits = **two colours** (primary, secondary), used for the ball ring and the UI. National teams may show **flags**. Crests are trademarks and may be copyrighted: that is Max's risk (not legal advice); always keep the flag so he can switch it off.
- **All balls have exactly the same size and the same visible look rules** (radius from `config/rules/base.json`, one value for every ball of every team). Team strength may never be expressed through visible size.
- Competition names are our own: **MARBLE CHAMPIONS** (UEFA Champions League teams), **MARBLE CONTINENTAL** (Europa League teams), **MARBLE WORLD NATIONS**, **MARBLE EURO NATIONS**. Never official names or logos on screen. All are config values.
- Real player names (format `L. Yamal`, 3 attackers per team) appear **only inside the video**: goal-replay caption, Man of the Match, winner screen, podium. **Never during play; never in file names, thumbnails, suggested titles/descriptions/tags.** No faces, photos or real shirt designs. Flag `real_names` can switch to fictional names.
- The on-screen `SIMULATION` label is no longer required (Max, P5): config flag `show_simulation_label`, default **false**. Every suggested title/description, the `PUBLISH_CHECKLIST.md` and the reel suggestion notes must still say it is a computer simulation, not real results, and remind Max to answer YouTube's current altered/synthetic-content disclosure question when uploading.
- Every video must be visibly different from the previous ones (map/theme, colours, competition, music seed). `plan/` rules and the uniqueness check enforce this.
- Max reviews every video before publishing.


## C. Reguli tehnice ale planului (verificate de `npm run plan:validate`)
- `content_plan.json` conține următoarele 12 videouri; fiecare are competiție, temă de hartă, culoare de accent, săptămână țintă și rol (`weekly_random` | `real_match_slot`).
- Nu aceeași hartă și nu aceeași competiție de două ori la rând.
- Rotație: în orice fereastră de 4 videouri consecutive apar cel puțin 3 competiții diferite și cel puțin 3 teme diferite; în tot planul, fiecare din cele 4 competiții și 4 teme apare cel puțin de 2 ori.
- Aceeași competiție: cel puțin 1 săptămână între două apariții (săptămânile țintă diferă cu ≥ 1).
- Maxim 1 video lung pe săptămână țintă, cu excepția unui `real_match_slot` (maxim 2 pe săptămână, niciodată în aceeași zi).
- `uniqueness.json`: amprenta fiecărui video (hartă, competiție, culori, sămânța muzicii, tablou) și scorul de similaritate față de ultimele 5 videouri; planul e respins dacă un video are similaritate > 0.60 față de oricare din ultimele 5 (vezi `plan/validate.js` pentru formula).
