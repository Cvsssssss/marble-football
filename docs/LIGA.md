# PREMIER LEAGUE — sezonul 2026/27 (câte o etapă pe video)

Simulare pe calculator, nu rezultate reale. Numele „PREMIER LEAGUE” e text simplu (îl schimbi din `config/leagues/premier_league_2026_27.json` → `display_name`). Fără siglă de competiție, fără trofeul real, fără sponsori.

## Cum pornești
START.bat → **7. PREMIER LEAGUE**. Vezi „Următoarea: Etapa N din 38” și rezumatul clasamentului (primele 5 și ultimele 3).

| Opțiune | Ce face |
|---|---|
| 1. Generează următoarea etapă | Simulează cele 10 meciuri ale etapei N, salvează rezultatele și clasamentul. Etapa precedentă devine **blocată**. Videoul etapei (video lung + 1 reel + texte de publicare) se adaugă în sesiunea P7 §5; până atunci meniul te întreabă dacă salvezi doar rezultatele. |
| 2. Regenerează DOAR ultima etapă | Refaci ultima etapă generată (de ex. cu altă hartă). Aceleași seed-uri → **aceleași scoruri**. Etapele dinainte nu se pot reface, pentru că clasamentul continuă din ele. |
| 3. Arată clasamentul complet | Tabelul cu 20 de echipe, formă (ultimele 5) și zone. |
| 4. Alege harta | Implicit: altă hartă decât săptămâna trecută (harta nouă „premier” vine în P7 §7). |

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
- `assets/logos/MISSING.md` — cluburile fără siglă: pe bilă apare codul de 3 litere pe culoarea clubului. Pui sigla ca `assets/logos/<id>.png` dacă vrei.

## Din linia de comandă (opțional)
- `npm run league -- status` / `npm run league -- table`
- `npm run league -- play` (etapa următoare) · `npm run league -- play --regenerate` (doar ultima)
- `npm run league:dryrun` — repetiție cu toate cele 38 de etape (rezultate de test, într-un folder separat `build/league_dryrun`; nu atinge sezonul tău)
- `npm run league:calibrate -- --reuse` — refaci cifrele de calibrare

## Thumbnail-uri
Generatorul **nu** mai face thumbnail-uri (le faci tu). Dacă le vrei înapoi la competițiile cu eliminare: `generate_thumbnails: true` în `config/rules/base.json`.
