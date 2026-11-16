/** Door 18: a wreath of spruce with a bow and a few berries. */
import { type Felt, around, n1, piece, seam } from './felt';

/** the wreath's middle; the bow hangs under it */
const CY = -34;

/**
 * A ring of boughs about (0, CY): n tufts swept the same way round the
 * outside, m smaller ones round the hole, which is wound the other way so
 * that the knit shows through it. turn: degrees the whole ring is turned.
 */
function ring(out: [number, number], n: number, hole: [number, number], m: number, turn: number): string {
  const at = (r: number, deg: number): string => {
    const t = ((deg + turn) * Math.PI) / 180;
    return `${n1(r * Math.cos(t))},${n1(CY + r * Math.sin(t))}`;
  };
  // a bough's tip: out along a soft curve to its point, and back in under it to the next one's root
  let d = `M${at(out[0], 0)}`;
  for (let i = 0; i < n; i++) {
    const a = (i * 360) / n;
    const s = 360 / n;
    d += `Q${at(out[1] - 2, a + s * 0.3)} ${at(out[1], a + s * 0.92)}Q${at(out[0] + 5, a + s * 0.8)} ${at(out[0], a + s)}`;
  }
  d += `ZM${at(hole[0], 0)}`;
  for (let i = 0; i < m; i++) {
    const a = (-i * 360) / m;
    const s = 360 / m;
    d += `Q${at(hole[1] + 2, a - s * 0.3)} ${at(hole[1], a - s * 0.92)}Q${at(hole[0] - 4, a - s * 0.8)} ${at(hole[0], a - s)}`;
  }
  return d + 'Z';
}

/** one tail of the bow: a band from the knot to its end, widening, a notch cut in the end */
function tail(x0: number, y0: number, x1: number, y1: number, w0: number, w1: number, notch: number): string {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const [ux, uy] = [(x1 - x0) / len, (y1 - y0) / len];
  const [nx, ny] = [-uy, ux];
  const q = (x: number, y: number) => `${n1(x)},${n1(y)}`;
  return `M${q(x0 + nx * w0, y0 + ny * w0)}L${q(x1 + nx * w1, y1 + ny * w1)}L${q(x1 - ux * notch, y1 - uy * notch)}L${q(x1 - nx * w1, y1 - ny * w1)}L${q(x0 - nx * w0, y0 - ny * w0)}Z`;
}

export default function wreath(k: Felt): string {
  const KY = 112;
  // a loop of the bow, the wreath showing through it: the hole is wound the other way
  const loop = (s: number) =>
    `M${-6 * s},${KY - 2}C${-34 * s},${KY - 60} ${-118 * s},${KY - 80} ${-126 * s},${KY - 34}C${-132 * s},${KY + 14} ${-50 * s},${KY + 22} ${-6 * s},${KY + 2}Z` +
    `M${-46 * s},${KY - 10}C${-64 * s},${KY - 5} ${-100 * s},${KY - 5} ${-99 * s},${KY - 29}C${-98 * s},${KY - 48} ${-60 * s},${KY - 37} ${-46 * s},${KY - 10}Z`;
  // berries: three small bunches, each a hole cut through the felt so that the knit shows
  const berries = around(0, CY, 108, [-128, -38, 12])
    .map(([x, y]) => `<circle cx="${n1(x - 10)}" cy="${n1(y + 6)}" r="11"/><circle cx="${n1(x + 10)}" cy="${n1(y + 6)}" r="11"/><circle cx="${x}" cy="${n1(y - 11)}" r="11"/>`)
    .join('');
  return `<g transform="translate(0,-5)">
    ${piece(ring([124, 156], 14, [90, 68], 9, 13), k.shade)}
    ${piece(ring([122, 154], 14, [92, 70], 9, 0), k.snow)}
    ${seam(`M-108,${CY}A108,108 0 1 1 108,${CY}A108,108 0 1 1 -108,${CY}`, k.thread)}
    <g fill="${k.ground}">${berries}</g>
    ${piece(tail(-8, KY + 2, -80, KY + 74, 14, 22, 20), k.goldDeep)}
    ${piece(tail(8, KY + 2, 80, KY + 74, 14, 22, 20), k.goldDeep)}
    ${piece(loop(1), k.gold)}${piece(loop(-1), k.gold)}
    <rect x="-20" y="${KY - 24}" width="40" height="46" rx="13" fill="${k.goldDeep}"/>
    </g>`;
}
