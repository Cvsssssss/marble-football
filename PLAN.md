# PLAN.md — Marble Football Generator (varianta locală)

Actualizat: 4 noiembrie 2026. Fără server, fără bot, fără baze de date, fără încărcare automată, fără script care rulează singur fazele. Tu pornești generatorul, el îți dă fișierele, **tu scrii titlul și descrierea și publici**. Încredere: **[N]** sursă terță, **[?]** neverificat.

## 1. Ce face
Apeși START → alegi (sau lași recomandarea) → primești un folder cu:
- **video lung 16:9** (~25–30 min, turneu cu 16 echipe, 29 de meciuri),
- **3 reel-uri verticale 9:16** din meciuri cu revenire (doar din optimi/sferturi),
- **3 miniaturi** (fără text, fără nume de jucători), **capitole** (`chapters.txt`),
- `PREFLIGHT.md` (verificări automate, verde/roșu) și `PUBLISH_CHECKLIST.md` (ce să verifici și cum să publici).

## 2. Deciziile tale (finale)
- 3 mingi pe echipă. Mingile = jucători: **3 atacanți reali per echipă**, scriși `L. Yamal`, afișați **doar în video** (reluarea golului, Man of the Match, câștigătoare, podium). Nu în timpul jocului. Nu în fișiere, miniaturi sau texte sugerate.
- Doar culorile echipamentului (două culori), fără modele/embleme. Țările pot avea steaguri.
- Nume proprii de competiții: **MARBLE CHAMPIONS** (UCL), **MARBLE CONTINENTAL** (Europa League), **MARBLE WORLD NATIONS**, **MARBLE EURO NATIONS** (alternativă: „MARBLE LEAGUE", ți-o schimb din configurare).
- 16 echipe: primele 16 din cele 36 din faza ligii UCL 2026–27 (clasament curent, salvat cu sursă și dată); pentru țări, primele 16 din clasamentul FIFA (alegerea mea implicită).
- Jocul ca în demo, plus corecturile: sunet de gol nou, culori pe mingi, bara reparată, bracket simetric cu finala la mijloc, golden ball cu ceasul înghețat la `90+N`, morișcă mai rapidă de la minutul 70, reluarea golului cu nume + minut, Man of the Match cu trofeu, ecran final cu câștigătoarea + podium cu top 3 marcatori.
- Strategia de postare: întâi video lung (3 meciuri tari cu revenire din optimi/sferturi), apoi reel-uri cu acele secvențe. Cu o zi înainte de un meci real tare, videoul lung include acel meci (pereche forțată în optimi/sferturi) și postezi și un reel cu el. Fără meci tare: un video pe săptămână, rotind competiția și harta.

## 3. Regulile de postare (ghid; devin `plan/OPERATING_RULES.md` în P3, partea B)
1. 1 video lung/săptămână + 3 reel-uri eșalonate [?]. Maxim 1 video lung/zi, 2 reel-uri/zi.
2. Meci real tare în ziua D → video lung publicat în **D−1 seara** (Copenhaga), reel-uri în D−1 și D.
3. Fără meci tare: aleatoriu o dată pe săptămână din `content_plan.json`; nu aceeași hartă sau competiție de două ori la rând.
4. Reel-uri doar din optimi/sferturi; niciodată semifinală sau finală (spoiler).
5. Titlu descriptiv, cu „SIMULATION"; descriere care spune că e simulare pe calculator, nu rezultate reale; fără nume de jucători în titlu/descriere/taguri; fără clickbait care promite rezultate reale.
6. Încarci întâi **privat**, verifici, apoi publici. Tu răspunzi de ce publici.

## 4. Ce trebuie să știi despre YouTube (surse terțe, nu oficiale)
- Politica „inauthentic content" (din iulie 2025) vizează conținut produs în masă și repetitiv; un canal complet automat cu aceleași șabloane e profilul vizat **[N]**. Contramăsuri din plan: variație reală (hartă, competiție, culori, muzică), ritm moderat, titluri onest descriptive, revizuire umană. Monetizarea nu e garantată.
- Praguri YPP: acum 1.000 abonați + 4.000 ore sau 10 mil. vizionări Shorts; **din 1 februarie 2027**, pentru canale noi, 8.000 ore sau 20 mil. vizionări Shorts (cererile depuse până pe 31 ianuarie 2027 după regulile vechi) **[N]**. Planifică pe pragul nou.
- Nu am verificat dacă numele jucătorilor reali scrise în videoclip pot da probleme de drepturi; nu sunt avocat. Poți opri numele reale din configurare (`real_names=false`).
- Surse: [AIR Media-Tech](https://air.io/en/monetization/youtube-monetization-policy-changes-2026-a-complete-dated-timeline), [PPC Land](https://ppc.land/new-youtube-creators-face-8-000-hour-bar-for-ad-revenue-from-february-2027/), [TheStatsAPI despre football-data.org](https://www.thestatsapi.com/blog/football-data-org-free-tier-limits-2026). Nicio pagină oficială nu a fost deschisă direct.

## 5. Fazele (4, lucrezi tu cu Claude Code, una pe sesiune)
| Faza | Ce | Estimare [?] |
|---|---|---|
| P0 | pregătire calculator (10–15 min), doar tu | — |
| P1 | demo v2: corecturile + configurare din fișiere | 1 sesiune |
| P2 | turneu 16 echipe, jucători reali, video lung | 1–3 zile |
| P3 | reel-uri verticale (selecție meciuri cu revenire) + variații (hărți-tribună, 4 competiții) + folderul `plan/` | 2–5 zile |
| P4 | meniu START, „ce generez acum" cu meciuri reale, verificări, listă de publicare, repetiție completă, documentație în română | 2–4 zile |

Estimările sunt ale mele și nemăsurate. Server, bot Telegram, YouTube prin API, Studio web și comentarii se pot adăuga mai târziu peste același generator (pachetul „mare" există separat).

## 6. Limitele
- Să-ți vadă videoul în mișcare și să-l asculte: în demo, Claude Code a spus singur că a judecat din ~25 de cadre și n-a auzit sunetul. Verifici tu. Oprește-te după P1 și după P2 și uită-te la rezultat.
- Nu știu câtă limită de utilizare cer cele 4 faze **[?]**; o fază pe sesiune ajută.
- Calitatea datelor despre jucători (transferuri): lista o corectezi tu în `config/players_review.md`.

## 7. Riscuri
| Risc | Gravitate | Răspuns |
|---|---|---|
| YouTube: „inauthentic content" | Mare | variație, ritm moderat, titluri tu, revizuire umană; fără garanție |
| Prag YPP crescut din feb. 2027 | Mare | planifici pe pragul nou |
| Nume reale de jucători | Mediu | doar în video; opțiune de oprire |
| Nișă saturată | Necunoscut | verifici manual 20 de canale similare |
| Limita Claude Code | Operațional | sesiune nouă pe fază, prompturi mici |
