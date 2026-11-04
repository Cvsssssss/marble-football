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

## MARBLE CONTINENTAL (P3) — top 16 din faza ligii Europa League 2026–27

| Poz. | Echipa | Nr. | Jucător | Sursă | Verificat |
|---|---|---|---|---|---|
| 1 | Benfica | 14 | V. Pavlidis | [UEFA – Benfica squad](https://www.uefa.com/uefaeuropaleague/clubs/50147--benfica/squad/) | da |
| 1 | Benfica | 11 | D. Lukébakio | idem | da |
| 1 | Benfica | 22 | J. Durán | idem | da |
| 2 | Bayer Leverkusen | 14 | P. Schick | [UEFA – Bayer Leverkusen squad](https://www.uefa.com/uefaeuropaleague/clubs/50109--leverkusen/squad/) | da |
| 2 | Bayer Leverkusen | 19 | M. Diaby | idem | da |
| 2 | Bayer Leverkusen | 35 | C. Kofane | idem | da |
| 3 | Bournemouth | 9 | Evanilson | [UEFA – Bournemouth squad](https://www.uefa.com/uefaeuropaleague/clubs/2601124--bournemouth/squad/) | da |
| 3 | Bournemouth | 19 | J. Kluivert | idem | da |
| 3 | Bournemouth | 21 | A. Adli | idem | da |
| 4 | Ferencváros | 19 | F. Kovačević | [UEFA – Ferencváros squad](https://www.uefa.com/uefaeuropaleague/clubs/52298--ferencvaros/squad/) | da |
| 4 | Ferencváros | 11 | B. Yusuf | idem | da |
| 4 | Ferencváros | 75 | L. Joseph | idem | da |
| 5 | Olympiacos | 11 | R. Yaremchuk | [UEFA – Olympiacos squad](https://www.uefa.com/uefaeuropaleague/clubs/2610--olympiacos/squad/) | da |
| 5 | Olympiacos | 17 | L. Bailey | idem | da |
| 5 | Olympiacos | 10 | G. Martins | idem | da |
| 6 | Union Saint-Gilloise | 13 | K. Rodriguez | [UEFA – Union Saint-Gilloise squad](https://www.uefa.com/uefaeuropaleague/clubs/64125--union-sg/squad/) | da |
| 6 | Union Saint-Gilloise | 9 | M. Biondic | idem | da |
| 6 | Union Saint-Gilloise | 30 | R. Florucz | idem | da |
| 7 | Juventus | 10 | K. Yıldız | [UEFA – Juventus squad](https://www.uefa.com/uefaeuropaleague/clubs/50139--juventus/squad/) | da |
| 7 | Juventus | 9 | R. Kolo Muani | idem | da |
| 7 | Juventus | 7 | F. Conceição | idem | da |
| 8 | Beşiktaş | 28 | D. Vlahović | [UEFA – Beşiktaş squad](https://www.uefa.com/uefaeuropaleague/clubs/50157--besiktas/squad/) | da |
| 8 | Beşiktaş | 17 | E. Poku | idem | da |
| 8 | Beşiktaş | 90 | S. Kılıçsoy | idem | da |
| 9 | Sunderland | 18 | W. Isidor | [UEFA – Sunderland squad](https://www.uefa.com/uefaeuropaleague/clubs/53360--sunderland/squad/) | da |
| 9 | Sunderland | 9 | B. Brobbey | idem | da |
| 9 | Sunderland | 10 | N. Angulo | idem | da |
| 10 | AZ Alkmaar | 9 | M. Meerdink | [UEFA – AZ Alkmaar squad](https://www.uefa.com/uefaeuropaleague/clubs/52327--az-alkmaar/squad/) | da |
| 10 | AZ Alkmaar | 14 | C. Stengs | idem | da |
| 10 | AZ Alkmaar | 7 | W. Patati | idem | da |
| 11 | Omonia | 17 | F. Tănase | [UEFA – Omonia squad](https://www.uefa.com/uefaeuropaleague/clubs/50077--omonia/squad/) | da |
| 11 | Omonia | 9 | A. Kakoullis | idem | da |
| 11 | Omonia | 22 | M. Tankovic | idem | da |
| 12 | Lyon | 17 | L. Openda | [UEFA – Lyon squad](https://www.uefa.com/uefaeuropaleague/clubs/5312--lyon/squad/) | da |
| 12 | Lyon | 7 | E. Nuamah | idem | da |
| 12 | Lyon | 11 | K. Nakamura | idem | da |
| 13 | Rennes | 9 | E. Lepaul | [UEFA – Rennes squad](https://www.uefa.com/uefaeuropaleague/clubs/55031--rennes/squad/) | da |
| 13 | Rennes | 22 | B. Dia | idem | da |
| 13 | Rennes | 11 | M. Al-Taamari | idem | da |
| 14 | Real Sociedad | 14 | T. Kubo | [UEFA – Real Sociedad squad](https://www.uefa.com/uefaeuropaleague/clubs/50123--real-sociedad/squad/) | da |
| 14 | Real Sociedad | 9 | O. Óskarsson | idem | da |
| 14 | Real Sociedad | 11 | G. Guedes | idem | da |
| 15 | Crystal Palace | 14 | J. Mateta | [UEFA – Crystal Palace squad](https://www.uefa.com/uefaeuropaleague/clubs/52916--crystal-palace/squad/) | da |
| 15 | Crystal Palace | 7 | I. Sarr | idem | da |
| 15 | Crystal Palace | 10 | Y. Pino | idem | da |
| 16 | Sparta Prague | 14 | J. Braut Brunes | [UEFA – Sparta Prague squad](https://www.uefa.com/uefaeuropaleague/clubs/50033--sparta-praha/squad/) | da |
| 16 | Sparta Prague | 29 | M. Vojta | idem | da |
| 16 | Sparta Prague | 27 | E. Singhateh | idem | da |

## MARBLE WORLD NATIONS (P3) — top 16 clasament FIFA (7 oct. 2026)

| Poz. | Echipa | Nr. | Jucător | Sursă | Verificat |
|---|---|---|---|---|---|
| 1 | Spain | 19 | L. Yamal | [Wikipedia – Spain](https://en.wikipedia.org/wiki/Spain_national_football_team) | da |
| 1 | Spain | 21 | M. Oyarzabal | idem | da |
| 1 | Spain | 11 | Y. Pino | idem | da |
| 2 | Argentina | 9* | J. Álvarez | [Wikipedia – Argentina](https://en.wikipedia.org/wiki/Argentina_national_football_team) | da |
| 2 | Argentina | 16* | T. Almada | idem | da |
| 2 | Argentina | 20* | G. Simeone | idem | da |
| 3 | France | 7 | O. Dembélé | [Wikipedia – France](https://en.wikipedia.org/wiki/France_national_football_team) | da |
| 3 | France | 11 | M. Olise | idem | da |
| 3 | France | 20 | D. Doué | idem | da |
| 4 | England | 9 | H. Kane | [Wikipedia – England](https://en.wikipedia.org/wiki/England_national_football_team) | da |
| 4 | England | 7 | B. Saka | idem | da |
| 4 | England | 11 | A. Gordon | idem | da |
| 5 | Portugal | 7 | R. Leão | [Wikipedia – Portugal](https://en.wikipedia.org/wiki/Portugal_national_football_team) | da |
| 5 | Portugal | 9 | G. Ramos | idem | da |
| 5 | Portugal | 11 | J. Félix | idem | da |
| 6 | Brazil | 7* | Vinícius Jr. | [Wikipedia – Brazil](https://en.wikipedia.org/wiki/Brazil_national_football_team) | da |
| 6 | Brazil | 11* | Raphinha | idem | da |
| 6 | Brazil | 20* | Estêvão | idem | da |
| 7 | Morocco | 10 | B. Díaz | [Wikipedia – Morocco](https://en.wikipedia.org/wiki/Morocco_national_football_team) | da |
| 7 | Morocco | 9 | S. Rahimi | idem | da |
| 7 | Morocco | 17 | A. Ezzalzouli | idem | da |
| 8 | Belgium | 9 | R. Lukaku | [Wikipedia – Belgium](https://en.wikipedia.org/wiki/Belgium_national_football_team) | da |
| 8 | Belgium | 10 | L. Trossard | idem | da |
| 8 | Belgium | 17 | C. De Ketelaere | idem | da |
| 9 | Netherlands | 9 | J. Zirkzee | [Wikipedia – Netherlands](https://en.wikipedia.org/wiki/Netherlands_national_football_team) | da |
| 9 | Netherlands | 7 | C. Summerville | idem | da |
| 9 | Netherlands | 10 | N. Lang | idem | da |
| 10 | Mexico | 11 | S. Giménez | [Wikipedia – Mexico](https://en.wikipedia.org/wiki/Mexico_national_football_team) | da |
| 10 | Mexico | 9 | G. Berterame | idem | da |
| 10 | Mexico | 25 | R. Alvarado | idem | da |
| 11 | Colombia | 9 | L. Suárez | [Wikipedia – Colombia](https://en.wikipedia.org/wiki/Colombia_national_football_team) | da |
| 11 | Colombia | 20 | K. Viveros | idem | da |
| 11 | Colombia | 7 | Ó. Perea | idem | da |
| 12 | Switzerland | 11 | D. Ndoye | [Wikipedia – Switzerland](https://en.wikipedia.org/wiki/Switzerland_national_football_team) | da |
| 12 | Switzerland | 10 | Z. Amdouni | idem | da |
| 12 | Switzerland | 7 | J. Monteiro | idem | da |
| 13 | Germany | 11 | N. Woltemade | [Wikipedia – Germany](https://en.wikipedia.org/wiki/Germany_national_football_team) | da |
| 13 | Germany | 10 | J. Burkardt | idem | da |
| 13 | Germany | 9 | D. Scherhant | idem | da |
| 14 | Croatia | 9* | A. Kramarić | [Wikipedia – Croatia](https://en.wikipedia.org/wiki/Croatia_national_football_team) | da |
| 14 | Croatia | 4* | I. Perišić | idem | da |
| 14 | Croatia | 17* | A. Budimir | idem | da |
| 15 | Italy | 9 | P. Esposito | [Wikipedia – Italy](https://en.wikipedia.org/wiki/Italy_national_football_team) | da |
| 15 | Italy | 11 | G. Scamacca | idem | da |
| 15 | Italy | 17 | D. Maldini | idem | da |
| 16 | United States | 10* | C. Pulisic | [Wikipedia – United States](https://en.wikipedia.org/wiki/United_States_men's_national_soccer_team) | da |
| 16 | United States | 20* | F. Balogun | idem | da |
| 16 | United States | 21* | T. Weah | idem | da |

## MARBLE EURO NATIONS (P3) — top 16 echipe europene din clasamentul FIFA

| Poz. | Echipa | Nr. | Jucător | Sursă | Verificat |
|---|---|---|---|---|---|
| 1 | Spain | 19 | L. Yamal | [Wikipedia – Spain](https://en.wikipedia.org/wiki/Spain_national_football_team) (vezi mai sus) | da |
| 1 | Spain | 21 | M. Oyarzabal | idem | da |
| 1 | Spain | 11 | Y. Pino | idem | da |
| 2 | France | 7 | O. Dembélé | [Wikipedia – France](https://en.wikipedia.org/wiki/France_national_football_team) (vezi mai sus) | da |
| 2 | France | 11 | M. Olise | idem | da |
| 2 | France | 20 | D. Doué | idem | da |
| 3 | England | 9 | H. Kane | [Wikipedia – England](https://en.wikipedia.org/wiki/England_national_football_team) (vezi mai sus) | da |
| 3 | England | 7 | B. Saka | idem | da |
| 3 | England | 11 | A. Gordon | idem | da |
| 4 | Portugal | 7 | R. Leão | [Wikipedia – Portugal](https://en.wikipedia.org/wiki/Portugal_national_football_team) (vezi mai sus) | da |
| 4 | Portugal | 9 | G. Ramos | idem | da |
| 4 | Portugal | 11 | J. Félix | idem | da |
| 5 | Belgium | 9 | R. Lukaku | [Wikipedia – Belgium](https://en.wikipedia.org/wiki/Belgium_national_football_team) (vezi mai sus) | da |
| 5 | Belgium | 10 | L. Trossard | idem | da |
| 5 | Belgium | 17 | C. De Ketelaere | idem | da |
| 6 | Netherlands | 9 | J. Zirkzee | [Wikipedia – Netherlands](https://en.wikipedia.org/wiki/Netherlands_national_football_team) (vezi mai sus) | da |
| 6 | Netherlands | 7 | C. Summerville | idem | da |
| 6 | Netherlands | 10 | N. Lang | idem | da |
| 7 | Switzerland | 11 | D. Ndoye | [Wikipedia – Switzerland](https://en.wikipedia.org/wiki/Switzerland_national_football_team) (vezi mai sus) | da |
| 7 | Switzerland | 10 | Z. Amdouni | idem | da |
| 7 | Switzerland | 7 | J. Monteiro | idem | da |
| 8 | Germany | 11 | N. Woltemade | [Wikipedia – Germany](https://en.wikipedia.org/wiki/Germany_national_football_team) (vezi mai sus) | da |
| 8 | Germany | 10 | J. Burkardt | idem | da |
| 8 | Germany | 9 | D. Scherhant | idem | da |
| 9 | Croatia | 9* | A. Kramarić | [Wikipedia – Croatia](https://en.wikipedia.org/wiki/Croatia_national_football_team) (vezi mai sus) | da |
| 9 | Croatia | 4* | I. Perišić | idem | da |
| 9 | Croatia | 17* | A. Budimir | idem | da |
| 10 | Italy | 9 | P. Esposito | [Wikipedia – Italy](https://en.wikipedia.org/wiki/Italy_national_football_team) (vezi mai sus) | da |
| 10 | Italy | 11 | G. Scamacca | idem | da |
| 10 | Italy | 17 | D. Maldini | idem | da |
| 11 | Norway | 9 | E. Haaland | [Wikipedia – Norway](https://en.wikipedia.org/wiki/Norway_national_football_team) | da |
| 11 | Norway | 11 | J. Strand Larsen | idem | da |
| 11 | Norway | 20 | A. Nusa | idem | da |
| 12 | Denmark | 9 | R. Højlund | [Wikipedia – Denmark](https://en.wikipedia.org/wiki/Denmark_national_football_team) | da |
| 12 | Denmark | 8 | G. Isaksen | idem | da |
| 12 | Denmark | 11 | A. Skov Olsen | idem | da |
| 13 | Austria | 9 | S. Kalajdžić | [Wikipedia – Austria](https://en.wikipedia.org/wiki/Austria_national_football_team) | da |
| 13 | Austria | 11 | M. Gregoritsch | idem | da |
| 13 | Austria | 19 | M. Grüll | idem | da |
| 14 | Türkiye | 7 | K. Aktürkoğlu | [Wikipedia – Türkiye](https://en.wikipedia.org/wiki/Turkey_national_football_team) | da |
| 14 | Türkiye | 10 | İ. Kahveci | idem | da |
| 14 | Türkiye | 19 | Y. Akgün | idem | da |
| 15 | Sweden | 17 | V. Gyökeres | [Wikipedia – Sweden](https://en.wikipedia.org/wiki/Sweden_men's_national_football_team) | da |
| 15 | Sweden | 9 | P. Abraham | idem | da |
| 15 | Sweden | 18* | A. Isak | idem | da |
| 16 | Ukraine | 9 | R. Yaremchuk | [Wikipedia – Ukraine](https://en.wikipedia.org/wiki/Ukraine_national_football_team) | da |
| 16 | Ukraine | 7 | A. Yarmolenko | idem | da |
| 16 | Ukraine | 11 | V. Vanat | idem | da |

Note P3:
- Numerele marcate cu * nu apar în sursă (convocare recentă / fără număr); le-am pus noi.
- Echipele naționale: sursa este secțiunea „Current squad” (sau „Recent call-ups”) din articolul Wikipedia al echipei, 4 nov. 2026. Unii jucători foarte cunoscuți lipsesc pentru că nu sunt în lotul curent (ex. Mbappé, Messi).
- Euro: Rusia (locul 35 FIFA) nu e inclusă, fiind suspendată din competițiile UEFA; Ucraina (36) ia locul 16.
- Culori nesigure: Lyon (#FFFFFF / #14387F), Sparta Praga (#A50034).
- **Vinícius Jr.**, **Raphinha**, **Estêvão**, **Evanilson** sunt cunoscuți după un singur nume. **J. Mateta** = Jean-Philippe Mateta.
