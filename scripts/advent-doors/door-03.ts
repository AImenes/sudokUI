/** Door 3: a bullfinch on a rowan twig. */
import { type Felt, cord, piece, seam, sewn } from './felt';

export default function bullfinch(k: Felt): string {
  // one piece, facing right: the round head with no neck, the back down to the tail, the full breast
  const body =
    'M116,-134C108,-166 90,-186 62,-186C32,-186 8,-166 -6,-138C-28,-98 -64,-62 -92,-30L-164,58L-140,90L-80,52C-56,84 -20,104 22,104C78,104 122,56 126,-14C128,-46 126,-76 120,-102L142,-118Z';
  const wing = 'M44,-86C62,-50 42,-4 -2,16C-36,32 -76,30 -106,12C-76,-6 -48,-38 -22,-72C-4,-96 30,-106 44,-86Z';
  const berry = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="14" fill="${k.accent}"/>`;
  return `<g transform="translate(4,-2)">
    ${cord('M-164,152C-92,150 -22,138 40,128C92,119 126,106 150,86M84,118L100,140M-76,148L-92,162', k.goldDeep, 11)}
    ${cord('M4,96V132M36,94L40,126', k.goldDeep, 7)}
    ${sewn(`${k.id}-b`, body, k.snow, k.thread)}
    <g clip-path="url(#${k.id}-b)">
      ${piece('M150,-112C110,-116 84,-126 62,-120C36,-112 28,-60 12,-18C-8,28 -40,58 -84,60L-70,130H160Z', k.accent)}
      ${piece('M150,-102C112,-108 86,-124 62,-116C40,-110 18,-128 0,-152L0,-200H150Z', k.goldDeep)}
      ${piece('M-112,-12L-176,62L-140,100L-98,64Z', k.goldDeep)}
    </g>
    ${sewn(`${k.id}-w`, wing, k.gold, k.goldDeep)}
    ${seam('M20,-62C12,-30 -20,-2 -70,8', k.goldDeep)}
    ${piece('M114,-136L146,-118L118,-100Z', k.gold)}
    <circle cx="90" cy="-142" r="5.5" fill="${k.deep}"/>
    ${berry(104, 148)}${berry(80, 162)}${berry(128, 164)}${berry(104, 178)}
    ${berry(-96, 166)}${berry(-120, 178)}${berry(-74, 182)}
    </g>`;
}
