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
| 3 | Doar reel-urile (refăcute) din ultimul turneu generat. |
| 4 | Rulează recomandarea (`npm run next`) și îți spune ce să generezi acum și de ce; apoi te întreabă dacă generează. |
| 5 | Deschide folderul cu ultimul rezultat. |
| 6 | Verifică configurarea (schema) și planul (`plan:validate`). |
| 0 | Ieșire. |

Generarea arată progresul și timpul rămas. O poți opri oricând (închizi fereastra / Ctrl+C); la repornire, blocurile deja randate sunt refolosite din cache.

## Unde apar rezultatele
`output/runs/<data>_<competiție>_<hartă>/` (cu `_preview` la final pentru preview). `output/latest` arată mereu ultima rulare.
- videoul lung (`long_video_1080p.mp4` sau `long_video_preview_720p.mp4`) + `chapters.txt` (capitole de lipit în descriere)
- `reels/` — 3 reel-uri verticale (≤ 60 s), fiecare cu `suggestions.txt`
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
Totul se publică **de mână**. Programul nu încarcă nimic nicăieri. Urmează `PUBLISH_CHECKLIST.md`. Titlul și descrierea le scrii tu.
