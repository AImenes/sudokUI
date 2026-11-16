/** Door 11: a cup of cocoa. */
import { type Felt, cord, piece, roseCut, sewn } from './felt';

export default function cocoa(k: Felt): string {
  // the mug, seen a little from above: its mouth is an oval, the cocoa in it, cream on the cocoa
  const mug = 'M-108,-44V98C-108,128 -88,148 -56,148H56C88,148 108,128 108,98V-44Z';
  const cream = 'M-62,-40C-74,-62 -52,-80 -36,-74C-40,-98 -8,-110 4,-92C10,-112 44,-104 40,-80C58,-84 72,-62 62,-40C40,-28 -40,-28 -62,-40Z';
  const steam = (x: number, top: number) => `M${x},-118C${x - 22},-138 ${x + 22},-152 ${x},-172C${x - 12},-184 ${x - 6},${top + 8} ${x + 6},${top}`;
  return `<g transform="translate(-16,0)">
    ${cord(steam(-50, -190), k.snow, 11)}${cord(steam(4, -198), k.snow, 11)}${cord(steam(58, -190), k.snow, 11)}
    ${cord('M104,-4C180,-12 182,98 100,90', k.snow, 23)}
    ${sewn(`${k.id}-m`, mug, k.snow, k.thread, [-108, -10, 216, 160])}
    <ellipse cx="0" cy="-44" rx="108" ry="28" fill="${k.shade}"/>
    <ellipse cx="0" cy="-41" rx="93" ry="20" fill="${k.goldDeep}"/>
    ${piece(cream, k.snow)}
    ${piece(roseCut(0, 56, 18), k.accent)}
    ${sewn(`${k.id}-s`, 'M-146,144H146C146,168 102,183 0,183C-102,183 -146,168 -146,144Z', k.gold, k.goldDeep)}
    <rect x="-56" y="179" width="112" height="16" rx="7" fill="${k.goldDeep}"/>
    </g>`;
}
