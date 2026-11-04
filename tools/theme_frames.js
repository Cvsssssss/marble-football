// prints "a,b,c" global frames for quick theme checks: mid-match of match 0, a goal moment, the intro
const s = require(require('path').resolve(process.argv[2]));
const seg = s.segments.find((x) => x.type === 'match' && x.match === 0);
const m = s.matches[0], g = m.events.find((e) => e.type === 'pop' && e.vf > 200);
console.log([seg.start + 420, seg.start + Math.round((g ? g.vf : 300) + 25), s.segments.find((x) => x.type === 'intro').start + 120].join(','));
