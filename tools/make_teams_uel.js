// One-off generator for the MARBLE CONTINENTAL teams (P3). Squads: UEFA Europa League club pages, retrieved 2026-11-04.
const fs = require('fs');
const path = require('path');
const U = (id) => `https://www.uefa.com/uefaeuropaleague/clubs/${id}/squad/`;
const D = '2026-11-04';
// id: [name, short, short_name, primary, secondary, uefa path, players [name, number], colours verified]
const T = {
  benfica: ['Benfica', 'BEN', 'Benfica', '#E2231A', '#FFFFFF', '50147--benfica', [['V. Pavlidis', 14], ['D. Lukébakio', 11], ['J. Durán', 22]], true],
  leverkusen: ['Bayer Leverkusen', 'B04', 'Leverkusen', '#E32221', '#000000', '50109--leverkusen', [['P. Schick', 14], ['M. Diaby', 19], ['C. Kofane', 35]], true],
  bournemouth: ['Bournemouth', 'BOU', 'Bournemouth', '#B50E12', '#000000', '2601124--bournemouth', [['Evanilson', 9], ['J. Kluivert', 19], ['A. Adli', 21]], true],
  ferencvaros: ['Ferencváros', 'FTC', 'Ferencváros', '#1A7F3C', '#FFFFFF', '52298--ferencvaros', [['F. Kovačević', 19], ['B. Yusuf', 11], ['L. Joseph', 75]], true],
  olympiacos: ['Olympiacos', 'OLY', 'Olympiacos', '#D0021B', '#FFFFFF', '2610--olympiacos', [['R. Yaremchuk', 11], ['L. Bailey', 17], ['G. Martins', 10]], true],
  union_sg: ['Union Saint-Gilloise', 'USG', 'Union SG', '#FFD200', '#0033A0', '64125--union-sg', [['K. Rodriguez', 13], ['M. Biondic', 9], ['R. Florucz', 30]], true],
  juventus: ['Juventus', 'JUV', 'Juventus', '#000000', '#FFFFFF', '50139--juventus', [['K. Yıldız', 10], ['R. Kolo Muani', 9], ['F. Conceição', 7]], true],
  besiktas: ['Beşiktaş', 'BJK', 'Beşiktaş', '#FFFFFF', '#000000', '50157--besiktas', [['D. Vlahović', 28], ['E. Poku', 17], ['S. Kılıçsoy', 90]], true],
  sunderland: ['Sunderland', 'SUN', 'Sunderland', '#EB172B', '#FFFFFF', '53360--sunderland', [['W. Isidor', 18], ['B. Brobbey', 9], ['N. Angulo', 10]], true],
  az: ['AZ Alkmaar', 'AZ', 'AZ', '#DB0021', '#FFFFFF', '52327--az-alkmaar', [['M. Meerdink', 9], ['C. Stengs', 14], ['W. Patati', 7]], true],
  omonia: ['Omonia', 'OMO', 'Omonia', '#00843D', '#FFFFFF', '50077--omonia', [['F. Tănase', 17], ['A. Kakoullis', 9], ['M. Tankovic', 22]], true],
  lyon: ['Lyon', 'OL', 'Lyon', '#FFFFFF', '#14387F', '5312--lyon', [['L. Openda', 17], ['E. Nuamah', 7], ['K. Nakamura', 11]], false],
  rennes: ['Rennes', 'REN', 'Rennes', '#E2001A', '#000000', '55031--rennes', [['E. Lepaul', 9], ['B. Dia', 22], ['M. Al-Taamari', 11]], true],
  real_sociedad: ['Real Sociedad', 'RSO', 'Real Sociedad', '#0067B1', '#FFFFFF', '50123--real-sociedad', [['T. Kubo', 14], ['O. Óskarsson', 9], ['G. Guedes', 11]], true],
  crystal_palace: ['Crystal Palace', 'CRY', 'Crystal Palace', '#1B458F', '#C4122E', '52916--crystal-palace', [['J. Mateta', 14], ['I. Sarr', 7], ['Y. Pino', 10]], true],
  sparta_praha: ['Sparta Prague', 'SPA', 'Sparta Prague', '#A50034', '#FFFFFF', '50033--sparta-praha', [['J. Braut Brunes', 14], ['M. Vojta', 29], ['E. Singhateh', 27]], false],
};
const FIRST = 'ABCDEFGHJKLMNOPRST', LAST = ['Arvel', 'Bostrom', 'Calder', 'Dunmore', 'Esparza', 'Falkner', 'Garrow', 'Hensley', 'Ilves', 'Jarrow', 'Kendric', 'Lorca', 'Mavrin', 'Nolden', 'Orsini', 'Prowse', 'Quarry', 'Rustad', 'Selwyn', 'Torvik', 'Ulloa', 'Vantor', 'Wardell', 'Yarden', 'Zelenko', 'Abernoy', 'Brisco', 'Corland', 'Dravik', 'Elmsley', 'Fontane', 'Gilroy', 'Harlan', 'Isarde', 'Joubel', 'Kastner', 'Leandro', 'Morrow', 'Nevers', 'Ostrander', 'Pradel', 'Rennick', 'Sauvage', 'Tolland', 'Umberto', 'Varga', 'Whitcomb', 'Ysolde'];
let k = 0;
const dir = path.join(__dirname, '..', 'config', 'teams');
for (const [id, [name, short, sn, p, s, uid, pl, ver]] of Object.entries(T)) {
  const players = pl.map(([n, num]) => ({ name: n, number: num, position: 'FW', source_url: U(uid), retrieved: D, verified: true }));
  const fict = pl.map(([, num]) => { const f = { name: `${FIRST[k % FIRST.length]}. ${LAST[k % LAST.length]}`, number: num }; k++; return f; });
  fs.writeFileSync(path.join(dir, id + '.json'), JSON.stringify({ id, name, short, short_name: sn, primary: p, secondary: s, colours_verified: ver, strength: 80, players, fictional_players: fict }, null, 1) + '\n');
}
console.log('teams', Object.keys(T).length);
