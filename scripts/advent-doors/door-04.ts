/** Door 4: a sheaf of oats for the birds (julenek). */
import { type Felt, n1, piece, seam, sewn } from './felt';

/** the point the straws are tied at */
const TIE: [number, number] = [0, 14];

/** one ear, standing at the angle a (degrees from straight up) from the tie: a stem and seven grains */
function ear(k: Felt, a: number): string {
  const grain = (x: number, y: number, r: number) => `<ellipse cx="${x}" cy="${y}" rx="9.5" ry="18" transform="rotate(${r} ${x} ${y})"/>`;
  let grains = grain(0, -186, 0);
  for (const y of [-162, -138, -114]) grains += grain(-12, y, -24) + grain(12, y, 24);
  return `<g transform="translate(${TIE[0]},${TIE[1]}) rotate(${a})">
    <path d="M0,-90V-180" stroke="${k.gold}" stroke-width="6" stroke-linecap="round"/>
    <g fill="${k.snow}">${grains}</g></g>`;
}

export default function sheaf(k: Felt): string {
  // the cut ends of the straw: a skirt with a ragged hem
  let skirt = 'M-22,10H22L88,140';
  const teeth = 9;
  for (let i = 1; i <= teeth * 2; i++) skirt += `L${n1(88 - (176 * i) / (teeth * 2))},${i % 2 ? 154 : 140}`;
  skirt += 'Z';
  const fan = 'M-22,18L-108,-62Q-62,-126 0,-126Q62,-126 108,-62L22,18Z';
  return `<g transform="translate(0,-2)">
    <rect x="-9" y="130" width="18" height="64" fill="${k.goldDeep}"/>
    ${sewn(`${k.id}-f`, fan, k.gold, k.goldDeep)}
    ${[-51, -34, -17, 0, 17, 34, 51].map((a) => ear(k, a)).join('')}
    ${sewn(`${k.id}-s`, skirt, k.gold, k.goldDeep)}
    ${seam('M0,46V134M-14,46L-44,132M14,46L44,132', k.goldDeep)}
    ${piece('M-36,-2Q0,6 36,-2L38,28Q0,36 -38,28Z', k.accent)}
    ${piece('M8,30L30,26L44,76L28,70L20,82Z', k.accent)}
    ${piece('M-124,196C-112,176 -70,168 0,168C70,168 112,176 124,196Z', k.snow)}
    </g>`;
}
