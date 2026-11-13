# Pornire

## Prima dată
1. Ai nevoie de **Node.js 20+** (nodejs.org) și **Python 3 cu numpy** (`pip install numpy`).
2. Dublu-click pe **START.bat**. La prima pornire instalează singur pachetele npm (ffmpeg vine inclus prin npm).
3. Dacă apare o eroare despre Chromium: deschide un terminal în folderul proiectului și rulează `npx playwright install chromium`.

## Meniul (START.bat sau `npm start`)
| Opțiune | Ce face |
|---|---|
| 1 | Alegi competiția, harta/tema, opțional o pereche forțată (ex. `Barcelona vs Aston Villa`, în optimi sau sferturi) și calitatea (1080p final sau preview 720p). Apoi generează tot. |
| 2 | Preview rapid 720p (pentru verificare, nu pentru publicare). |
| 3 | Doar reel-ul (unul singur, refăcut) din ultimul turneu generat: tot terenul în cadru, cameră fixă. |
| 4 | Rulează recomandarea (`npm run next`) și îți spune ce să generezi acum și de ce; apoi te întreabă dacă generează. |
| 5 | Deschide folderul cu ultimul rezultat. |
| 6 | Verifică configurarea (schema) și planul (`plan:validate`). |
| 0 | Ieșire. |

Generarea arată progresul și timpul rămas. O poți opri oricând (închizi fereastra / Ctrl+C); la repornire, blocurile deja randate sunt refolosite din cache.

## Unde apar rezultatele
`output/runs/<data>_<competiție>_<hartă>/` (cu `_preview` la final pentru preview). `output/latest` arată mereu ultima rulare.
- videoul lung (`long_video_1080p.mp4` sau `long_video_preview_720p.mp4`) + `chapters.txt` (capitole de lipit în descriere)
- `reels/reel_<meci>/reel.mp4` — **un singur** reel vertical (≤ 60 s) per video: cea mai spectaculoasă revenire din optimi/sferturi (dacă nu există, meciul cu golul decisiv cel mai târziu). Terenul întreg se vede tot timpul (moara și poarta), camera nu se mișcă.
- `publish/` — textele gata de copiat: `long_title.txt` (3 variante de titlu), `long_description.txt` (descrierea completă, cu capitolele), `reel_title.txt` (3 variante), `reel_description.txt`, `README_publish.txt` (unde lipești și ce setări alegi)
- `thumbnails/` — 3 imagini 1280×720 fără text; alegi una și adaugi tu textul dacă vrei
- `PREFLIGHT.md` — verificarea automată (verde/roșu, cu motive)
- `PUBLISH_CHECKLIST.md` — ce încarci, în ce ordine, când, și ce să nu uiți
- `run.json` — seed-uri și hash-uri (ca să poți reface exact același video)
- `LOGO_USAGE.md` — de unde provin siglele de pe bile

## Din linia de comandă (opțional)
- `npm run generate -- --competition config/competitions/uel_top16.json --map stadium_day --preview`
- `npm run generate -- --competition config/competitions/ucl_2026_top16.json --map sunset --forced-pair "Barcelona vs Inter" --forced-round R16` *(netestată exact în această formă; perechea forțată e testată automat în `next`)*
- `npm run generate -- ... --no-reels` (fără reel-uri; netestat), `--rerender-match QF2` (refă doar un meci după o modificare; testat prin testul de reluare)
- `npm run next` — recomandarea; `npm run next -- --simulate 8weeks` — simulare pe 8 săptămâni
- `npm run preflight -- output/runs/<folder>` — verificarea din nou
- `npm test` — toate testele

## Publicare
Totul se publică **de mână**. Programul nu încarcă nimic nicăieri. Urmează `PUBLISH_CHECKLIST.md`. Titlul și descrierea **nu le mai scrii tu**: le copiezi din `publish/` (vezi `publish/README_publish.txt`). Textele nu au nume de jucători, nu dezvăluie campionul în titlu și spun mereu că e o simulare pe calculator. Titlurile ultimelor 10 videouri sunt ținute în `plan/history.json` (`recent_titles`) ca să nu se repete.

## Jucători
Lista de jucători (3 atacanți pe echipă, cu sursă și dată) e în `config/players_review.md`. Dacă vezi o greșeală, corectează în `config/teams/<id>.json` și rulează `node tools/players_review.js`. `node sim/players.js` verifică datele (rulează și singur la pornire): la naționale jucătorul trebuie să aibă naționalitatea echipei, datele trebuie să fie mai noi de 120 de zile.
