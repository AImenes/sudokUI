/** Door 14: a woven paper heart (julekurv). */
import { type Felt, cord, n1, piece, seam } from './felt';

/**
 * The heart is two pieces of paper woven through each other: a square
 * standing on its corner, four strips each way, and a round lobe on each of
 * its two upper sides. D is half the square's diagonal, A its side.
 */
const D = 136;
const A = D * Math.SQRT2;
const R = A / 2;
const H = Math.SQRT1_2;
/** the strips of each piece */
const N = 4;
/** how far down the whole is moved, so that heart and handle sit about the middle */
const DOWN = 43;

/** a point of the square: s along its upper right side from the top corner, t along its upper left side */
function sq(s: number, t: number): string {
  return `${n1(A * H * (s - t))},${n1(-D + A * H * (s + t))}`;
}

export default function wovenHeart(k: Felt): string {
  const whole = `M0,${D}L${-D},0A${n1(R)},${n1(R)} 0 0 1 0,${-D}A${n1(R)},${n1(R)} 0 0 1 ${D},0Z`;
  // the right piece: its lobe, and every other square of the weave
  let right = `M0,${-D}A${n1(R)},${n1(R)} 0 0 1 ${D},0Z`;
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++)
      if ((i + j) % 2) right += `M${sq(i / N, j / N)}L${sq((i + 1) / N, j / N)}L${sq((i + 1) / N, (j + 1) / N)}L${sq(i / N, (j + 1) / N)}Z`;
  // the running stitch, 6 px inside the edge: the left half in the snow's thread, the right in the gold's
  const r = n1(R - 6);
  const e = n1(6 * H);
  const notch = n1(-D + 6 * Math.SQRT2 + 1);
  const tip = n1(D - 6 * Math.SQRT2);
  const left = `M0,${tip}L${n1(-D + e)},${-e}A${r},${r} 0 0 1 0,${notch}`;
  const rightSeam = `M0,${notch}A${r},${r} 0 0 1 ${n1(D - e)},${-e}L0,${tip}`;
  return `<g transform="translate(0,${DOWN})">
    ${cord(`M-50,${-D - 8}C-50,${-D - 108} 50,${-D - 108} 50,${-D - 8}`, k.goldDeep, 15)}
    ${piece(whole, k.snow)}
    ${piece(right, k.gold)}
    ${seam(left, k.thread)}
    ${seam(rightSeam, k.goldDeep)}
    </g>`;
}
