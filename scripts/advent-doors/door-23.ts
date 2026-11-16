/** Door 23: a bowl of Christmas porridge: the eye of butter, cinnamon, a wooden spoon, a little steam. */
import { type Felt, cord, n1, sewn } from './felt';

export default function porridge(k: Felt): string {
  // the wooden bowl, wide and low, seen a little from above: its mouth is an oval, the porridge in it
  const bowl = 'M-160,-10C-158,82 -112,150 -58,152H58C112,150 158,82 160,-10Z';
  const steam = (x: number, top: number) => `M${x},-74C${x - 22},-94 ${x + 22},-110 ${x},-132C${x - 12},-146 ${x - 6},${top + 8} ${x + 6},${top}`;
  // a garland painted round the bowl: scallops hanging from a line that follows its rim
  const rim = (x: number) => 28 + 50 * Math.sqrt(1 - (x / 166) ** 2);
  let garland = '';
  for (let i = 0; i <= 10; i++) {
    const x = -140 + i * 28;
    garland += i ? `Q${x - 14},${n1(rim(x - 14) + 40)} ${x},${n1(rim(x) + 20)}` : `M${x},${n1(rim(x) + 20)}`;
  }
  const cinnamon: [number, number][] = [
    [-118, -12],
    [-96, 14],
    [-36, 22],
    [-4, -32],
    [8, 16],
    [88, 14],
    [108, -10],
    [-76, -36],
    [-28, -34],
    [40, 26]
  ];
  return `<g transform="translate(0,12)">
    ${cord(steam(-84, -186), k.snow, 11)}${cord(steam(-22, -196), k.snow, 11)}
    ${sewn(`${k.id}-b`, bowl, k.gold, k.goldDeep, [-160, 44, 320, 120])}
    <g clip-path="url(#${k.id}-b)" fill="none">
      <path d="M-166,28A166,50 0 0 0 166,28" stroke="${k.accent}" stroke-width="10"/>
      <path d="${garland}" stroke="${k.snow}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <ellipse cx="0" cy="-10" rx="160" ry="50" fill="${k.goldDeep}"/>
    <ellipse cx="0" cy="-6" rx="144" ry="39" fill="${k.snow}"/>
    <ellipse cx="-52" cy="-8" rx="46" ry="21" fill="${k.shade}"/>
    <ellipse cx="-52" cy="-7" rx="34" ry="14" fill="${k.gold}"/>
    <g fill="${k.goldDeep}">${cinnamon.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6.5"/>`).join('')}</g>
    <ellipse cx="52" cy="-10" rx="36" ry="21" transform="rotate(-52 52 -10)" fill="${k.gold}"/>
    <ellipse cx="50" cy="-8" rx="23" ry="11" transform="rotate(-52 50 -8)" fill="${k.goldDeep}"/>
    ${cord('M68,-32L138,-126', k.gold, 16)}
    <rect x="-66" y="146" width="132" height="24" rx="9" fill="${k.goldDeep}"/>
    </g>`;
}
