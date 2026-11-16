/** Door 19: a glass bauble with its cap and hook, a knitted band round it. */
import { type Felt, cord, n1, sewn } from './felt';

/** the ball: a circle about (0, CY) */
const CY = 44;
const R = 148;

export default function bauble(k: Felt): string {
  const ball = `M${-R},${CY}A${R},${R} 0 1 1 ${R},${CY}A${R},${R} 0 1 1 ${-R},${CY}Z`;
  // a line round the ball at height y, sagging in the middle as a line round a ball does when seen a little from above
  const round = (y: number) => `M-160,${y}Q0,${y + 44} 160,${y}`;
  const sag = (x: number) => 22 * (1 - (x / 160) ** 2);
  // the band's pattern: a zigzag, as on a mitten's cuff
  const [top, bot] = [CY - 50, CY + 22];
  let zig = '';
  for (let i = 0; i <= 12; i++) {
    const x = -156 + i * 26;
    zig += `${i ? 'L' : 'M'}${x},${n1((top + bot) / 2 + sag(x) + (i % 2 ? -17 : 17))}`;
  }
  const dots = [-104, -52, 0, 52, 104].map((x) => `<circle cx="${x}" cy="${n1(bot + 30 + sag(x))}" r="9"/>`).join('');
  return `<g transform="translate(0,2)">
    ${cord('M0,-140V-172C0,-204 40,-204 40,-176', k.goldDeep, 8)}
    <circle cx="0" cy="-136" r="13" fill="none" stroke="${k.gold}" stroke-width="8"/>
    ${sewn(`${k.id}-b`, ball, k.snow, k.thread)}
    <g clip-path="url(#${k.id}-b)">
      <path d="${round(top)}V${bot}Q0,${bot + 44} -160,${bot}Z" fill="${k.gold}"/>
      <path d="${round(top)}${round(bot)}" stroke="${k.accent}" stroke-width="10" fill="none"/>
      <path d="${zig}" stroke="${k.snow}" stroke-width="10" stroke-linejoin="round" fill="none"/>
      <g fill="${k.gold}">${dots}</g>
    </g>
    ${cord(`M-104,${CY - 62}A122,122 0 0 1 -50,${CY - 110}`, k.shade, 10)}
    <path d="M-36,-126H36V-98Q27,-88 18,-98Q9,-88 0,-98Q-9,-88 -18,-98Q-27,-88 -36,-98Z" fill="${k.gold}"/>
    <rect x="-36" y="-130" width="72" height="12" rx="5" fill="${k.goldDeep}"/>
    </g>`;
}
