# Reguli de conținut (pe scurt)

1. **Este o simulare.** Pe ecran nu mai apare eticheta `SIMULATION` (o poți reporni cu `show_simulation_label: true` în `config/rules/base.json`). La încărcare răspunzi corect la întrebarea YouTube despre conținut modificat/sintetic. Textele generate în `publish/` au deja „Simulation” în fiecare titlu și disclaimerul (simulare pe calculator, nu rezultate reale, fără legătură cu vreun club sau competiție).
2. **Numele echipelor** apar ca text simplu. **Siglele** apar doar pe bile (`logos_on_balls`). Sunt mărci înregistrate: riscul e al tău (nu e sfat juridic). Le poți opri oricând cu `logos_on_balls: false`.
3. **Fără** sigle de competiții, trofee oficiale, sponsori, design de tricouri, imnuri sau muzică străină. Muzica e generată de program.
4. **Numele competițiilor** sunt ale noastre: MARBLE CHAMPIONS, MARBLE CONTINENTAL, MARBLE WORLD NATIONS, MARBLE EURO NATIONS.
5. **Toate bilele au aceeași mărime.** Puterea unei echipe nu se vede niciodată prin mărime.
6. **Nume reale de jucători** doar în video: reluarea golului, Omul meciului, ecranul câștigătorului, podium. **Niciodată** în titlu, descriere, tag-uri, thumbnail sau nume de fișiere. Fără fețe sau fotografii.
7. **Fiecare video trebuie să arate diferit** de cele anterioare (altă hartă sau competiție, alte culori, altă muzică). `next` și preflight verifică asta.
8. **Ritm** (din `plan/OPERATING_RULES.md`): cel mult un video lung pe zi; acum există un singur reel per video; un video lung pe săptămână; la un meci real important în ziua D, videoul lung apare în seara D−1 (19:00, ora Danemarcei), reel-urile în D−1 și D.
9. **Tu verifici fiecare video** înainte de publicare: întâi încarci **privat**, te uiți, apoi publici.
10. **Nimic nu se încarcă automat.** Programul nu are cod de upload.
