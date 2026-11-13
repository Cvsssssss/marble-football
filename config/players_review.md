# Jucători reali — tabel de verificat de Max

Numele apar **doar în video** (gol, reluare, Man of the Match, ecranul final, podium). Niciodată în numele fișierelor, thumbnail-uri, titluri, descrieri sau tag-uri.
Fiecare echipă are 3 atacanți/extreme din lotul **actual** (cluburi: lotul UEFA 2026/27; naționale: ultima convocare găsită, de obicei noiembrie 2026). Audit P6: **2026-11-13**.
Corectare: editează `config/teams/<id>.json` → `players[i]` (`name` format `I. Nume`, `team`, `nationality`, `source_url`, `retrieved`, `verified`). Apoi rulează `node tools/players_review.js` ca să refaci acest tabel.
Validatorul (`node sim/players.js`, rulat și la pornire) cere: 3 jucători pe echipă, `team` = echipa, la naționale `nationality` = țara, niciun jucător în două echipe ale aceleiași competiții, `retrieved` de cel mult 120 de zile.
Coloana „De verificat”: **DA** = sursa nu a confirmat complet (vezi nota).

## MARBLE CUP (demo_4teams)

| Echipă | Nume în video | Post | Naționalitate | Sursă | Consultat | Verificat | De verificat |
|---|---|---|---|---|---|---|---|
| Manchester City | E. Haaland (#9) | FW | Norway | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/52919--man-city/squad/) | 2026-11-04 | da |  |
| Manchester City | J. Doku (#11) | W (listed MF) | Belgium | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/52919--man-city/squad/) | 2026-11-04 | da |  |
| Manchester City | A. Semenyo (#42) | FW | Ghana | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/52919--man-city/squad/) | 2026-11-04 | da |  |
| Real Madrid | K. Mbappé (#10) | FW | France | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/50051--real-madrid/squad/) | 2026-11-04 | da |  |
| Real Madrid | Vinícius Jr. (#7) | FW | Brazil | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/50051--real-madrid/squad/) | 2026-11-04 | da |  |
| Real Madrid | Y. Diomande (#25) | FW | Ivory Coast | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/50051--real-madrid/squad/) | 2026-11-04 | da |  |
| Bayern Munich | H. Kane (#9) | FW | England | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/50037--bayern-munchen/squad/) | 2026-11-04 | da |  |
| Bayern Munich | M. Olise (#17) | W (listed MF) | France | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/50037--bayern-munchen/squad/) | 2026-11-04 | da |  |
| Bayern Munich | L. Díaz (#14) | FW | Colombia | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/50037--bayern-munchen/squad/) | 2026-11-04 | da |  |
| Arsenal | B. Saka (#7) | FW | England | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/52280--arsenal/squad/) | 2026-11-04 | da |  |
| Arsenal | V. Gyökeres (#14) | FW | Sweden | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/52280--arsenal/squad/) | 2026-11-04 | da |  |
| Arsenal | E. Eze (#10) | W/AM (listed MF) | England | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/52280--arsenal/squad/) | 2026-11-04 | da |  |

## MARBLE EURO NATIONS (nations_euro_16)

| Echipă | Nume în video | Post | Naționalitate | Sursă | Consultat | Verificat | De verificat |
|---|---|---|---|---|---|---|---|
| Spain | L. Yamal | FW | Spain | [comuniate.com](https://www.comuniate.com/en/noticias/38889/luis-de-la-fuente-names-squad-for-group-stage-finale) | 2026-11-13 | da |  |
| Spain | M. Oyarzabal | FW | Spain | [comuniate.com](https://www.comuniate.com/en/noticias/38889/luis-de-la-fuente-names-squad-for-group-stage-finale) | 2026-11-13 | da |  |
| Spain | Y. Pino | FW | Spain | [comuniate.com](https://www.comuniate.com/en/noticias/38889/luis-de-la-fuente-names-squad-for-group-stage-finale) | 2026-11-13 | da |  |
| France | K. Mbappé | FW | France | [khelnow.com](https://khelnow.com/football/france-november-uefa-nations-league-squad-202611) | 2026-11-13 | da |  |
| France | M. Olise | FW | France | [khelnow.com](https://khelnow.com/football/france-november-uefa-nations-league-squad-202611) | 2026-11-13 | da |  |
| France | D. Doué | FW | France | [khelnow.com](https://khelnow.com/football/france-november-uefa-nations-league-squad-202611) | 2026-11-13 | da |  |
| England | H. Kane | FW | England | [sportsmole.co.uk](https://www.sportsmole.co.uk/football/england/uefa-nations-league/news/palmer-white-king-decisions-england-squad-for-november-confirmed_608569.html) | 2026-11-13 | da |  |
| England | A. Gordon | FW | England | [sportsmole.co.uk](https://www.sportsmole.co.uk/football/england/uefa-nations-league/news/palmer-white-king-decisions-england-squad-for-november-confirmed_608569.html) | 2026-11-13 | da |  |
| England | E. Eze | FW | England | [sportsmole.co.uk](https://www.sportsmole.co.uk/football/england/uefa-nations-league/news/palmer-white-king-decisions-england-squad-for-november-confirmed_608569.html) | 2026-11-13 | da |  |
| Portugal | R. Leão | FW | Portugal | [khelnow.com](https://khelnow.com/football/portugal-november-uefa-nations-league-squad-202611) | 2026-11-13 | da |  |
| Portugal | G. Ramos | FW | Portugal | [khelnow.com](https://khelnow.com/football/portugal-november-uefa-nations-league-squad-202611) | 2026-11-13 | da |  |
| Portugal | J. Félix | FW | Portugal | [khelnow.com](https://khelnow.com/football/portugal-november-uefa-nations-league-squad-202611) | 2026-11-13 | da |  |
| Belgium | R. Lukaku | FW | Belgium | [sporza.be](https://sporza.be/nl/2026/11/05/livestream-welke-rode-duivels-roept-mark-van-bommel-op-voor-komend-nations-league-tweeluik~1793900077484/) | 2026-11-13 | da |  |
| Belgium | L. Trossard | FW | Belgium | [sporza.be](https://sporza.be/nl/2026/11/05/livestream-welke-rode-duivels-roept-mark-van-bommel-op-voor-komend-nations-league-tweeluik~1793900077484/) | 2026-11-13 | da |  |
| Belgium | C. De Ketelaere | FW | Belgium | [sporza.be](https://sporza.be/nl/2026/11/05/livestream-welke-rode-duivels-roept-mark-van-bommel-op-voor-komend-nations-league-tweeluik~1793900077484/) | 2026-11-13 | da |  |
| Netherlands | C. Gakpo | FW | Netherlands | [news.bet365.nl](https://news.bet365.nl/nl-nl/article/xavi-maakt-selectie-oranje-bekend-voor-komende-interlandperiode/2026110611442297493) | 2026-11-13 | da |  |
| Netherlands | C. Summerville | FW | Netherlands | [news.bet365.nl](https://news.bet365.nl/nl-nl/article/xavi-maakt-selectie-oranje-bekend-voor-komende-interlandperiode/2026110611442297493) | 2026-11-13 | da |  |
| Netherlands | N. Lang | FW | Netherlands | [news.bet365.nl](https://news.bet365.nl/nl-nl/article/xavi-maakt-selectie-oranje-bekend-voor-komende-interlandperiode/2026110611442297493) | 2026-11-13 | da |  |
| Switzerland | B. Embolo | FW | Switzerland | [plattformj.ch](https://www.plattformj.ch/artikel/248250/) | 2026-11-13 | da |  |
| Switzerland | Z. Amdouni | FW | Switzerland | [plattformj.ch](https://www.plattformj.ch/artikel/248250/) | 2026-11-13 | da |  |
| Switzerland | R. Vargas | FW | Switzerland | [plattformj.ch](https://www.plattformj.ch/artikel/248250/) | 2026-11-13 | da |  |
| Germany | K. Havertz | FW | Germany | [90min.de](https://www.90min.de/klopp-nominiert-zum-zweiten-mal-diese-24-spieler-stehen-im-dfb-kader) | 2026-11-13 | da |  |
| Germany | N. Füllkrug | FW | Germany | [dfb.de](https://www.dfb.de/news/mit-fuellkrug-und-mohya-klopp-nominiert-kader-fuer-serbien-und-niederlande) | 2026-11-13 | da |  |
| Germany | Y. Ebnoutalib | FW | Germany | [90min.de](https://www.90min.de/klopp-nominiert-zum-zweiten-mal-diese-24-spieler-stehen-im-dfb-kader) | 2026-11-13 | da |  |
| Croatia | A. Kramarić | FW | Croatia | [hns.team](https://hns.team/en/news/31688/bilic-the-best-players-play-for-the-national-teamthat-is-the-only-criterion/) | 2026-11-13 | da |  |
| Croatia | F. Ivanović | FW | Croatia | [hns.team](https://hns.team/en/news/31688/bilic-the-best-players-play-for-the-national-teamthat-is-the-only-criterion/) | 2026-11-13 | da |  |
| Croatia | L. Majer | FW | Croatia | [hns.team](https://hns.team/en/news/31688/bilic-the-best-players-play-for-the-national-teamthat-is-the-only-criterion/) | 2026-11-13 | nu | DA — listed among forwards by HNS; usually an attacking midfielder |
| Italy | P. Esposito | FW | Italy | [sport.sky.it](https://sport.sky.it/calcio/nazionale/convocati-italia-mancini-nazionale-nations-league-novembre-2026) | 2026-11-13 | da |  |
| Italy | G. Scamacca | FW | Italy | [sport.sky.it](https://sport.sky.it/calcio/nazionale/convocati-italia-mancini-nazionale-nations-league-novembre-2026) | 2026-11-13 | da |  |
| Italy | N. Cambiaghi | FW | Italy | [sport.sky.it](https://sport.sky.it/calcio/nazionale/convocati-italia-mancini-nazionale-nations-league-novembre-2026) | 2026-11-13 | da |  |
| Norway | E. Haaland | FW | Norway | [flashscore.com](https://www.flashscore.com/news/soccer-uefa-nations-league-norway-boosted-by-the-return-of-atletico-madrid-striker-for-vital-clash-against-denmark/d64ecbat/) | 2026-11-13 | da |  |
| Norway | A. Sørloth | FW | Norway | [flashscore.com](https://www.flashscore.com/news/soccer-uefa-nations-league-norway-boosted-by-the-return-of-atletico-madrid-striker-for-vital-clash-against-denmark/d64ecbat/) | 2026-11-13 | da |  |
| Norway | A. Nusa | FW | Norway | [fourfourtwo.com](https://www.fourfourtwo.com/team/norway-world-cup-2026-squad) | 2026-11-13 | nu | DA — World Cup 2026 squad; Nov 2026 list not confirmed |
| Denmark | R. Højlund | FW | Denmark | [fourfourtwo.com](https://www.fourfourtwo.com/team/denmark-world-cup-2026-squad) | 2026-11-13 | nu | DA — Nov 2026 squad not found |
| Denmark | G. Isaksen | FW | Denmark | [fourfourtwo.com](https://www.fourfourtwo.com/team/denmark-world-cup-2026-squad) | 2026-11-13 | nu | DA — Nov 2026 squad not found |
| Denmark | J. Wind | FW | Denmark | [fourfourtwo.com](https://www.fourfourtwo.com/team/denmark-world-cup-2026-squad) | 2026-11-13 | nu | DA — Nov 2026 squad not found |
| Austria | M. Grüll | FW | Austria | [salzburg24.at](https://www.salzburg24.at/sport/fussball/showdown-um-nations-league-aufstieg-ralf-rangnick-nominiert-vier-salzburger-fuer-oefb-team-art-343276) | 2026-11-13 | da |  |
| Austria | C. Baumgartner | FW | Austria | [salzburg24.at](https://www.salzburg24.at/sport/fussball/showdown-um-nations-league-aufstieg-ralf-rangnick-nominiert-vier-salzburger-fuer-oefb-team-art-343276) | 2026-11-13 | da |  |
| Austria | R. Florucz | FW | Austria | [weekend.at](https://www.weekend.at/sport/yusuf-demir-oefb-comeback) | 2026-11-13 | nu | DA — late call-up, date not confirmed |
| Türkiye | Y. Akgün | FW | Türkiye | [gazeteoksijen.com](https://gazeteoksijen.com/spor/a-milli-takimin-aday-kadrosu-aciklandi-295235) | 2026-11-13 | da |  |
| Türkiye | B. Yılmaz | FW | Türkiye | [gazeteoksijen.com](https://gazeteoksijen.com/spor/a-milli-takimin-aday-kadrosu-aciklandi-295235) | 2026-11-13 | da |  |
| Türkiye | D. Gül | FW | Türkiye | [gazeteoksijen.com](https://gazeteoksijen.com/spor/a-milli-takimin-aday-kadrosu-aciklandi-295235) | 2026-11-13 | da |  |
| Sweden | V. Gyökeres | FW | Sweden | [news.bet365.com](https://news.bet365.com/sv-sv/article/sveriges-trupp-till-de-avgorande-nations-league-matcherna-i-november/2026110410474912091) | 2026-11-13 | da |  |
| Sweden | A. Isak | FW | Sweden | [news.bet365.com](https://news.bet365.com/sv-sv/article/sveriges-trupp-till-de-avgorande-nations-league-matcherna-i-november/2026110410474912091) | 2026-11-13 | da |  |
| Sweden | A. Elanga | FW | Sweden | [news.bet365.com](https://news.bet365.com/sv-sv/article/sveriges-trupp-till-de-avgorande-nations-league-matcherna-i-november/2026110410474912091) | 2026-11-13 | da |  |
| Ukraine | A. Dovbyk | FW | Ukraine | [dynamo.kiev.ua](https://dynamo.kiev.ua/en/news/703869-serhiy-rebrov-announced-the-ukrainian-national-teams-lineup-for-the-november-world-cup-2026-qualifiers-against-france-and-icela) | 2026-11-13 | nu | DA — latest list found is Nov 2025 |
| Ukraine | V. Vanat | FW | Ukraine | [dynamo.kiev.ua](https://dynamo.kiev.ua/en/news/703869-serhiy-rebrov-announced-the-ukrainian-national-teams-lineup-for-the-november-world-cup-2026-qualifiers-against-france-and-icela) | 2026-11-13 | nu | DA — latest list found is Nov 2025 |
| Ukraine | R. Yaremchuk | FW | Ukraine | [dynamo.kiev.ua](https://dynamo.kiev.ua/en/news/703869-serhiy-rebrov-announced-the-ukrainian-national-teams-lineup-for-the-november-world-cup-2026-qualifiers-against-france-and-icela) | 2026-11-13 | nu | DA — latest list found is Nov 2025 |

## MARBLE WORLD NATIONS (nations_world_16)

| Echipă | Nume în video | Post | Naționalitate | Sursă | Consultat | Verificat | De verificat |
|---|---|---|---|---|---|---|---|
| Spain | L. Yamal | FW | Spain | [comuniate.com](https://www.comuniate.com/en/noticias/38889/luis-de-la-fuente-names-squad-for-group-stage-finale) | 2026-11-13 | da |  |
| Spain | M. Oyarzabal | FW | Spain | [comuniate.com](https://www.comuniate.com/en/noticias/38889/luis-de-la-fuente-names-squad-for-group-stage-finale) | 2026-11-13 | da |  |
| Spain | Y. Pino | FW | Spain | [comuniate.com](https://www.comuniate.com/en/noticias/38889/luis-de-la-fuente-names-squad-for-group-stage-finale) | 2026-11-13 | da |  |
| Argentina | J. Álvarez | FW | Argentina | [442.perfil.com](https://442.perfil.com/noticias/seleccion-argentina/lionel-scaloni-confirmo-los-convocados-de-la-seleccion-argentina-para-la-fecha-fifa.phtml) | 2026-11-13 | da |  |
| Argentina | T. Almada | FW | Argentina | [442.perfil.com](https://442.perfil.com/noticias/seleccion-argentina/lionel-scaloni-confirmo-los-convocados-de-la-seleccion-argentina-para-la-fecha-fifa.phtml) | 2026-11-13 | da |  |
| Argentina | S. Castro | FW | Argentina | [442.perfil.com](https://442.perfil.com/noticias/seleccion-argentina/lionel-scaloni-confirmo-los-convocados-de-la-seleccion-argentina-para-la-fecha-fifa.phtml) | 2026-11-13 | da |  |
| France | K. Mbappé | FW | France | [khelnow.com](https://khelnow.com/football/france-november-uefa-nations-league-squad-202611) | 2026-11-13 | da |  |
| France | M. Olise | FW | France | [khelnow.com](https://khelnow.com/football/france-november-uefa-nations-league-squad-202611) | 2026-11-13 | da |  |
| France | D. Doué | FW | France | [khelnow.com](https://khelnow.com/football/france-november-uefa-nations-league-squad-202611) | 2026-11-13 | da |  |
| England | H. Kane | FW | England | [sportsmole.co.uk](https://www.sportsmole.co.uk/football/england/uefa-nations-league/news/palmer-white-king-decisions-england-squad-for-november-confirmed_608569.html) | 2026-11-13 | da |  |
| England | A. Gordon | FW | England | [sportsmole.co.uk](https://www.sportsmole.co.uk/football/england/uefa-nations-league/news/palmer-white-king-decisions-england-squad-for-november-confirmed_608569.html) | 2026-11-13 | da |  |
| England | E. Eze | FW | England | [sportsmole.co.uk](https://www.sportsmole.co.uk/football/england/uefa-nations-league/news/palmer-white-king-decisions-england-squad-for-november-confirmed_608569.html) | 2026-11-13 | da |  |
| Portugal | R. Leão | FW | Portugal | [khelnow.com](https://khelnow.com/football/portugal-november-uefa-nations-league-squad-202611) | 2026-11-13 | da |  |
| Portugal | G. Ramos | FW | Portugal | [khelnow.com](https://khelnow.com/football/portugal-november-uefa-nations-league-squad-202611) | 2026-11-13 | da |  |
| Portugal | J. Félix | FW | Portugal | [khelnow.com](https://khelnow.com/football/portugal-november-uefa-nations-league-squad-202611) | 2026-11-13 | da |  |
| Brazil | Vinícius Jr. | FW | Brazil | [trivela.com.br](https://trivela.com.br/brasil/selecao-brasileira-convocacao-ancelotti-expande-leque/) | 2026-11-13 | da |  |
| Brazil | Raphinha | FW | Brazil | [trivela.com.br](https://trivela.com.br/brasil/selecao-brasileira-convocacao-ancelotti-expande-leque/) | 2026-11-13 | da |  |
| Brazil | Estêvão | FW | Brazil | [trivela.com.br](https://trivela.com.br/brasil/selecao-brasileira-convocacao-ancelotti-expande-leque/) | 2026-11-13 | da |  |
| Morocco | B. Díaz | FW | Morocco | [ysscores.com](https://www.ysscores.com/en/news/14087541/wahbi-announces-morocco-squad-for-niger-clashes-amid-notable-absences) | 2026-11-13 | da |  |
| Morocco | Y. En-Nesyri | FW | Morocco | [ysscores.com](https://www.ysscores.com/en/news/14087541/wahbi-announces-morocco-squad-for-niger-clashes-amid-notable-absences) | 2026-11-13 | da |  |
| Morocco | A. El Kaabi | FW | Morocco | [ysscores.com](https://www.ysscores.com/en/news/14087541/wahbi-announces-morocco-squad-for-niger-clashes-amid-notable-absences) | 2026-11-13 | nu | DA — Sep 2026 squad; Nov 2026 full list not found |
| Belgium | R. Lukaku | FW | Belgium | [sporza.be](https://sporza.be/nl/2026/11/05/livestream-welke-rode-duivels-roept-mark-van-bommel-op-voor-komend-nations-league-tweeluik~1793900077484/) | 2026-11-13 | da |  |
| Belgium | L. Trossard | FW | Belgium | [sporza.be](https://sporza.be/nl/2026/11/05/livestream-welke-rode-duivels-roept-mark-van-bommel-op-voor-komend-nations-league-tweeluik~1793900077484/) | 2026-11-13 | da |  |
| Belgium | C. De Ketelaere | FW | Belgium | [sporza.be](https://sporza.be/nl/2026/11/05/livestream-welke-rode-duivels-roept-mark-van-bommel-op-voor-komend-nations-league-tweeluik~1793900077484/) | 2026-11-13 | da |  |
| Netherlands | C. Gakpo | FW | Netherlands | [news.bet365.nl](https://news.bet365.nl/nl-nl/article/xavi-maakt-selectie-oranje-bekend-voor-komende-interlandperiode/2026110611442297493) | 2026-11-13 | da |  |
| Netherlands | C. Summerville | FW | Netherlands | [news.bet365.nl](https://news.bet365.nl/nl-nl/article/xavi-maakt-selectie-oranje-bekend-voor-komende-interlandperiode/2026110611442297493) | 2026-11-13 | da |  |
| Netherlands | N. Lang | FW | Netherlands | [news.bet365.nl](https://news.bet365.nl/nl-nl/article/xavi-maakt-selectie-oranje-bekend-voor-komende-interlandperiode/2026110611442297493) | 2026-11-13 | da |  |
| Mexico | S. Giménez | FW | Mexico | [excelsior.com.mx](https://www.excelsior.com.mx/deportes/henry-martin-borrado-seleccion-mexicana-pese-buenos-numeros) | 2026-11-13 | da |  |
| Mexico | A. González | FW | Mexico | [excelsior.com.mx](https://www.excelsior.com.mx/deportes/henry-martin-borrado-seleccion-mexicana-pese-buenos-numeros) | 2026-11-13 | da |  |
| Mexico | J. Quiñones | FW | Mexico | [latribuna.hn](https://www.latribuna.hn/2026/11/06/quinones-vuelve-a-un-mexico-urgido-de-goles/) | 2026-11-13 | da |  |
| Colombia | J. Arias | FW | Colombia | [clarosports.com](https://www.clarosports.com/colombia/seleccion-colombiana/oficial-la-convocatoria-de-nestor-lorenzo-para-los-partidos-amistosos-ante-chile/) | 2026-11-13 | da |  |
| Colombia | Ó. Perea | FW | Colombia | [clarosports.com](https://www.clarosports.com/colombia/seleccion-colombiana/oficial-la-convocatoria-de-nestor-lorenzo-para-los-partidos-amistosos-ante-chile/) | 2026-11-13 | da |  |
| Colombia | D. Mosquera | FW | Colombia | [clarosports.com](https://www.clarosports.com/colombia/seleccion-colombiana/oficial-la-convocatoria-de-nestor-lorenzo-para-los-partidos-amistosos-ante-chile/) | 2026-11-13 | da |  |
| Switzerland | B. Embolo | FW | Switzerland | [plattformj.ch](https://www.plattformj.ch/artikel/248250/) | 2026-11-13 | da |  |
| Switzerland | Z. Amdouni | FW | Switzerland | [plattformj.ch](https://www.plattformj.ch/artikel/248250/) | 2026-11-13 | da |  |
| Switzerland | R. Vargas | FW | Switzerland | [plattformj.ch](https://www.plattformj.ch/artikel/248250/) | 2026-11-13 | da |  |
| Germany | K. Havertz | FW | Germany | [90min.de](https://www.90min.de/klopp-nominiert-zum-zweiten-mal-diese-24-spieler-stehen-im-dfb-kader) | 2026-11-13 | da |  |
| Germany | N. Füllkrug | FW | Germany | [dfb.de](https://www.dfb.de/news/mit-fuellkrug-und-mohya-klopp-nominiert-kader-fuer-serbien-und-niederlande) | 2026-11-13 | da |  |
| Germany | Y. Ebnoutalib | FW | Germany | [90min.de](https://www.90min.de/klopp-nominiert-zum-zweiten-mal-diese-24-spieler-stehen-im-dfb-kader) | 2026-11-13 | da |  |
| Croatia | A. Kramarić | FW | Croatia | [hns.team](https://hns.team/en/news/31688/bilic-the-best-players-play-for-the-national-teamthat-is-the-only-criterion/) | 2026-11-13 | da |  |
| Croatia | F. Ivanović | FW | Croatia | [hns.team](https://hns.team/en/news/31688/bilic-the-best-players-play-for-the-national-teamthat-is-the-only-criterion/) | 2026-11-13 | da |  |
| Croatia | L. Majer | FW | Croatia | [hns.team](https://hns.team/en/news/31688/bilic-the-best-players-play-for-the-national-teamthat-is-the-only-criterion/) | 2026-11-13 | nu | DA — listed among forwards by HNS; usually an attacking midfielder |
| Italy | P. Esposito | FW | Italy | [sport.sky.it](https://sport.sky.it/calcio/nazionale/convocati-italia-mancini-nazionale-nations-league-novembre-2026) | 2026-11-13 | da |  |
| Italy | G. Scamacca | FW | Italy | [sport.sky.it](https://sport.sky.it/calcio/nazionale/convocati-italia-mancini-nazionale-nations-league-novembre-2026) | 2026-11-13 | da |  |
| Italy | N. Cambiaghi | FW | Italy | [sport.sky.it](https://sport.sky.it/calcio/nazionale/convocati-italia-mancini-nazionale-nations-league-novembre-2026) | 2026-11-13 | da |  |
| United States | C. Pulisic | FW | United States | [si.com](https://www.si.com/soccer/usmnt-november-2026-roster-confirmed-full-list-players-stars-schedule) | 2026-11-13 | da |  |
| United States | F. Balogun | FW | United States | [si.com](https://www.si.com/soccer/usmnt-november-2026-roster-confirmed-full-list-players-stars-schedule) | 2026-11-13 | da |  |
| United States | C. Sullivan | FW | United States | [si.com](https://www.si.com/soccer/usmnt-november-2026-roster-confirmed-full-list-players-stars-schedule) | 2026-11-13 | da |  |

## MARBLE CHAMPIONS (ucl_2026_top16)

| Echipă | Nume în video | Post | Naționalitate | Sursă | Consultat | Verificat | De verificat |
|---|---|---|---|---|---|---|---|
| Paris Saint-Germain | O. Dembélé (#10) | FW | France | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/52747--paris/squad/) | 2026-11-04 | da |  |
| Paris Saint-Germain | K. Kvaratskhelia (#7) | FW | Georgia | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/52747--paris/squad/) | 2026-11-04 | da |  |
| Paris Saint-Germain | D. Doué (#14) | FW | France | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/52747--paris/squad/) | 2026-11-04 | da |  |
| Barcelona | L. Yamal (#10) | FW | Spain | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/50080--barcelona/squad/) | 2026-11-04 | da |  |
| Barcelona | Raphinha (#11) | FW | Brazil | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/50080--barcelona/squad/) | 2026-11-04 | da |  |
| Barcelona | A. Gordon (#17) | FW | England | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/50080--barcelona/squad/) | 2026-11-04 | da |  |
| Aston Villa | A. Garnacho (#17) | FW | Argentina | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/52683--aston-villa/squad/) | 2026-11-04 | da |  |
| Aston Villa | N. Jackson (#11) | FW | Senegal | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/52683--aston-villa/squad/) | 2026-11-04 | da |  |
| Aston Villa | T. Abraham (#18) | FW | England | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/52683--aston-villa/squad/) | 2026-11-04 | da |  |
| Liverpool | A. Isak (#9) | FW | Sweden | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/7889--liverpool/squad/) | 2026-11-04 | da |  |
| Liverpool | H. Ekitiké (#22) | FW | France | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/7889--liverpool/squad/) | 2026-11-04 | da |  |
| Liverpool | C. Gakpo (#18) | FW | Netherlands | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/7889--liverpool/squad/) | 2026-11-04 | da |  |
| Real Madrid | K. Mbappé (#10) | FW | France | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/50051--real-madrid/squad/) | 2026-11-04 | da |  |
| Real Madrid | Vinícius Jr. (#7) | FW | Brazil | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/50051--real-madrid/squad/) | 2026-11-04 | da |  |
| Real Madrid | Y. Diomande (#25) | FW | Ivory Coast | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/50051--real-madrid/squad/) | 2026-11-04 | da |  |
| Sporting CP | L. Suárez (#97) | FW | Colombia | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/50149--sporting-cp/squad/) | 2026-11-04 | da |  |
| Sporting CP | G. Catamo (#10) | FW | Mozambique | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/50149--sporting-cp/squad/) | 2026-11-04 | da |  |
| Sporting CP | F. Ioannidis (#7) | FW | Greece | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/50149--sporting-cp/squad/) | 2026-11-04 | da |  |
| Real Betis | Antony (#7) | FW | Brazil | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/52265--real-betis/squad/) | 2026-11-04 | da |  |
| Real Betis | C. Hernández (#9) | FW | Colombia | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/52265--real-betis/squad/) | 2026-11-04 | da |  |
| Real Betis | Abde (#10) | FW | Morocco | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/52265--real-betis/squad/) | 2026-11-04 | da |  |
| Bayern Munich | H. Kane (#9) | FW | England | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/50037--bayern-munchen/squad/) | 2026-11-04 | da |  |
| Bayern Munich | M. Olise (#17) | W (listed MF) | France | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/50037--bayern-munchen/squad/) | 2026-11-04 | da |  |
| Bayern Munich | L. Díaz (#14) | FW | Colombia | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/50037--bayern-munchen/squad/) | 2026-11-04 | da |  |
| Arsenal | B. Saka (#7) | FW | England | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/52280--arsenal/squad/) | 2026-11-04 | da |  |
| Arsenal | V. Gyökeres (#14) | FW | Sweden | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/52280--arsenal/squad/) | 2026-11-04 | da |  |
| Arsenal | E. Eze (#10) | W/AM (listed MF) | England | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/52280--arsenal/squad/) | 2026-11-04 | da |  |
| Stuttgart | D. Undav (#26) | FW | Germany | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/50107--stuttgart/squad/) | 2026-11-04 | da |  |
| Stuttgart | J. Leweling (#18) | FW | Germany | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/50107--stuttgart/squad/) | 2026-11-04 | da |  |
| Stuttgart | T. Tomás (#8) | FW | Portugal | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/50107--stuttgart/squad/) | 2026-11-04 | da |  |
| Como | M. Kean (#90) | FW | Italy | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/79946--como/squad/) | 2026-11-04 | da |  |
| Como | A. Diao (#11) | FW | Senegal | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/79946--como/squad/) | 2026-11-04 | da |  |
| Como | T. Douvikas (#9) | FW | Greece | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/79946--como/squad/) | 2026-11-04 | da |  |
| Manchester City | E. Haaland (#9) | FW | Norway | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/52919--man-city/squad/) | 2026-11-04 | da |  |
| Manchester City | J. Doku (#11) | W (listed MF) | Belgium | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/52919--man-city/squad/) | 2026-11-04 | da |  |
| Manchester City | A. Semenyo (#42) | FW | Ghana | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/52919--man-city/squad/) | 2026-11-04 | da |  |
| Club Brugge | C. Forbs (#9) | FW | Portugal | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/50043--club-brugge/squad/) | 2026-11-04 | da |  |
| Club Brugge | N. Tresoldi (#7) | FW | Germany | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/50043--club-brugge/squad/) | 2026-11-04 | da |  |
| Club Brugge | R. Vermant (#17) | FW | Belgium | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/50043--club-brugge/squad/) | 2026-11-04 | da |  |
| Inter | L. Martínez (#10) | FW | Argentina | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/50138--inter/squad/) | 2026-11-04 | da |  |
| Inter | M. Thuram (#9) | FW | France | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/50138--inter/squad/) | 2026-11-04 | da |  |
| Inter | P. Esposito (#94) | FW | Italy | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/50138--inter/squad/) | 2026-11-04 | da |  |
| LASK | S. Kalajdzic (#11) | FW | Austria | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/63405--lask/squad/) | 2026-11-04 | da |  |
| LASK | M. Usor (#8) | FW | Nigeria | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/63405--lask/squad/) | 2026-11-04 | da | DA — nationality to confirm |
| LASK | S. Adeniran (#7) | FW | England | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/63405--lask/squad/) | 2026-11-04 | da | DA — nationality to confirm |
| Dortmund | S. Guirassy (#9) | FW | Guinea | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/52758--b-dortmund/squad/) | 2026-11-04 | da |  |
| Dortmund | M. Beier (#14) | FW | Germany | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/52758--b-dortmund/squad/) | 2026-11-04 | da |  |
| Dortmund | F. Silva (#21) | FW | Portugal | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/52758--b-dortmund/squad/) | 2026-11-04 | da |  |

## MARBLE CONTINENTAL (uel_top16)

| Echipă | Nume în video | Post | Naționalitate | Sursă | Consultat | Verificat | De verificat |
|---|---|---|---|---|---|---|---|
| Benfica | V. Pavlidis (#14) | FW | Greece | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/50147--benfica/squad/) | 2026-11-04 | da |  |
| Benfica | D. Lukébakio (#11) | FW | Belgium | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/50147--benfica/squad/) | 2026-11-04 | da |  |
| Benfica | J. Durán (#22) | FW | Colombia | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/50147--benfica/squad/) | 2026-11-04 | da |  |
| Bayer Leverkusen | P. Schick (#14) | FW | Czechia | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/50109--leverkusen/squad/) | 2026-11-04 | da |  |
| Bayer Leverkusen | M. Diaby (#19) | FW | France | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/50109--leverkusen/squad/) | 2026-11-04 | da | DA — nationality to confirm |
| Bayer Leverkusen | C. Kofane (#35) | FW | Cameroon | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/50109--leverkusen/squad/) | 2026-11-04 | da |  |
| Bournemouth | Evanilson (#9) | FW | Brazil | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/2601124--bournemouth/squad/) | 2026-11-04 | da |  |
| Bournemouth | J. Kluivert (#19) | FW | Netherlands | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/2601124--bournemouth/squad/) | 2026-11-04 | da |  |
| Bournemouth | A. Adli (#21) | FW | Morocco | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/2601124--bournemouth/squad/) | 2026-11-04 | da |  |
| Ferencváros | F. Kovačević (#19) | FW | Croatia | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/52298--ferencvaros/squad/) | 2026-11-04 | da | DA — nationality to confirm |
| Ferencváros | B. Yusuf (#11) | FW | Nigeria | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/52298--ferencvaros/squad/) | 2026-11-04 | da | DA — nationality to confirm |
| Ferencváros | L. Joseph (#75) | FW | France | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/52298--ferencvaros/squad/) | 2026-11-04 | da | DA — nationality to confirm |
| Olympiacos | R. Yaremchuk (#11) | FW | Ukraine | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/2610--olympiacos/squad/) | 2026-11-04 | da |  |
| Olympiacos | L. Bailey (#17) | FW | Jamaica | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/2610--olympiacos/squad/) | 2026-11-04 | da |  |
| Olympiacos | G. Martins (#10) | FW | Portugal | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/2610--olympiacos/squad/) | 2026-11-04 | da |  |
| Union Saint-Gilloise | K. Rodriguez (#13) | FW | Ecuador | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/64125--union-sg/squad/) | 2026-11-04 | da | DA — nationality to confirm |
| Union Saint-Gilloise | M. Biondic (#9) | FW | Croatia | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/64125--union-sg/squad/) | 2026-11-04 | da | DA — nationality to confirm |
| Union Saint-Gilloise | R. Florucz (#30) | FW | Austria | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/64125--union-sg/squad/) | 2026-11-04 | da |  |
| Juventus | K. Yıldız (#10) | FW | Türkiye | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/50139--juventus/squad/) | 2026-11-04 | da |  |
| Juventus | R. Kolo Muani (#9) | FW | France | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/50139--juventus/squad/) | 2026-11-04 | da |  |
| Juventus | F. Conceição (#7) | FW | Portugal | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/50139--juventus/squad/) | 2026-11-04 | da |  |
| Beşiktaş | D. Vlahović (#28) | FW | Serbia | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/50157--besiktas/squad/) | 2026-11-04 | da |  |
| Beşiktaş | E. Poku (#17) | FW | Netherlands | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/50157--besiktas/squad/) | 2026-11-04 | da | DA — nationality to confirm |
| Beşiktaş | S. Kılıçsoy (#90) | FW | Türkiye | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/50157--besiktas/squad/) | 2026-11-04 | da |  |
| Sunderland | W. Isidor (#18) | FW | France | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/53360--sunderland/squad/) | 2026-11-04 | da |  |
| Sunderland | B. Brobbey (#9) | FW | Netherlands | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/53360--sunderland/squad/) | 2026-11-04 | da |  |
| Sunderland | N. Angulo (#10) | FW | Ecuador | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/53360--sunderland/squad/) | 2026-11-04 | da |  |
| AZ Alkmaar | M. Meerdink (#9) | FW | Netherlands | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/52327--az-alkmaar/squad/) | 2026-11-04 | da |  |
| AZ Alkmaar | C. Stengs (#14) | FW | Netherlands | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/52327--az-alkmaar/squad/) | 2026-11-04 | da |  |
| AZ Alkmaar | W. Patati (#7) | FW | Netherlands | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/52327--az-alkmaar/squad/) | 2026-11-04 | da | DA — nationality to confirm |
| Omonia | F. Tănase (#17) | FW | Romania | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/50077--omonia/squad/) | 2026-11-04 | da |  |
| Omonia | A. Kakoullis (#9) | FW | Cyprus | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/50077--omonia/squad/) | 2026-11-04 | da |  |
| Omonia | M. Tankovic (#22) | FW | Sweden | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/50077--omonia/squad/) | 2026-11-04 | da |  |
| Lyon | L. Openda (#17) | FW | Belgium | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/5312--lyon/squad/) | 2026-11-04 | da |  |
| Lyon | E. Nuamah (#7) | FW | Ghana | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/5312--lyon/squad/) | 2026-11-04 | da |  |
| Lyon | K. Nakamura (#11) | FW | Japan | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/5312--lyon/squad/) | 2026-11-04 | da |  |
| Rennes | E. Lepaul (#9) | FW | France | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/55031--rennes/squad/) | 2026-11-04 | da |  |
| Rennes | B. Dia (#22) | FW | Senegal | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/55031--rennes/squad/) | 2026-11-04 | da |  |
| Rennes | M. Al-Taamari (#11) | FW | Jordan | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/55031--rennes/squad/) | 2026-11-04 | da |  |
| Real Sociedad | T. Kubo (#14) | FW | Japan | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/50123--real-sociedad/squad/) | 2026-11-04 | da |  |
| Real Sociedad | O. Óskarsson (#9) | FW | Iceland | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/50123--real-sociedad/squad/) | 2026-11-04 | da |  |
| Real Sociedad | G. Guedes (#11) | FW | Portugal | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/50123--real-sociedad/squad/) | 2026-11-04 | da |  |
| Crystal Palace | J. Mateta (#14) | FW | France | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/52916--crystal-palace/squad/) | 2026-11-04 | da |  |
| Crystal Palace | I. Sarr (#7) | FW | Senegal | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/52916--crystal-palace/squad/) | 2026-11-04 | da |  |
| Crystal Palace | Y. Pino (#10) | FW | Spain | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/52916--crystal-palace/squad/) | 2026-11-04 | da |  |
| Sparta Prague | J. Braut Brunes (#14) | FW | Norway | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/50033--sparta-praha/squad/) | 2026-11-04 | da | DA — nationality to confirm |
| Sparta Prague | M. Vojta (#29) | FW | Czechia | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/50033--sparta-praha/squad/) | 2026-11-04 | da |  |
| Sparta Prague | E. Singhateh (#27) | FW | Gambia | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/50033--sparta-praha/squad/) | 2026-11-04 | da | DA — nationality to confirm |

## PREMIER LEAGUE 2026/27 (premier_league_2026_27) — loturi 2026/27 (premierleague.com / uefa.com)

| Echipă | Nume în video | Post | Naționalitate | Sursă | Consultat | Verificat | De verificat |
|---|---|---|---|---|---|---|---|
| Arsenal | B. Saka (#7) | FW | England | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/52280--arsenal/squad/) | 2026-11-04 | da |  |
| Arsenal | V. Gyökeres (#14) | FW | Sweden | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/52280--arsenal/squad/) | 2026-11-04 | da |  |
| Arsenal | E. Eze (#10) | W/AM (listed MF) | England | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/52280--arsenal/squad/) | 2026-11-04 | da |  |
| Manchester City | E. Haaland (#9) | FW | Norway | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/52919--man-city/squad/) | 2026-11-04 | da |  |
| Manchester City | J. Doku (#11) | W (listed MF) | Belgium | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/52919--man-city/squad/) | 2026-11-04 | da |  |
| Manchester City | A. Semenyo (#42) | FW | Ghana | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/52919--man-city/squad/) | 2026-11-04 | da |  |
| Manchester United | B. Mbeumo (#19) | FW | Cameroon | [premierleague.com](https://www.premierleague.com/en/clubs/1/manchester-united/squad) | 2026-11-13 | da |  |
| Manchester United | M. Cunha (#10) | FW | Brazil | [premierleague.com](https://www.premierleague.com/en/clubs/1/manchester-united/squad) | 2026-11-13 | da |  |
| Manchester United | B. Šeško (#30) | FW | Slovenia | [premierleague.com](https://www.premierleague.com/en/clubs/1/manchester-united/squad) | 2026-11-13 | da |  |
| Aston Villa | A. Garnacho (#17) | FW | Argentina | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/52683--aston-villa/squad/) | 2026-11-04 | da |  |
| Aston Villa | N. Jackson (#11) | FW | Senegal | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/52683--aston-villa/squad/) | 2026-11-04 | da |  |
| Aston Villa | T. Abraham (#18) | FW | England | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/52683--aston-villa/squad/) | 2026-11-04 | da |  |
| Liverpool | A. Isak (#9) | FW | Sweden | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/7889--liverpool/squad/) | 2026-11-04 | da |  |
| Liverpool | H. Ekitiké (#22) | FW | France | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/7889--liverpool/squad/) | 2026-11-04 | da |  |
| Liverpool | C. Gakpo (#18) | FW | Netherlands | [uefa.com](https://www.uefa.com/uefachampionsleague/clubs/7889--liverpool/squad/) | 2026-11-04 | da |  |
| Bournemouth | Evanilson (#9) | FW | Brazil | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/2601124--bournemouth/squad/) | 2026-11-04 | da |  |
| Bournemouth | J. Kluivert (#19) | FW | Netherlands | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/2601124--bournemouth/squad/) | 2026-11-04 | da |  |
| Bournemouth | A. Adli (#21) | FW | Morocco | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/2601124--bournemouth/squad/) | 2026-11-04 | da |  |
| Sunderland | W. Isidor (#18) | FW | France | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/53360--sunderland/squad/) | 2026-11-04 | da |  |
| Sunderland | B. Brobbey (#9) | FW | Netherlands | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/53360--sunderland/squad/) | 2026-11-04 | da |  |
| Sunderland | N. Angulo (#10) | FW | Ecuador | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/53360--sunderland/squad/) | 2026-11-04 | da |  |
| Brighton & Hove Albion | G. Rutter (#10) | FW | France | [premierleague.com](https://www.premierleague.com/en/clubs/36/brighton-and-hove-albion/squad) | 2026-11-13 | da |  |
| Brighton & Hove Albion | Y. Minteh (#11) | FW | Gambia | [premierleague.com](https://www.premierleague.com/en/clubs/36/brighton-and-hove-albion/squad) | 2026-11-13 | da |  |
| Brighton & Hove Albion | S. Tzimas (#9) | FW | Greece | [premierleague.com](https://www.premierleague.com/en/clubs/36/brighton-and-hove-albion/squad) | 2026-11-13 | da |  |
| Brentford | Igor Thiago (#9) | FW | Brazil | [premierleague.com](https://www.premierleague.com/en/clubs/94/brentford/squad) | 2026-11-13 | da |  |
| Brentford | D. Ouattara (#11) | FW | Burkina Faso | [premierleague.com](https://www.premierleague.com/en/clubs/94/brentford/squad) | 2026-11-13 | da |  |
| Brentford | C. Wilson (#13) | FW | England | [premierleague.com](https://www.premierleague.com/en/clubs/94/brentford/squad) | 2026-11-13 | da |  |
| Chelsea | João Pedro (#9) | FW | Brazil | [premierleague.com](https://www.premierleague.com/en/clubs/8/chelsea/squad) | 2026-11-13 | da |  |
| Chelsea | P. Neto (#7) | FW | Portugal | [premierleague.com](https://www.premierleague.com/en/clubs/8/chelsea/squad) | 2026-11-13 | da |  |
| Chelsea | Estêvão (#41) | FW | Brazil | [premierleague.com](https://www.premierleague.com/en/clubs/8/chelsea/squad) | 2026-11-13 | da |  |
| Fulham | R. Muniz (#9) | FW | Brazil | [premierleague.com](https://www.premierleague.com/en/clubs/54/fulham/squad) | 2026-11-13 | da |  |
| Fulham | A. Iwobi (#17) | FW | Nigeria | [premierleague.com](https://www.premierleague.com/en/clubs/54/fulham/squad) | 2026-11-13 | da |  |
| Fulham | Kevin (#11) | FW | Brazil | [premierleague.com](https://www.premierleague.com/en/clubs/54/fulham/squad) | 2026-11-13 | da |  |
| Newcastle United | Y. Wissa (#9) | FW | DR Congo | [premierleague.com](https://www.premierleague.com/en/clubs/4/newcastle-united/squad) | 2026-11-13 | da |  |
| Newcastle United | A. Elanga (#19) | FW | Sweden | [premierleague.com](https://www.premierleague.com/en/clubs/4/newcastle-united/squad) | 2026-11-13 | da |  |
| Newcastle United | W. Osula (#10) | FW | Denmark | [premierleague.com](https://www.premierleague.com/en/clubs/4/newcastle-united/squad) | 2026-11-13 | da |  |
| Everton | T. Barry (#11) | FW | France | [premierleague.com](https://www.premierleague.com/en/clubs/11/everton/squad) | 2026-11-13 | da |  |
| Everton | B. Johnson (#22) | FW | Wales | [premierleague.com](https://www.premierleague.com/en/clubs/11/everton/squad) | 2026-11-13 | da |  |
| Everton | T. Dibling (#20) | FW | England | [premierleague.com](https://www.premierleague.com/en/clubs/11/everton/squad) | 2026-11-13 | da |  |
| Leeds United | D. Calvert-Lewin (#9) | FW | England | [premierleague.com](https://www.premierleague.com/en/clubs/2/leeds-united/squad) | 2026-11-13 | da |  |
| Leeds United | N. Okafor (#19) | FW | Switzerland | [premierleague.com](https://www.premierleague.com/en/clubs/2/leeds-united/squad) | 2026-11-13 | da |  |
| Leeds United | D. James (#7) | FW | Wales | [premierleague.com](https://www.premierleague.com/en/clubs/2/leeds-united/squad) | 2026-11-13 | da |  |
| Crystal Palace | J. Mateta (#14) | FW | France | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/52916--crystal-palace/squad/) | 2026-11-04 | da |  |
| Crystal Palace | I. Sarr (#7) | FW | Senegal | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/52916--crystal-palace/squad/) | 2026-11-04 | da |  |
| Crystal Palace | Y. Pino (#10) | FW | Spain | [uefa.com](https://www.uefa.com/uefaeuropaleague/clubs/52916--crystal-palace/squad/) | 2026-11-04 | da |  |
| Nottingham Forest | C. Wood (#9) | FW | New Zealand | [premierleague.com](https://www.premierleague.com/en/clubs/17/nottingham-forest/squad) | 2026-11-13 | da |  |
| Nottingham Forest | L. Delap (#19) | FW | England | [premierleague.com](https://www.premierleague.com/en/clubs/17/nottingham-forest/squad) | 2026-11-13 | da |  |
| Nottingham Forest | D. Ndoye (#14) | FW | Switzerland | [premierleague.com](https://www.premierleague.com/en/clubs/17/nottingham-forest/squad) | 2026-11-13 | da |  |
| Tottenham Hotspur | D. Solanke (#19) | FW | England | [premierleague.com](https://www.premierleague.com/en/clubs/6/tottenham-hotspur/squad) | 2026-11-13 | da |  |
| Tottenham Hotspur | O. Marmoush (#22) | FW | Egypt | [premierleague.com](https://www.premierleague.com/en/clubs/6/tottenham-hotspur/squad) | 2026-11-13 | da |  |
| Tottenham Hotspur | Richarlison (#9) | FW | Brazil | [premierleague.com](https://www.premierleague.com/en/clubs/6/tottenham-hotspur/squad) | 2026-11-13 | da |  |
| Coventry City | H. Wright (#11) | FW | United States | [premierleague.com](https://www.premierleague.com/en/clubs/9/coventry-city/squad) | 2026-11-13 | da |  |
| Coventry City | E. Simms (#9) | FW | England | [premierleague.com](https://www.premierleague.com/en/clubs/9/coventry-city/squad) | 2026-11-13 | da |  |
| Coventry City | T. Awoniyi (#14) | FW | Nigeria | [premierleague.com](https://www.premierleague.com/en/clubs/9/coventry-city/squad) | 2026-11-13 | da |  |
| Ipswich Town | J. Clarke (#47) | FW | England | [premierleague.com](https://www.premierleague.com/en/clubs/40/ipswich-town/squad) | 2026-11-13 | da |  |
| Ipswich Town | C. Akpom (#29) | FW | England | [premierleague.com](https://www.premierleague.com/en/clubs/40/ipswich-town/squad) | 2026-11-13 | da |  |
| Ipswich Town | D. Maeda (#38) | FW | Japan | [premierleague.com](https://www.premierleague.com/en/clubs/40/ipswich-town/squad) | 2026-11-13 | da |  |
| Hull City | O. McBurnie (#9) | FW | Scotland | [premierleague.com](https://www.premierleague.com/en/clubs/88/hull-city/squad) | 2026-11-13 | da |  |
| Hull City | J. Gelhardt (#11) | FW | England | [premierleague.com](https://www.premierleague.com/en/clubs/88/hull-city/squad) | 2026-11-13 | da |  |
| Hull City | M. Belloumi (#10) | FW | Algeria | [premierleague.com](https://www.premierleague.com/en/clubs/88/hull-city/squad) | 2026-11-13 | da |  |
