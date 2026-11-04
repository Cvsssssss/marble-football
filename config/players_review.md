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

## MARBLE CHAMPIONS (ucl_2026_top16) — top 16 din faza ligii, consultat 2026-11-04

Sursă jucători: lotul oficial Liga Campionilor 2026/27 de pe UEFA.com (lista „Forwards”), consultat pe **2026-11-04**. Am ales cei mai cunoscuți 3 atacanți/extreme. Nume fictive: pune `"real_names": false` în `config/competitions/ucl_2026_top16.json`.

| Poz. | Echipă | # | Nume în video | Sursă | Verificat |
|---|---|---|---|---|---|
| 1 | Paris Saint-Germain | 10 | O. Dembélé | [UEFA – Paris Saint-Germain squad](https://www.uefa.com/uefachampionsleague/clubs/52747--paris/squad/) | da |
| 1 | Paris Saint-Germain | 7 | K. Kvaratskhelia | idem | da |
| 1 | Paris Saint-Germain | 14 | D. Doué | idem | da |
| 2 | Barcelona | 10 | L. Yamal | [UEFA – Barcelona squad](https://www.uefa.com/uefachampionsleague/clubs/50080--barcelona/squad/) | da |
| 2 | Barcelona | 11 | Raphinha | idem | da |
| 2 | Barcelona | 17 | A. Gordon | idem | da |
| 3 | Aston Villa | 17 | A. Garnacho | [UEFA – Aston Villa squad](https://www.uefa.com/uefachampionsleague/clubs/52683--aston-villa/squad/) | da |
| 3 | Aston Villa | 11 | N. Jackson | idem | da |
| 3 | Aston Villa | 18 | T. Abraham | idem | da |
| 4 | Liverpool | 9 | A. Isak | [UEFA – Liverpool squad](https://www.uefa.com/uefachampionsleague/clubs/7889--liverpool/squad/) | da |
| 4 | Liverpool | 22 | H. Ekitiké | idem | da |
| 4 | Liverpool | 18 | C. Gakpo | idem | da |
| 5 | Real Madrid | 10 | K. Mbappé | [UEFA – Real Madrid squad](https://www.uefa.com/uefachampionsleague/clubs/50051--real-madrid/squad/) | da |
| 5 | Real Madrid | 7 | V. Júnior | idem | da |
| 5 | Real Madrid | 11 | Rodrygo | idem | da |
| 6 | Sporting CP | 97 | L. Suárez | [UEFA – Sporting CP squad](https://www.uefa.com/uefachampionsleague/clubs/50149--sporting-cp/squad/) | da |
| 6 | Sporting CP | 10 | G. Catamo | idem | da |
| 6 | Sporting CP | 7 | F. Ioannidis | idem | da |
| 7 | Real Betis | 7 | Antony | [UEFA – Real Betis squad](https://www.uefa.com/uefachampionsleague/clubs/52265--real-betis/squad/) | da |
| 7 | Real Betis | 9 | C. Hernández | idem | da |
| 7 | Real Betis | 10 | Abde | idem | da |
| 8 | Bayern Munich | 9 | H. Kane | [UEFA – Bayern Munich squad](https://www.uefa.com/uefachampionsleague/clubs/50037--bayern-munchen/squad/) | da |
| 8 | Bayern Munich | 17 | M. Olise | idem | da |
| 8 | Bayern Munich | 14 | L. Díaz | idem | da |
| 9 | Arsenal | 7 | B. Saka | [UEFA – Arsenal squad](https://www.uefa.com/uefachampionsleague/clubs/52280--arsenal/squad/) | da |
| 9 | Arsenal | 14 | V. Gyökeres | idem | da |
| 9 | Arsenal | 10 | E. Eze | idem | da |
| 10 | Stuttgart | 26 | D. Undav | [UEFA – Stuttgart squad](https://www.uefa.com/uefachampionsleague/clubs/50107--stuttgart/squad/) | da |
| 10 | Stuttgart | 18 | J. Leweling | idem | da |
| 10 | Stuttgart | 8 | T. Tomás | idem | da |
| 11 | Como | 90 | M. Kean | [UEFA – Como squad](https://www.uefa.com/uefachampionsleague/clubs/79946--como/squad/) | da |
| 11 | Como | 11 | A. Diao | idem | da |
| 11 | Como | 9 | T. Douvikas | idem | da |
| 12 | Manchester City | 9 | E. Haaland | [UEFA – Manchester City squad](https://www.uefa.com/uefachampionsleague/clubs/52919--man-city/squad/) | da |
| 12 | Manchester City | 11 | J. Doku | idem | da |
| 12 | Manchester City | 42 | A. Semenyo | idem | da |
| 13 | Club Brugge | 9 | C. Forbs | [UEFA – Club Brugge squad](https://www.uefa.com/uefachampionsleague/clubs/50043--club-brugge/squad/) | da |
| 13 | Club Brugge | 7 | N. Tresoldi | idem | da |
| 13 | Club Brugge | 17 | R. Vermant | idem | da |
| 14 | Inter | 10 | L. Martínez | [UEFA – Inter squad](https://www.uefa.com/uefachampionsleague/clubs/50138--inter/squad/) | da |
| 14 | Inter | 9 | M. Thuram | idem | da |
| 14 | Inter | 94 | P. Esposito | idem | da |
| 15 | LASK | 11 | S. Kalajdzic | [UEFA – LASK squad](https://www.uefa.com/uefachampionsleague/clubs/63405--lask/squad/) | da |
| 15 | LASK | 8 | M. Usor | idem | da |
| 15 | LASK | 7 | S. Adeniran | idem | da |
| 16 | Dortmund | 9 | S. Guirassy | [UEFA – Dortmund squad](https://www.uefa.com/uefachampionsleague/clubs/52758--b-dortmund/squad/) | da |
| 16 | Dortmund | 14 | M. Beier | idem | da |
| 16 | Dortmund | 21 | F. Silva | idem | da |

Note:
- **Raphinha**, **Antony** și **Abde** (Ezzalzouli) sunt cunoscuți după un singur nume. **C. Hernández** = Cucho Hernández. **S. Kalajdzic** e scris ca pe UEFA (fără diacritice).
- Culori nesigure (marcate `colours_verified: false` în fișierul echipei): Como (albastru #1E4FA0 ales plauzibil).
- Alternative din aceleași liste UEFA: PSG – M. Godts; Barcelona – D. Olmo, K. Adeyemi; Liverpool – B. Barcola, R. Ngumoha; Aston Villa – E. Buendía, I. Mbaye; Inter – L. Henrique; Dortmund – K. Karetsas; Stuttgart – J. Malanga; Brugge – J. Virgili.
- Echipele Manchester City, Real Madrid, Bayern și Arsenal folosesc jucătorii din tabelul de mai sus (P1b).
