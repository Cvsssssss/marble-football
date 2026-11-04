# Jucători reali — de verificat de Max

Numele apar **doar în video** (gol, reluare, Man of the Match, ecranul final, podium). Nu apar niciodată în numele fișierelor, în thumbnail-uri sau în titlul, descrierea ori tag-urile sugerate.
Fiecare echipă are 3 atacanți (atacanți sau extreme) din lotul **actual**. Sursa este lotul oficial din Liga Campionilor 2026/27 publicat pe UEFA.com, consultat pe **2026-11-04**.
Ca să schimbi un nume: editează `config/teams/<id>.json` → `players[i].name` (format `I. Nume`). Ca să folosești nume fictive: pune `"real_names": false` în `config/competitions/demo_4teams.json` (atunci se folosesc `fictional_players`).
Mingea i a echipei aparține jucătorului i (bilele 1–2 → jucătorul 1, bilele 3–4 → jucătorul 2, bilele 5–6 → jucătorul 3).

| Echipă | # | Nume în video | Post (UEFA) | Sursă | Verificat |
|---|---|---|---|---|---|
| Manchester City | 9 | E. Haaland | atacant | [UEFA – Man City squad](https://www.uefa.com/uefachampionsleague/clubs/52919--man-city/squad/) | da |
| Manchester City | 11 | J. Doku | extremă (listat ca mijlocaș) | idem | da |
| Manchester City | 42 | A. Semenyo | atacant | idem | da |
| Real Madrid | 10 | K. Mbappé | atacant | [UEFA – Real Madrid squad](https://www.uefa.com/uefachampionsleague/clubs/50051--real-madrid/squad/) | da |
| Real Madrid | 7 | V. Júnior | atacant | idem | da |
| Real Madrid | 11 | Rodrygo | atacant | idem | da |
| Bayern Munich | 9 | H. Kane | atacant | [UEFA – Bayern squad](https://www.uefa.com/uefachampionsleague/clubs/50037--bayern-munchen/squad/) | da |
| Bayern Munich | 17 | M. Olise | extremă (listat ca mijlocaș) | idem | da |
| Bayern Munich | 14 | L. Díaz | atacant | idem | da |
| Arsenal | 7 | B. Saka | atacant | [UEFA – Arsenal squad](https://www.uefa.com/uefachampionsleague/clubs/52280--arsenal/squad/) | da |
| Arsenal | 14 | V. Gyökeres | atacant | idem | da |
| Arsenal | 10 | E. Eze | extremă / mijlocaș ofensiv (listat ca mijlocaș) | idem | da |

Note:
- **Rodrygo** este cunoscut după un singur nume, așa că nu are inițială. **Vinícius Júnior** este scris `V. Júnior` ca să respecte formatul; poți scrie `Vini Jr.` dacă preferi.
- Alte variante din aceleași liste UEFA: City – I. Ndiaye, P. Foden, R. Cherki; Real – Endrick, B. Díaz; Bayern – S. Gnabry, J. Musiala; Arsenal – N. Madueke, K. Havertz.
- „Verificat” = numele, numărul și apartenența la club confirmate pe pagina de lot UEFA la data consultării. Transferurile ulterioare nu sunt urmărite automat.
