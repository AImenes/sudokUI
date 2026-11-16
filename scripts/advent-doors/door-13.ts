/** Door 13: the Lucia crown with its candles. */
import { type Felt, n1, sewn } from './felt';

/** the wreath of the crown, seen a little from above: an oval band about (0, CY), wider at the front */
const CY = 92;
const OUT = [134, 58];
const HOLE = [92, 22];
/** the line the candles stand on */
const MID = [113, 39];

function on(deg: number, [rx, ry]: number[], cy = CY): [number, number] {
  const t = (deg * Math.PI) / 180;
  return [n1(rx * Math.cos(t)), n1(cy + ry * Math.sin(t))];
}

/** a leaf on the wreath's outer edge, at an angle of the right half; it leans towards the front */
function leaf(deg: number): string {
  const [x, y] = on(deg, [OUT[0] - 14, OUT[1] - 10]);
  const t = (deg * Math.PI) / 180;
  const outwards = (Math.atan2(Math.sin(t) / OUT[1], Math.cos(t) / OUT[0]) * 180) / Math.PI;
  return `<path d="M0,0C8,-17 30,-19 46,-3C30,12 10,12 0,0Z" transform="translate(${x},${y}) rotate(${n1(outwards + 34)})"/>`;
}

export default function luciaCrown(k: Felt): string {
  // a candle standing on the wreath: its cup, the wax with a run of it, the wick and the flame
  const candle = (deg: number, h: number) => {
    const [x, y] = on(deg, MID, CY + 4);
    const top = y - h;
    return `<g transform="translate(${x},0)">
      <path d="M-16,${y}V${top + 9}Q-16,${top} -8,${top}H8Q16,${top} 16,${top + 9}V${y}Z" fill="${k.snow}"/>
      <path d="M-16,${top + 9}Q-16,${top} -8,${top}H8Q16,${top} 16,${top + 9}V${top + 34}Q16,${top + 42} 10,${top + 42}Q4,${top + 42} 4,${top + 34}V${top + 24}Q4,${top + 18} -3,${top + 18}Q-10,${top + 18} -10,${top + 24}Q-10,${top + 30} -13,${top + 30}Q-16,${top + 30} -16,${top + 24}Z" fill="${k.shade}"/>
      <path d="M-25,${y - 16}H25L19,${y + 7}H-19Z" fill="${k.gold}"/>
      <path d="M0,${top - 1}V${top - 10}" stroke="${k.deep}" stroke-width="5" stroke-linecap="round"/>
      <path d="M0,${top - 70}C11,${top - 50} 22,${top - 40} 22,${top - 27}C22,${top - 15} 12,${top - 8} 0,${top - 8}C-12,${top - 8} -22,${top - 15} -22,${top - 27}C-22,${top - 40} -11,${top - 50} 0,${top - 70}Z" fill="${k.gold}"/>
      <path d="M0,${top - 44}C6,${top - 34} 10,${top - 30} 10,${top - 23}C10,${top - 17} 6,${top - 13} 0,${top - 13}C-6,${top - 13} -10,${top - 17} -10,${top - 23}C-10,${top - 30} -6,${top - 34} 0,${top - 44}Z" fill="${k.snow}"/>
      </g>`;
  };
  const oval = ([rx, ry]: number[], cy: number, sweep: 0 | 1) => `M${-rx},${cy}A${rx},${ry} 0 1 ${sweep} ${rx},${cy}A${rx},${ry} 0 1 ${sweep} ${-rx},${cy}Z`;
  // the band, the knit showing through its middle: the hole is wound the other way
  const band = oval(OUT, CY, 1) + oval(HOLE, CY - 6, 0);
  const leaves = [-24, 2, 28, 54, 79].map(leaf).join('');
  const berries = [90, 33, 147].map((d) => {
    const [x, y] = on(d, [OUT[0] - 22, OUT[1] - 20]);
    return `<circle cx="${n1(x - 10)}" cy="${y + 3}" r="9"/><circle cx="${n1(x + 10)}" cy="${y + 3}" r="9"/><circle cx="${x}" cy="${y - 11}" r="9"/>`;
  });
  return `<g>
    <g fill="${k.snow}">${leaves}<g transform="scale(-1,1)">${leaves}</g></g>
    ${sewn(`${k.id}-w`, band, k.snow, k.thread)}
    ${candle(270, 172)}
    ${candle(197, 172)}${candle(343, 172)}
    ${candle(121, 172)}${candle(59, 172)}
    <g fill="${k.accent}">${berries.join('')}</g>
    </g>`;
}
