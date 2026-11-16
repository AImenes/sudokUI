/** Door 24: the Christmas tree with its star. */
import { type Felt, heart, n1, sewn, star5 } from './felt';

/** one tier of boughs: a point at the top, a scalloped hem of n scallops, hw half its width */
function tier(top: number, bot: number, hw: number, n: number): string {
  const tipY = bot - 10;
  const h = bot - top;
  let d = `M0,${top}C${n1(hw * 0.3)},${n1(top + h * 0.5)} ${n1(hw * 0.62)},${n1(top + h * 0.72)} ${hw},${tipY}`;
  const w = (2 * hw) / n;
  for (let i = 0; i < n; i++) d += `Q${n1(hw - (i + 0.5) * w)},${bot + 14} ${n1(hw - (i + 1) * w)},${tipY}`;
  d += `C${n1(-hw * 0.62)},${n1(top + h * 0.72)} ${n1(-hw * 0.3)},${n1(top + h * 0.5)} 0,${top}Z`;
  return d;
}

export default function tree(k: Felt): string {
  const tiers: [number, number, number, number][] = [
    [22, 152, 126, 6],
    [-48, 70, 104, 5],
    [-108, -6, 80, 4],
    [-150, -76, 54, 3]
  ];
  let out = `<rect x="-17" y="140" width="34" height="50" rx="4" fill="${k.goldDeep}"/>`;
  tiers.forEach(([top, bot, hw, n], i) => {
    const d = tier(top, bot, hw, n);
    if (i > 0) out += `<path d="${d}" transform="translate(0,9)" fill="${k.shade}"/>`;
    // the small top tier is left plain: stitches would crowd it
    out += i < 3 ? sewn(`${k.id}-t${i}`, d, k.snow, k.thread) : `<path d="${d}" fill="${k.snow}"/>`;
  });
  // lights on the tips of the boughs
  for (const [, bot, hw] of tiers) out += `<circle cx="${hw}" cy="${bot - 8}" r="8" fill="${k.gold}"/><circle cx="${-hw}" cy="${bot - 8}" r="8" fill="${k.gold}"/>`;
  // what hangs on it
  const hang: [number, number, 'h' | 'b'][] = [
    [-34, -36, 'h'],
    [34, -36, 'b'],
    [-62, 36, 'b'],
    [0, 40, 'h'],
    [62, 36, 'b'],
    [-84, 116, 'h'],
    [-30, 120, 'b'],
    [30, 120, 'h'],
    [84, 116, 'b']
  ];
  for (const [x, y, kind] of hang) out += kind === 'h' ? `<path d="${heart(x, y, 9)}" fill="${k.accent}"/>` : `<circle cx="${x}" cy="${y}" r="8" fill="${k.goldDeep}"/>`;
  out += `<path d="${star5(0, -165, 43, 17.5)}" fill="${k.gold}"/>`;
  return out;
}
