/** Door 16: a parcel with a bow. */
import { type Felt, cord, heart, piece, seam, sewn } from './felt';

export default function parcel(k: Felt): string {
  const lid = 'M-150,-62Q-150,-70 -142,-70H142Q150,-70 150,-62V-12H-150Z';
  // a loop of the bow, the knit showing through it: the hole is wound the other way
  const loop = (s: number) =>
    `M${-4 * s},-92C${-24 * s},-160 ${-124 * s},-216 ${-140 * s},-150C${-150 * s},-96 ${-60 * s},-76 ${-4 * s},-84Z` +
    `M${-50 * s},-108C${-76 * s},-102 ${-110 * s},-112 ${-107 * s},-143C${-102 * s},-168 ${-66 * s},-146 ${-50 * s},-108Z`;
  // a tail of the bow, lying on the lid and falling over its edge, a notch cut in its end
  const tail = (s: number) => `M${-2 * s},-92L${-70 * s},-58L${-64 * s},-2L${-82 * s},-18L${-102 * s},-4L${-104 * s},-62C${-80 * s},-84 ${-40 * s},-100 ${-2 * s},-100Z`;
  return `<g>
    ${sewn(`${k.id}-b`, 'M-136,-20H136V176Q136,184 128,184H-128Q-136,184 -136,176Z', k.snow, k.thread)}
    <path d="M-136,96H136V140H-136Z" fill="${k.gold}"/>
    <path d="M-22,-20H22V184H-22Z" fill="${k.gold}"/>
    ${seam('M-14,-4V184M14,-4V184M-136,104H-22M22,104H136M-136,132H-22M22,132H136', k.goldDeep)}
    <path d="${lid}" transform="translate(0,9)" fill="${k.shade}"/>
    ${piece(lid, k.snow)}
    <path d="M-24,-70H24V-12H-24Z" fill="${k.gold}"/>
    ${cord('M16,-80C52,-40 68,-12 74,18', k.goldDeep, 5)}
    ${piece(heart(76, 46, 28), k.accent)}
    ${piece(tail(1), k.goldDeep)}${piece(tail(-1), k.goldDeep)}
    ${piece(loop(1), k.gold)}${piece(loop(-1), k.gold)}
    <rect x="-22" y="-116" width="44" height="46" rx="13" fill="${k.goldDeep}"/>
    </g>`;
}
