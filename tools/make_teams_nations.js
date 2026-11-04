// One-off generator for national teams (P3: MARBLE WORLD NATIONS / MARBLE EURO NATIONS).
// Squads: "Current squad" (or "Recent call-ups" where marked) of each team's English Wikipedia article, retrieved 2026-11-04.
// A number marked with * was not shown in the source (unnumbered call-up) and was set by us.
const fs = require('fs');
const path = require('path');
const D = '2026-11-04';
const W = (a) => 'https://en.wikipedia.org/wiki/' + a;
// id: [name, short, primary, secondary, article, flag file, players "Name:number[*]"]
const T = {
  nt_spain: ['Spain', 'ESP', '#C60B1E', '#FFC400', 'Spain_national_football_team', 'Flag_of_Spain.svg', ['L. Yamal:19', 'M. Oyarzabal:21', 'Y. Pino:11']],
  nt_argentina: ['Argentina', 'ARG', '#75AADB', '#FFFFFF', 'Argentina_national_football_team', 'Flag_of_Argentina.svg', ['J. Álvarez:9*', 'T. Almada:16*', 'G. Simeone:20*']],
  nt_france: ['France', 'FRA', '#002654', '#FFFFFF', 'France_national_football_team', 'Flag_of_France.svg', ['O. Dembélé:7', 'M. Olise:11', 'D. Doué:20']],
  nt_england: ['England', 'ENG', '#FFFFFF', '#CF081F', 'England_national_football_team', 'Flag_of_England.svg', ['H. Kane:9', 'B. Saka:7', 'A. Gordon:11']],
  nt_portugal: ['Portugal', 'POR', '#C8102E', '#046A38', 'Portugal_national_football_team', 'Flag_of_Portugal.svg', ['R. Leão:7', 'G. Ramos:9', 'J. Félix:11']],
  nt_brazil: ['Brazil', 'BRA', '#FFDF00', '#009C3B', 'Brazil_national_football_team', 'Flag_of_Brazil.svg', ['Vinícius Jr.:7*', 'Raphinha:11*', 'Estêvão:20*']],
  nt_morocco: ['Morocco', 'MAR', '#C1272D', '#006233', 'Morocco_national_football_team', 'Flag_of_Morocco.svg', ['B. Díaz:10', 'S. Rahimi:9', 'A. Ezzalzouli:17']],
  nt_belgium: ['Belgium', 'BEL', '#E30613', '#FDDA24', 'Belgium_national_football_team', 'Flag_of_Belgium.svg', ['R. Lukaku:9', 'L. Trossard:10', 'C. De Ketelaere:17']],
  nt_netherlands: ['Netherlands', 'NED', '#F36C21', '#21468B', 'Netherlands_national_football_team', 'Flag_of_the_Netherlands.svg', ['J. Zirkzee:9', 'C. Summerville:7', 'N. Lang:10']],
  nt_mexico: ['Mexico', 'MEX', '#006847', '#FFFFFF', 'Mexico_national_football_team', 'Flag_of_Mexico.svg', ['S. Giménez:11', 'G. Berterame:9', 'R. Alvarado:25']],
  nt_colombia: ['Colombia', 'COL', '#FCD116', '#003893', 'Colombia_national_football_team', 'Flag_of_Colombia.svg', ['L. Suárez:9', 'K. Viveros:20', 'Ó. Perea:7']],
  nt_switzerland: ['Switzerland', 'SUI', '#D52B1E', '#FFFFFF', 'Switzerland_national_football_team', 'Flag_of_Switzerland.svg', ['D. Ndoye:11', 'Z. Amdouni:10', 'J. Monteiro:7']],
  nt_germany: ['Germany', 'GER', '#FFFFFF', '#000000', 'Germany_national_football_team', 'Flag_of_Germany.svg', ['N. Woltemade:11', 'J. Burkardt:10', 'D. Scherhant:9']],
  nt_croatia: ['Croatia', 'CRO', '#E1000F', '#FFFFFF', 'Croatia_national_football_team', 'Flag_of_Croatia.svg', ['A. Kramarić:9*', 'I. Perišić:4*', 'A. Budimir:17*']],
  nt_italy: ['Italy', 'ITA', '#0066B2', '#FFFFFF', 'Italy_national_football_team', 'Flag_of_Italy.svg', ['P. Esposito:9', 'G. Scamacca:11', 'D. Maldini:17']],
  nt_usa: ['United States', 'USA', '#FFFFFF', '#0A3161', "United_States_men's_national_soccer_team", 'Flag_of_the_United_States.svg', ['C. Pulisic:10*', 'F. Balogun:20*', 'T. Weah:21*']],
  nt_norway: ['Norway', 'NOR', '#BA0C2F', '#00205B', 'Norway_national_football_team', 'Flag_of_Norway.svg', ['E. Haaland:9', 'J. Strand Larsen:11', 'A. Nusa:20']],
  nt_denmark: ['Denmark', 'DEN', '#C8102E', '#FFFFFF', 'Denmark_national_football_team', 'Flag_of_Denmark.svg', ['R. Højlund:9', 'G. Isaksen:8', 'A. Skov Olsen:11']],
  nt_austria: ['Austria', 'AUT', '#ED2939', '#FFFFFF', 'Austria_national_football_team', 'Flag_of_Austria.svg', ['S. Kalajdžić:9', 'M. Gregoritsch:11', 'M. Grüll:19']],
  nt_turkiye: ['Türkiye', 'TUR', '#E30A17', '#FFFFFF', 'Turkey_national_football_team', 'Flag_of_Turkey.svg', ['K. Aktürkoğlu:7', 'İ. Kahveci:10', 'Y. Akgün:19']],
  nt_sweden: ['Sweden', 'SWE', '#FECC02', '#006AA7', "Sweden_men's_national_football_team", 'Flag_of_Sweden.svg', ['V. Gyökeres:17', 'P. Abraham:9', 'A. Isak:18*']],
  nt_ukraine: ['Ukraine', 'UKR', '#FFD500', '#005BBB', 'Ukraine_national_football_team', 'Flag_of_Ukraine.svg', ['R. Yaremchuk:9', 'A. Yarmolenko:7', 'V. Vanat:11']],
};
const FIRST = 'ABCDEFGHJKLMNOPRST';
const LAST = ['Aldane', 'Brevik', 'Castor', 'Delmar', 'Evrard', 'Forsyth', 'Galen', 'Holmar', 'Isbert', 'Jesper', 'Korvin', 'Laredo', 'Marlow', 'Nyberg', 'Orlan', 'Pavane', 'Rask', 'Solano', 'Tarrant', 'Udell', 'Varro', 'Welke', 'Yvain', 'Zorin', 'Ambry', 'Belvoir', 'Cordell', 'Dunstan', 'Elric', 'Fenner', 'Gaspard', 'Hollis', 'Ingram', 'Jarvik', 'Kestrel', 'Lisle', 'Merrick', 'Norland', 'Oakes', 'Penrose', 'Quint', 'Rowan', 'Sterling', 'Thorne', 'Ulric', 'Verity', 'Wynter', 'Yates', 'Zander', 'Ashby', 'Brook', 'Crane', 'Darrow', 'Ellery', 'Fairley', 'Garnet', 'Hale', 'Irving', 'Joss', 'Kirby', 'Lowell', 'Mayne', 'Nash', 'Orrin', 'Pryce', 'Quill'];
let k = 0;
const dir = path.join(__dirname, '..', 'config', 'teams');
const flags = {};
for (const [id, [name, short, p, s, art, flag, pl]] of Object.entries(T)) {
  const players = pl.map((x) => {
    const [n, num] = x.split(':');
    const o = { name: n, number: +num.replace('*', ''), position: 'FW', source_url: W(art), retrieved: D, verified: true };
    if (num.endsWith('*')) o.number_note = 'unnumbered in source (recent call-up / no squad number); number set by us';
    return o;
  });
  const fict = players.map((q) => { const f = { name: `${FIRST[k % FIRST.length]}. ${LAST[k % LAST.length]}`, number: q.number }; k++; return f; });
  const team = { id, name, short, short_name: name, national: true, primary: p, secondary: s, colours_verified: true, strength: 80, players, fictional_players: fict };
  fs.writeFileSync(path.join(dir, id + '.json'), JSON.stringify(team, null, 1) + '\n');
  flags[id] = flag;
}
fs.writeFileSync(path.join(__dirname, '..', 'build', 'flag_files.json'), JSON.stringify(flags, null, 1));
console.log('nations', Object.keys(T).length);
