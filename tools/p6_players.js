'use strict';
// P6 one-off: player audit 2026-11-13. Writes team/nationality/position/source/verified into config/teams/*.json.
// Nations: latest call-up found on the web (Nov 2026 unless noted). Clubs: UEFA 2026/27 squad lists (retrieved 2026-11-04;
// the registration window has been closed since 1 Sep, so those lists cannot have changed) + nationality added.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const R = '2026-11-13';
const N = (name, pos, src, verified, note) => ({ name, pos, src, verified, note });
const NAT = {
  nt_spain: ['Spain', 'https://www.comuniate.com/en/noticias/38889/luis-de-la-fuente-names-squad-for-group-stage-finale', [N('L. Yamal', 'FW'), N('M. Oyarzabal', 'FW'), N('Y. Pino', 'FW')]],
  nt_argentina: ['Argentina', 'https://442.perfil.com/noticias/seleccion-argentina/lionel-scaloni-confirmo-los-convocados-de-la-seleccion-argentina-para-la-fecha-fifa.phtml', [N('J. Álvarez', 'FW'), N('T. Almada', 'FW'), N('S. Castro', 'FW')]],
  nt_france: ['France', 'https://khelnow.com/football/france-november-uefa-nations-league-squad-202611', [N('K. Mbappé', 'FW'), N('M. Olise', 'FW'), N('D. Doué', 'FW')]],
  nt_england: ['England', 'https://www.sportsmole.co.uk/football/england/uefa-nations-league/news/palmer-white-king-decisions-england-squad-for-november-confirmed_608569.html', [N('H. Kane', 'FW'), N('A. Gordon', 'FW'), N('E. Eze', 'FW')]],
  nt_portugal: ['Portugal', 'https://khelnow.com/football/portugal-november-uefa-nations-league-squad-202611', [N('R. Leão', 'FW'), N('G. Ramos', 'FW'), N('J. Félix', 'FW')]],
  nt_brazil: ['Brazil', 'https://trivela.com.br/brasil/selecao-brasileira-convocacao-ancelotti-expande-leque/', [N('Vinícius Jr.', 'FW'), N('Raphinha', 'FW'), N('Estêvão', 'FW')]],
  nt_morocco: ['Morocco', 'https://www.ysscores.com/en/news/14087541/wahbi-announces-morocco-squad-for-niger-clashes-amid-notable-absences', [N('B. Díaz', 'FW'), N('Y. En-Nesyri', 'FW'), N('A. El Kaabi', 'FW', null, false, 'Sep 2026 squad; Nov 2026 full list not found')]],
  nt_belgium: ['Belgium', 'https://sporza.be/nl/2026/11/05/livestream-welke-rode-duivels-roept-mark-van-bommel-op-voor-komend-nations-league-tweeluik~1793900077484/', [N('R. Lukaku', 'FW'), N('L. Trossard', 'FW'), N('C. De Ketelaere', 'FW')]],
  nt_netherlands: ['Netherlands', 'https://news.bet365.nl/nl-nl/article/xavi-maakt-selectie-oranje-bekend-voor-komende-interlandperiode/2026110611442297493', [N('C. Gakpo', 'FW'), N('C. Summerville', 'FW'), N('N. Lang', 'FW')]],
  nt_mexico: ['Mexico', 'https://www.excelsior.com.mx/deportes/henry-martin-borrado-seleccion-mexicana-pese-buenos-numeros', [N('S. Giménez', 'FW'), N('A. González', 'FW'), N('J. Quiñones', 'FW', 'https://www.latribuna.hn/2026/11/06/quinones-vuelve-a-un-mexico-urgido-de-goles/')]],
  nt_colombia: ['Colombia', 'https://www.clarosports.com/colombia/seleccion-colombiana/oficial-la-convocatoria-de-nestor-lorenzo-para-los-partidos-amistosos-ante-chile/', [N('J. Arias', 'FW'), N('Ó. Perea', 'FW'), N('D. Mosquera', 'FW')]],
  nt_switzerland: ['Switzerland', 'https://www.plattformj.ch/artikel/248250/', [N('B. Embolo', 'FW'), N('Z. Amdouni', 'FW'), N('R. Vargas', 'FW')]],
  nt_germany: ['Germany', 'https://www.90min.de/klopp-nominiert-zum-zweiten-mal-diese-24-spieler-stehen-im-dfb-kader', [N('K. Havertz', 'FW'), N('N. Füllkrug', 'FW', 'https://www.dfb.de/news/mit-fuellkrug-und-mohya-klopp-nominiert-kader-fuer-serbien-und-niederlande'), N('Y. Ebnoutalib', 'FW')]],
  nt_croatia: ['Croatia', 'https://hns.team/en/news/31688/bilic-the-best-players-play-for-the-national-teamthat-is-the-only-criterion/', [N('A. Kramarić', 'FW', null, true, 'Sep/Oct 2026 squad; reported unavailable (injury) in Nov'), N('F. Ivanović', 'FW'), N('L. Majer', 'FW', null, false, 'listed among forwards by HNS; usually an attacking midfielder')]],
  nt_italy: ['Italy', 'https://sport.sky.it/calcio/nazionale/convocati-italia-mancini-nazionale-nations-league-novembre-2026', [N('P. Esposito', 'FW'), N('G. Scamacca', 'FW'), N('N. Cambiaghi', 'FW')]],
  nt_usa: ['USA', 'https://www.si.com/soccer/usmnt-november-2026-roster-confirmed-full-list-players-stars-schedule', [N('C. Pulisic', 'FW'), N('F. Balogun', 'FW'), N('C. Sullivan', 'FW')]],
  nt_norway: ['Norway', 'https://www.flashscore.com/news/soccer-uefa-nations-league-norway-boosted-by-the-return-of-atletico-madrid-striker-for-vital-clash-against-denmark/d64ecbat/', [N('E. Haaland', 'FW'), N('A. Sørloth', 'FW'), N('A. Nusa', 'FW', 'https://www.fourfourtwo.com/team/norway-world-cup-2026-squad', false, 'World Cup 2026 squad; Nov 2026 list not confirmed')]],
  nt_denmark: ['Denmark', 'https://www.fourfourtwo.com/team/denmark-world-cup-2026-squad', [N('R. Højlund', 'FW', null, false, 'Nov 2026 squad not found'), N('G. Isaksen', 'FW', null, false, 'Nov 2026 squad not found'), N('J. Wind', 'FW', null, false, 'Nov 2026 squad not found')]],
  nt_austria: ['Austria', 'https://www.salzburg24.at/sport/fussball/showdown-um-nations-league-aufstieg-ralf-rangnick-nominiert-vier-salzburger-fuer-oefb-team-art-343276', [N('M. Grüll', 'FW'), N('C. Baumgartner', 'FW'), N('R. Florucz', 'FW', 'https://www.weekend.at/sport/yusuf-demir-oefb-comeback', false, 'late call-up, date not confirmed')]],
  nt_turkiye: ['Türkiye', 'https://gazeteoksijen.com/spor/a-milli-takimin-aday-kadrosu-aciklandi-295235', [N('Y. Akgün', 'FW'), N('B. Yılmaz', 'FW'), N('D. Gül', 'FW')]],
  nt_sweden: ['Sweden', 'https://news.bet365.com/sv-sv/article/sveriges-trupp-till-de-avgorande-nations-league-matcherna-i-november/2026110410474912091', [N('V. Gyökeres', 'FW'), N('A. Isak', 'FW'), N('A. Elanga', 'FW')]],
  nt_ukraine: ['Ukraine', 'https://dynamo.kiev.ua/en/news/703869-serhiy-rebrov-announced-the-ukrainian-national-teams-lineup-for-the-november-world-cup-2026-qualifiers-against-france-and-icela', [N('A. Dovbyk', 'FW', null, false, 'latest list found is Nov 2025'), N('V. Vanat', 'FW', null, false, 'latest list found is Nov 2025'), N('R. Yaremchuk', 'FW', null, false, 'latest list found is Nov 2025')]],
};
// club players: nationality ('?' = to confirm). Real Madrid third attacker -> Y. Diomande (Max's hint, in the UEFA list as #25)
const CLUB_NAT = {
  psg: ['France', 'Georgia', 'France'], barcelona: ['Spain', 'Brazil', 'England'], aston_villa: ['Argentina', 'Senegal', 'England'], liverpool: ['Sweden', 'France', 'Netherlands'],
  real_madrid: ['France', 'Brazil', 'Ivory Coast'], sporting: ['Colombia', 'Mozambique', 'Greece'], real_betis: ['Brazil', 'Colombia', 'Morocco'], bayern: ['England', 'France', 'Colombia'],
  arsenal: ['England', 'Sweden', 'England'], stuttgart: ['Germany', 'Germany', 'Portugal'], como: ['Italy', 'Senegal', 'Greece'], man_city: ['Norway', 'Belgium', 'Ghana'],
  club_brugge: ['Portugal', 'Germany', 'Belgium'], inter: ['Argentina', 'France', 'Italy'], lask: ['Austria', 'Nigeria?', 'England?'], dortmund: ['Guinea', 'Germany', 'Portugal'],
  benfica: ['Greece', 'Belgium', 'Colombia'], leverkusen: ['Czechia', 'France?', 'Cameroon'], bournemouth: ['Brazil', 'Netherlands', 'Morocco'], ferencvaros: ['Croatia?', 'Nigeria?', 'France?'],
  olympiacos: ['Ukraine', 'Jamaica', 'Portugal'], union_sg: ['Ecuador?', 'Croatia?', 'Austria'], juventus: ['Türkiye', 'France', 'Portugal'], besiktas: ['Serbia', 'Netherlands?', 'Türkiye'],
  sunderland: ['France', 'Netherlands', 'Ecuador'], az: ['Netherlands', 'Netherlands', 'Netherlands?'], omonia: ['Romania', 'Cyprus', 'Sweden'], lyon: ['Belgium', 'Ghana', 'Japan'],
  rennes: ['France', 'Senegal', 'Jordan'], real_sociedad: ['Japan', 'Iceland', 'Portugal'], crystal_palace: ['France', 'Senegal', 'Spain'], sparta_praha: ['Norway?', 'Czechia', 'Gambia?'],
};
const changes = [];
const rd = (id) => JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'teams', id + '.json'), 'utf8'));
const wr = (id, t) => fs.writeFileSync(path.join(ROOT, 'config', 'teams', id + '.json'), JSON.stringify(t, null, 1) + '\n');
for (const [id, [nat, src, ps]] of Object.entries(NAT)) {
  const t = rd(id); const old = t.players.map((p) => p.name);
  // national-team shirt numbers change per camp: no number stored (the video shows the team name instead)
  t.players = ps.map((p) => Object.assign({ name: p.name, team: t.name, nationality: nat, position: p.pos, source_url: p.src || src, retrieved: R, verified: p.verified !== false }, p.note ? { note: p.note } : {}));
  if (old.join() !== t.players.map((p) => p.name).join()) changes.push(`${t.name}: ${old.join(', ')} -> ${t.players.map((p) => p.name).join(', ')}`);
  wr(id, t);
}
for (const [id, nats] of Object.entries(CLUB_NAT)) {
  const t = rd(id); const old = t.players.map((p) => p.name);
  if (id === 'real_madrid') {
    t.players[1].name = 'Vinícius Jr.';
    t.players[2] = Object.assign({}, t.players[2], { name: 'Y. Diomande', number: 25, position: 'FW', note: 'winger, listed as midfielder by UEFA; third attacker as Max suggested' });
  }
  t.players = t.players.map((p, i) => {
    const n = nats[i];
    const o = { name: p.name, number: p.number, team: t.name, nationality: n.replace('?', ''), position: p.position || 'FW', source_url: p.source_url, retrieved: p.retrieved, verified: p.verified !== false };
    const notes = [n.endsWith('?') ? 'nationality to confirm' : null, p.note || null].filter(Boolean);
    if (notes.length) o.note = notes.join('; ');
    if (p.number_note) o.number_note = p.number_note;
    return o;
  });
  if (old.join() !== t.players.map((p) => p.name).join()) changes.push(`${t.name}: ${old.join(', ')} -> ${t.players.map((p) => p.name).join(', ')}`);
  wr(id, t);
}
fs.mkdirSync(path.join(ROOT, 'build'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'build', 'p6_player_changes.txt'), changes.join('\n') + '\n');
console.log(changes.join('\n'));
