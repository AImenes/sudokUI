/** Door 20: a log cabin in the snow, smoke from its chimney, a spruce beside it. */
import { type Felt, cord, piece, seam, sewn } from './felt';

export default function cabin(k: Felt): string {
  // the roof from the long side, heavy with snow: a rounded slab, its eave hanging in soft scallops
  const roof =
    'M-124,-48H24C42,-48 52,-40 58,-26L78,22Q86,44 66,46Q48,62 30,46Q10,62 -10,46Q-30,62 -50,46Q-70,62 -90,46Q-110,62 -130,46Q-148,60 -160,44Q-172,36 -166,22L-158,-26C-152,-40 -142,-48 -124,-48Z';
  // the spruce: four tiers, each a second tone under the one above
  const tier = (top: number, bot: number, hw: number) => `M118,${top}L${118 + hw},${bot}Q118,${bot + 14} ${118 - hw},${bot}Z`;
  const tiers: [number, number, number][] = [
    [44, 164, 46],
    [-28, 90, 41],
    [-94, 16, 33],
    [-156, -52, 24]
  ];
  let spruce = '';
  tiers.forEach(([top, bot, hw], i) => {
    if (i > 0) spruce += `<path d="${tier(top, bot, hw)}" transform="translate(0,9)" fill="${k.shade}"/>`;
    spruce += piece(tier(top, bot, hw), k.snow);
  });
  // the ends of the logs, where the walls are notched together
  const ends = [53, 86, 119, 152].map((y) => `<circle cx="-146" cy="${y}" r="13"/><circle cx="44" cy="${y}" r="13"/>`).join('');
  return `<g>
    ${cord('M-60,-100C-88,-120 -34,-138 -60,-162C-74,-176 -62,-196 -42,-190', k.snow, 13)}
    <rect x="-78" y="-90" width="36" height="56" fill="${k.goldDeep}"/>
    ${piece('M-86,-86Q-88,-104 -60,-104Q-32,-104 -34,-86Q-34,-76 -46,-76H-74Q-86,-76 -86,-86Z', k.snow)}
    <g fill="${k.goldDeep}">${ends}</g>
    <rect x="-146" y="30" width="190" height="140" fill="${k.goldDeep}"/>
    ${seam('M-142,69.5H40M-142,102.5H40M-142,135.5H40', k.gold)}
    <rect x="-124" y="72" width="64" height="62" rx="6" fill="${k.snow}"/>
    <rect x="-116" y="80" width="48" height="46" fill="${k.gold}"/>
    <path d="M-92,80v46M-116,103h48" stroke="${k.snow}" stroke-width="6"/>
    <path d="M-24,170V96Q-24,84 -12,84H12Q24,84 24,96V170Z" fill="${k.accent}"/>
    <circle cx="13" cy="130" r="5.5" fill="${k.gold}"/>
    <path d="${roof}" transform="translate(0,9)" fill="${k.shade}"/>
    ${sewn(`${k.id}-r`, roof, k.snow, k.thread)}
    ${spruce}
    ${piece('M-168,197C-164,170 -128,158 -86,164H96C128,158 158,170 164,197Z', k.snow)}
    </g>`;
}
