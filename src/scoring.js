import { CATEGORIES, POINTS } from './config.js';

export const trLower = (s) => (s || '').toLocaleLowerCase('tr-TR');
export const normalize = (s) => trLower(s).trim().replace(/\s+/g, ' ');

export function startsWithLetter(answer, letter) {
  const a = normalize(answer);
  return !a || a.startsWith(trLower(letter));
}

// verdicts[reviewerUid][cat] === false → reviewer, rakibinin o cevabını reddetti.
function effective(round, uid, otherUid, cat) {
  if (round.verdicts?.[otherUid]?.[cat] === false) return '';
  return normalize(round.answers?.[uid]?.[cat]);
}

export function scoreRound(round, [a, b]) {
  const points = { [a]: {}, [b]: {} };
  const totals = { [a]: 0, [b]: 0 };
  for (const { key } of CATEGORIES) {
    const va = effective(round, a, b, key);
    const vb = effective(round, b, a, key);
    let pa, pb;
    if (!va && !vb) pa = pb = POINTS.empty;
    else if (va && !vb) { pa = POINTS.alone; pb = POINTS.empty; }
    else if (!va && vb) { pa = POINTS.empty; pb = POINTS.alone; }
    else if (va === vb) pa = pb = POINTS.same;
    else pa = pb = POINTS.different;
    points[a][key] = pa; points[b][key] = pb;
    totals[a] += pa; totals[b] += pb;
  }
  return { points, totals };
}
