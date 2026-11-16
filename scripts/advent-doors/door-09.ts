/** Door 9: a kicksled (spark), seen three-quarter from the front so that its long runners fill the box; runners and uprights heavy enough to hold at chat size. */
import { type Felt, cord, heart, n1, piece, sewn } from './felt';

/**
 * The sled is measured in centimetres: x along the runners from their curl
 * (0) to their tails, y up, z across from the near runner (0) to the far
 * one. One flat projection puts it on the felt: the runners run back to
 * the right and up, the far side sits up and to the left.
 */
const S = 2.05;
const LEN = [0.74, -0.47];
const ACROSS = [-0.84, -0.33];
const AT = [-62, 160];
const WIDE = 50;

function at(x: number, y: number, z: number): [number, number] {
  return [n1(AT[0] + S * (x * LEN[0] + z * ACROSS[0])), n1(AT[1] + S * (x * LEN[1] + z * ACROSS[1] - y))];
}
const p = (x: number, y: number, z: number): string => at(x, y, z).join(',');
const quad = (...c: [number, number, number][]): string => `M${c.map((q) => p(...q)).join('L')}Z`;

export default function kicksled(k: Felt): string {
  // a runner: the long steel on the snow, curling up at the front and back to the seat
  const runner = (z: number) => `M${p(138, 0, z)}L${p(12, 0, z)}C${p(-10, 0, z)} ${p(-12, 30, z)} ${p(18, 36, z)}`;
  const upright = (z: number) => `M${p(60, 0, z)}L${p(60, 106, z)}`;
  const brace = (z: number) => `M${p(92, 0, z)}L${p(60, 46, z)}`;
  // the seat: a plank, its front edge and its near side a second tone
  const top = quad([16, 39, -3], [62, 39, -3], [62, 39, WIDE + 3], [16, 39, WIDE + 3]);
  const front = quad([16, 39, -3], [16, 39, WIDE + 3], [16, 27, WIDE + 3], [16, 27, -3]);
  const side = quad([16, 39, -3], [62, 39, -3], [62, 27, -3], [16, 27, -3]);
  const rug = quad([22, 39, 3], [56, 39, 3], [56, 39, WIDE - 3], [22, 39, WIDE - 3]);
  // the back between the uprights, a heart cut through it
  const back = quad([60, 52, 0], [60, 98, 0], [60, 98, WIDE], [60, 52, WIDE]);
  const [hx, hy] = at(60, 75, WIDE / 2);
  return `<g>
    ${cord(runner(WIDE), k.goldDeep, 17)}
    ${cord(brace(WIDE), k.goldDeep, 11)}
    ${cord(upright(WIDE), k.shade, 21)}
    ${piece(front, k.shade)}${piece(side, k.shade)}
    ${sewn(`${k.id}-seat`, top, k.snow, k.thread)}
    ${piece(rug, k.accent)}
    ${sewn(`${k.id}-back`, back, k.snow, k.thread)}
    <g transform="matrix(1 ${n1(ACROSS[1] / ACROSS[0])} 0 1 ${hx} ${hy})">${piece(heart(0, 0, 18), k.ground)}</g>
    ${cord(brace(0), k.gold, 11)}
    ${cord(upright(0), k.snow, 22)}
    ${cord(`M${p(60, 106, -8)}L${p(60, 106, WIDE + 8)}`, k.snow, 23)}
    ${cord(runner(0), k.gold, 18)}
    </g>`;
}
