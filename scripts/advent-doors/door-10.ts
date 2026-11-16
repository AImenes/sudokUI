/** Door 10: a bell with a bow. */
import { type Felt, cord, heart, n1, piece, sewn } from './felt';

/** one tail of the bow: a band from the knot to its end, widening, a notch cut in the end */
function tail(x0: number, y0: number, x1: number, y1: number, w0: number, w1: number, notch: number): string {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const [ux, uy] = [(x1 - x0) / len, (y1 - y0) / len];
  const [nx, ny] = [-uy, ux];
  const q = (x: number, y: number) => `${n1(x)},${n1(y)}`;
  return `M${q(x0 + nx * w0, y0 + ny * w0)}L${q(x1 + nx * w1, y1 + ny * w1)}L${q(x1 - ux * notch, y1 - uy * notch)}L${q(x1 - nx * w1, y1 - ny * w1)}L${q(x0 - nx * w0, y0 - ny * w0)}Z`;
}

export default function bell(k: Felt): string {
  // the bell: a round crown, straight shoulders, the mouth flaring to a lip
  const body =
    'M0,-98C40,-98 64,-72 68,-30C72,18 80,60 104,88C118,104 138,110 149,121Q157,133 144,140C82,152 -80,151 -144,140Q-157,133 -149,121C-138,110 -118,104 -104,88C-80,60 -72,18 -68,-30C-64,-72 -40,-98 0,-98Z';
  // a loop of the bow, the knit showing through it: the hole is wound the other way
  const loop = (s: number) =>
    `M${-6 * s},-128C${-34 * s},-186 ${-118 * s},-206 ${-126 * s},-160C${-132 * s},-112 ${-50 * s},-104 ${-6 * s},-124Z` +
    `M${-46 * s},-136C${-64 * s},-131 ${-100 * s},-131 ${-99 * s},-155C${-98 * s},-174 ${-60 * s},-163 ${-46 * s},-136Z`;
  return `<g>
    ${cord('M-15,-136C-17,-196 17,-196 15,-136', k.gold, 9)}
    <circle cx="0" cy="166" r="26" fill="${k.gold}"/>
    <path d="${body}" transform="translate(0,10)" fill="${k.goldDeep}"/>
    ${sewn(`${k.id}-b`, body, k.gold, k.goldDeep)}
    ${piece(heart(0, -4, 27), k.ground)}
    <path d="M-87,56Q0,80 87,56M-104,84Q0,112 104,84" stroke="${k.accent}" stroke-width="10" fill="none"/>
    ${piece(tail(-8, -122, -118, -40, 15, 22, 20), k.shade)}
    ${piece(tail(8, -122, 118, -40, 15, 22, 20), k.shade)}
    ${piece(loop(1), k.snow)}
    ${piece(loop(-1), k.snow)}
    <rect x="-19" y="-148" width="38" height="44" rx="12" fill="${k.accent}"/>
    </g>`;
}
