# PREMIER LEAGUE — sezonul 2026/27 (câte o etapă pe video)

Simulare pe calculator, nu rezultate reale. Numele „PREMIER LEAGUE” e text simplu (îl schimbi din `config/leagues/premier_league_2026_27.json` → `display_name`). Fără siglă de competiție, fără trofeul real, fără sponsori.

## Cum pornești
START.bat → **7. PREMIER LEAGUE**. Vezi „Următoarea: Etapa N din 38” și rezumatul clasamentului (primele 5 și ultimele 3).

| Opțiune | Ce face |
|---|---|
| 1. Generează următoarea etapă | Simulează cele 10 meciuri ale etapei N, salvează rezultatele și clasamentul, apoi face **videoul lung (~20–22 min, 1080p) + 1 reel + textele de publicare** într-un folder nou din `output/runs/`. Etapa precedentă devine **blocată**. |
| 2. Regenerează DOAR ultima etapă | Refaci ultima etapă generată (de ex. cu altă hartă). Aceleași seed-uri → **aceleași scoruri**. Etapele dinainte nu se pot reface, pentru că clasamentul continuă din ele. |
| 3. Arată clasamentul complet | Tabelul cu 20 de echipe, formă (ultimele 5) și zone. |
| 4. Alege harta | Implicit: următoarea din cele 4 hărți „premier” (alta decât săptămâna trecută). |

Nu alegi meciuri sau echipe: programul celor 38 de etape e fix, făcut o singură dată.

## Regulile
- 20 de cluburi, fiecare pereche se joacă de **2 ori** (o dată pe fiecare teren) = 38 de etape × 10 meciuri. (Exemplul cu 4 întâlniri ar fi dat 76 de etape, deci am păstrat formatul real.)
- Meci simplu, 90 de minute + șuturile din prelungiri; **egalul e permis**, fără golden ball.
- Puncte 3/1/0. La egalitate: golaveraj, goluri marcate, puncte în meciurile directe, apoi o tragere la sorți fixă (nu apare nicăieri ca „random”).
- Zone: 1–5 **UCL**, 6–7 **Europa League**, 8 **Conference League**, 18–20 **Relegated**.
- Forța echipelor e **invizibilă** (toate bilele sunt identice): vine din punctele din 2025/26; promovatele (Coventry, Ipswich, Hull) au forța celei mai slabe echipe rămase (Tottenham). Avantajul terenului propriu e mic și calibrat.

## Unde sunt fișierele
- `config/leagues/premier_league_2026_27.json` — cluburile, zonele, departajarea, parametrii de forță, sursele.
- `config/teams/<id>.json` — culorile și cei 3 atacanți ai fiecărui club (tabel de verificat: `config/players_review.md`).
- `league/premier_league_2026_27/fixtures.json` — programul celor 38 de etape.
- `league/premier_league_2026_27/state.json` — etapa următoare, hărțile folosite, clasamentul curent.
- `league/premier_league_2026_27/results/week_NN.json` — scoruri, marcatori, seed-uri, hash-uri, clasamentul după etapă.
- `league/premier_league_2026_27/calibration.json` — cifrele de calibrare (vezi raportul P7).
- `assets/logos/<id>.png` — siglele celor 20 de cluburi (doar pe bile); sursele în `assets/logos/manifest.json` și `LOGO_USAGE.md`. Dacă lipsește un fișier, apare `assets/logos/MISSING.md` și pe bilă se vede codul de 3 litere. Oprești toate siglele cu `logos_on_balls: false`.

## Videoul etapei
Ordinea: intro cu cele 10 meciuri → pentru fiecare meci: card înainte (locul în clasament, forma) → meciul → final → reluarea golului → omul meciului → **clasamentul animat** (4–6 s) → la final: clasamentul complet, toate rezultatele, golgheterii, **Golul etapei** (card + reluare), anunțul etapei următoare.
- **Ceasul e mai lent** (decizia ta din 13 nov 2026): 1 minut de joc = 1 secundă, deci 90 s de joc pe meci → video de ~20–22 min. Forța echipelor a fost recalibrată pentru asta (cifrele în raportul P7).
- **Golul etapei**: punctaj fix — portar sărit +3, portar ghemuit +2, gol decisiv +2, gol de egalare +1,5, șut în prelungiri +1, plus minutul/45. Câștigă cel mai mare.
- **Etapa 38**: în loc de anunț vin campioana, **ceremonia trofeului (30 s, 3 unghiuri de cameră, artificii, muzică proprie)**, locurile europene + retrogradatele, Gheata de aur, podiumul și statisticile sezonului.
- **Reel-ul** (unul pe etapă, ≤ 55 s, tot terenul în cadru, derulare x4): cea mai spectaculoasă revenire; altfel meciul cu cel mai târziu gol decisiv; altfel meciul cu cele mai multe goluri.
- **Textele** sunt în `publish/` din folderul rulării: titlu „Premier League Matchweek N | Marble Football Simulation 2026/27” (+2 variante), descriere cu rezultatele simulate, top 5, capitole, disclaimer, hashtag-uri (#PremierLeague #EPL #MarbleFootball…). Fără nume de jucători.
- Thumbnail-ul îl faci tu.

## Hărțile „premier” și fundalul tău
Se rotesc pe săptămâni: `premier_pitchside` (ziua, cu imaginea ta `assets/backgrounds/premier_day.png`), `premier_overcast` (după-amiază înnorată), `premier_evening` (seară cu reflectoare), `premier_night` (noapte cu burniță). Toate au platforme din blocuri de piatră, poartă adâncă cu plasă care se mișcă și moara roșu-alb. Terenul de joc (porți, moară, portar) e **identic** cu celelalte hărți.
- Imaginea ta e scalată fără deformare, aliniată jos și tăiată egal stânga/dreapta; e mărită puțin (~20%) ca linia terenului din joc să cadă pe gazonul din imagine.
- Dacă vrei imagine și pe celelalte 3: pune `assets/backgrounds/premier_overcast.png`, `premier_evening.png`, `premier_night.png` (aceeași formă panoramică). Fără ele se desenează un stadion procedural.
- Dacă imaginea lipsește sau e stricată, harta folosește automat stadionul procedural (nu se oprește nimic).

## Din linia de comandă (opțional)
- `node build_matchweek.js --week N --dry-run` — doar textele/checklist-ul, fără audio și video (verificare rapidă)
- `npm run league -- status` / `npm run league -- table`
- `npm run league -- play` (etapa următoare) · `npm run league -- play --regenerate` (doar ultima)
- `npm run league:dryrun` — repetiție cu toate cele 38 de etape (rezultate de test, într-un folder separat `build/league_dryrun`; nu atinge sezonul tău)
- `npm run league:calibrate -- --reuse` — refaci cifrele de calibrare

## Thumbnail-uri
Generatorul **nu** mai face thumbnail-uri (le faci tu). Dacă le vrei înapoi la competițiile cu eliminare: `generate_thumbnails: true` în `config/rules/base.json`.
