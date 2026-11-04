# Depanare

| Problemă | Ce faci |
|---|---|
| „Node.js nu este instalat” | Instalează Node.js 20+ de pe nodejs.org, repornește START.bat. |
| Eroare `ffmpeg` / `ffprobe` | Rulează `npm install` în folderul proiectului (ffmpeg vine prin pachetele `ffmpeg-static`/`ffprobe-static`). |
| Eroare Chromium / `browserType.launch` | `npx playwright install chromium` |
| Eroare Python / `numpy` | Instalează Python 3, apoi `pip install numpy`. Verifică: `python -c "import numpy"`. |
| Spațiu insuficient pe disc | O rulare 1080p are ~1–2 GB (cu cache). Șterge rulări vechi din `output/runs/` și `build/segcache/` (cache-ul se reface la nevoie). |
| Randare prea lentă | Folosește întâi preview (opțiunea 2). Închide alte programe. Poți opri și relua: ce s-a randat rămâne în cache. |
| S-a oprit la jumătate | Pornește din nou aceeași opțiune: continuă de unde a rămas. |
| PREFLIGHT roșu | Deschide `PREFLIGHT.md` din folderul rulării: fiecare rând roșu are motivul în română. |
| Configurare greșită | Opțiunea 6 din meniu arată fișierul și câmpul greșit. |
| Am schimbat un singur meci | `npm run generate -- --competition <fișier> --map <temă> --rerender-match <id>` (ex. `QF2`). |

## Ce îi trimiți lui Claude ca să repare
1. Ultimele ~40 de rânduri din `logs/generate_last.log`.
2. `PREFLIGHT.md` din folderul rulării (dacă există).
3. Ce opțiune ai ales și ce ai schimbat în `config/` sau `plan/`.

**Nu trimite** fișierul `.env` (conține tokenul).
