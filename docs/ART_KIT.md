# Kit grafic „pro” (P9)

## Ce există
Un set de desene noi pentru harta Premier League (toate 4 variantele: zi, înnorat, seară, noapte cu burniță), în fișierul `render/art_pro.js`. Fizica NU s-a schimbat: aceleași forme, aceleași mărimi, aceeași minge pentru toți, aceleași rezultate (testele verifică hash-urile meciurilor).

Ce s-a adăugat:
- **Platforme („insule”)**: zidărie din piatră cu blocuri de mărimi și nuanțe diferite (fără model repetat), colțuri ciobite, crăpături, mușchi, pietricele, umbră sub iarbă, lumină laterală după direcția luminii din variantă, margine luminată, umezeală la noapte. Strat gros de gazon cu dungi de tuns, fire de iarbă atârnând peste piatră și **fire de iarbă care se mișcă în vânt**. Umbră de contact pe terenul din spate.
- **Poartă**: bare rotunde cu reflexii, umbra barei pe plasă, plasă cu adâncime (panou lateral, acoperiș, ramă din spate), noduri, umbre pe sfori, linia porții pictată. La gol: **plasa face unde** din punctul de impact, rama vibrează puțin, flash de lumină, iarbă și praf.
- **Portar**: proporții mai bune, tricou cu umbre în culoarea portarului, mâneci, mănuși cu bandă, ghete, păr (sau șapcă în varianta cu soare), umbră moale, **respirație** când stă, aplecare spre minge și strângerea picioarelor la săritură (doar vizual, sincron cu logica existentă). Fără fețe sau echipamente reale.
- **Moară**: metal cu reflexie, nituri, butuc cu șuruburi și sclipire, **blur de mișcare** când se rotește repede, umbră pe iarbă, suport din oțel cu contravântuiri și placă cu șuruburi. La lovitura unei mingi: **scântei + inel de șoc**.
- **Pompă/țeavă**: tub de sticlă cu reflexii și coliere metalice, canal săpat în piatră, gaură cu adâncime, guler metalic care **sare puțin** și **pufăie aer** la fiecare lansare.
- **Minge**: umbră moale care se mărește cu înălțimea, punct de reflexie și lumină de contur; dâră doar la șuturile foarte rapide. Mărimea și decalul NU s-au schimbat.
- **Ambient**: nori care plutesc, păsări (ziua), lumini de stadion care pulsează ușor cu „flare”, conuri de lumină și praf în lumină (seara/noaptea), ploaie în 2 straturi cu stropi și cercuri în bălți (noaptea), teren ud cu reflexii, **camera „respiră”** (max ~2 px, niciodată în timpul zoom-ului de la gol, slow-motion, reluări sau reel-uri).
- **Efecte**: la gol scântei în culorile echipei care a marcat și o bandă de lumină care traversează ecranul; la slow-motion linii de viteză și o margine cromatică subtilă.
- **UI (ligă)**: tabela de scor, cardul de rezultat, banner-ul de gol, clasamentul și reel-ul au panouri cu colțuri rotunjite, luciu, umbră moale, barele de zonă rotunjite, săgețile apar cu un mic „overshoot”. Aceleași poziții și mărimi de text ca în P7 (rând ≥ 36 px, font ≥ 22 px).

## Cum îl pornești / oprești
În fișierul hărții (`config/maps/<harta>.json`):
```json
"art_style": "pro"
```
- `"pro"` = kitul nou (activ implicit pe cele 4 hărți `premier_*`).
- `"classic"` sau cheia lipsă = aspectul vechi aprobat (toate celelalte hărți; testele verifică că arată identic pixel cu pixel).
- Merge și pe alte hărți (ex. `sky_clean`), dar acolo e oprit până decizi tu.

## Dependențe
**Nicio dependență nouă.** Totul e Canvas 2D simplu, în Chromium-ul Playwright care exista deja; zgomot determinist din funcții hash proprii (fără `Math.random`, fără ceas, fără internet la randare). Nu s-a instalat niciun pachet npm, nicio bibliotecă și niciun skill.

| Pachet | Versiune | Licență | Folosit pentru |
|---|---|---|---|
| (niciunul nou) | – | – | – |

## Viteză
Fundalul static (stadion, platforme) se desenează o singură dată și se păstrează în memorie la rezoluția video. Măsurat pe cadre fixe (fără video, 1920x1080): înainte **23,1 ms/cadru** în medie, acum **~13,7 ms/cadru** (mai rapid, pentru că fundalul se desenează la scară 1:1). Comandă: `npm run art:bench`.

## Fișiere
- `render/art_pro.js` – kitul (toate desenele noi)
- `render/draw.js` – alege kitul când `art_style` este `"pro"`
- `tools/p9_stills.js` – cadre de control (PNG), `tools/p9_bench.js` – timp pe cadru, `tools/p9_pixels.js`, `tools/p9_hashes.js` – pentru teste
- `tests/p9_tests.js` – teste (`npm run test:p9`)

# Atmosferă „Premier” (P10)

Totul se configurează în `config/atmosphere.json` (doar hărțile cu `art_style: "pro"`). Pui `false` la un efect ca să-l oprești; `"enabled": false` oprește tot P10 dintr-o linie. Fizica NU se schimbă niciodată (aceleași hash-uri ca P9).

| Flag | Ce face |
|---|---|
| `match_intro`, `intro_s` | intro de ~2,8 s înainte de fiecare meci: cameră de sus, blur → clar, scorul intră din lateral |
| `match_transitions`, `transition_s` | tranziție de 1 s între meciuri (dungă în culorile echipelor, „MATCH n OF 10”, swoosh) |
| `earth_platforms` | platformele laterale din pământ (straturi, pietre, rădăcini) în loc de piatră |
| `wind` | vânt pe meci: iarba, norii, plasa porții și ploaia se înclină în aceeași direcție |
| `rain` | ploaie pe hărțile înnorate / de noapte (3 straturi, stropi pe gazon) |
| `lens_droplets` | picături pe „obiectiv” când plouă |
| `rounded_goal` | colțurile porții rotunjite, cu cleme și umbră |
| `split_stands` | tribunele împărțite: stânga în culorile gazdei, dreapta în ale oaspeților |
| `stand_flags` | steaguri în două culori și bannere cu prescurtarea echipei (fără sponsori) |
| `stand_smoke` | fum colorat + torțe rare (o dată pe meci + la goluri, partea care marchează) |
| `crowd_reactions` | la gol jumătatea echipei care marchează sare, cealaltă se întunecă; ocazii mari = reacție mică |
| `crowd_audio`, `crowd_gain` | sunetul publicului (sintetizat de noi: murmur, urale, oftat, aplauze, tobe, bubuitura morii) |
| `trophy_v2` | trofeul nostru original nou (cupă-lalea, bandă de marmură, minge aurie, piedestal) |
| `birds`, `insects` | păsări pe cer ziua, insecte în lumina reflectoarelor noaptea |
| `corner_flags` | steaguri de colț care flutură în vânt |
| `whistle_flash` | sclipire scurtă la fluierul de start/final |
| `dust_puffs` | praf la loviturile foarte puternice ale morii |
| `net_sparkle`, `goal_banner_flash` | sclipiri în plasă și pe banner la gol |
| `replay_swoosh` | „swoosh” la intrarea în reluare |
| `pitch_reflections` | reflexii ușoare ale reflectoarelor pe gazonul ud |

Dacă un render devine prea lent: oprește întâi `stand_smoke`, `split_stands`, `rain`, apoi `earth_platforms`.
Viteză (cadre fixe 1920×1080): P9 19,2 ms/cadru → P10 ~22,4 ms/cadru (≈ +17%).
Fișiere: `sim/atmosphere.js` (date din cronologia meciului), `render/atmo.js` (tribune, fum, intro, tranziții, trofeu), `render/art_pro.js` + `render/draw.js` (pământ, vânt, ploaie, poartă), `audio/crowd.py` (sunet public).
Teste: `npm run test:p10`.
