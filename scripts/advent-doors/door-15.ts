/** Door 15: a snow globe. */
import { type Felt, cord, heart, piece, sewn, star5 } from './felt';

/** the glass: a ring about (0, CY), the knit showing through it */
const CY = -38;

export default function snowGlobe(k: Felt): string {
  // the snow lying in the globe: a drift, its lower edge the glass
  const drift = `M-119,${CY + 62}C-84,${CY + 34} -44,${CY + 40} -4,${CY + 58}C36,${CY + 76} 82,${CY + 44} 119,${CY + 62}A134,134 0 0 1 -119,${CY + 62}Z`;
  // a spruce: three tiers, each a second tone under the one above
  const tier = (top: number, bot: number, hw: number) => `M-40,${top}L${-40 + hw},${bot}Q-40,${bot + 12} ${-40 - hw},${bot}Z`;
  const tiers: [number, number, number][] = [
    [-52, 14, 58],
    [-98, -36, 46],
    [-136, -82, 33]
  ];
  let spruce = `<rect x="-48" y="6" width="16" height="30" fill="${k.goldDeep}"/>`;
  tiers.forEach(([top, bot, hw], i) => {
    if (i > 0) spruce += `<path d="${tier(top, bot, hw)}" transform="translate(0,9)" fill="${k.shade}"/>`;
    spruce += piece(tier(top, bot, hw), k.snow);
  });
  const flakes: [number, number, number][] = [
    [-96, -62, 7],
    [-84, -116, 6],
    [18, -138, 7],
    [8, -78, 6],
    [62, -104, 7],
    [102, -58, 6],
    [44, -44, 6],
    [-18, -22, 6]
  ];
  return `<g>
    <circle cx="0" cy="${CY}" r="141" fill="none" stroke="${k.snow}" stroke-width="14"/>
    ${cord(`M-104,${CY - 44}A113,113 0 0 1 -62,${CY - 94}`, k.shade, 9)}
    ${flakes.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${k.snow}"/>`).join('')}
    <path d="M28,0H96V44H28Z" fill="${k.accent}"/>
    <rect x="52" y="12" width="20" height="22" fill="${k.gold}"/>
    <path d="M14,4L62,-40L110,4Z" fill="${k.snow}"/>
    ${spruce}
    ${piece(star5(-40, -138, 17, 7), k.gold)}
    ${sewn(`${k.id}-s`, drift, k.snow, k.thread)}
    <rect x="-96" y="86" width="192" height="22" rx="9" fill="${k.goldDeep}"/>
    ${sewn(`${k.id}-b`, 'M-106,102H106L124,170Q127,184 112,184H-112Q-127,184 -124,170Z', k.gold, k.goldDeep)}
    <rect x="-134" y="176" width="268" height="18" rx="8" fill="${k.goldDeep}"/>
    ${piece(heart(0, 141, 14), k.accent)}
    </g>`;
}
