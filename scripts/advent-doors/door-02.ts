/** Door 2: a pair of Selbu mittens. */
import { type Felt, piece, roseCut, sewn } from './felt';

/** one mitten, fingers up, its thumb to the right: the pointed tip of Selbu, the hand and the thumb in one piece */
const HAND = 'M-50,100V-76C-50,-128 -30,-166 0,-196C30,-166 50,-128 50,-76V4C58,-14 68,-32 84,-46C98,-28 99,2 89,26C80,45 66,60 50,68V100Z';
const CUFF = 'M-56,96Q-56,88 -48,88H48Q56,88 56,96V152Q56,160 48,160H-48Q-56,160 -56,152Z';

const diamond = (cx: number, cy: number, r: number): string => `M${cx},${cy - r}L${cx + r},${cy}L${cx},${cy + r}L${cx - r},${cy}Z`;

function mitten(k: Felt, id: string): string {
  return `${sewn(`${id}h`, HAND, k.snow, k.thread)}
    ${piece(roseCut(0, -52, 18) + diamond(-26, 40, 10) + diamond(0, 40, 10) + diamond(26, 40, 10) + diamond(0, -136, 10), k.ground)}
    ${sewn(`${id}c`, CUFF, k.gold, k.goldDeep)}
    <path d="M-56,124H56" stroke="${k.accent}" stroke-width="12"/>`;
}

export default function mittens(k: Felt): string {
  // the pair laid out, thumbs outwards, the cuffs meeting: the left one is the right one turned over
  return `<g transform="translate(-2,18)">
    <g transform="translate(-66,0) rotate(-4.5) scale(-1,1)">${mitten(k, `${k.id}-l`)}</g>
    <g transform="translate(66,0) rotate(4.5)">${mitten(k, `${k.id}-r`)}</g>
    </g>`;
}
