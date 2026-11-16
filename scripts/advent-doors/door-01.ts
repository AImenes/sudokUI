/** Door 1: a candle in its holder. */
import { type Felt, around, heart, seam, sewn } from './felt';

export default function candle(k: Felt): string {
  const inner = around(0, -124, 62, [-180, -157.5, -135, -112.5, -90, -67.5, -45, -22.5, 0]);
  const outer = around(0, -124, 84, [-180, -157.5, -135, -112.5, -90, -67.5, -45, -22.5, 0]);
  const rays = inner.map(([x, y], i) => `M${x},${y}L${outer[i][0]},${outer[i][1]}`).join('');
  // the holder's ring makes it wider to the right: the whole sits a little to the left
  return `<g transform="translate(-13,0)">
    <path d="${rays}" stroke="${k.gold}" stroke-width="7" stroke-linecap="round" fill="none"/>
    <path d="M0,-198C18,-168 38,-146 38,-120C38,-96 20,-80 0,-80C-20,-80 -38,-96 -38,-120C-38,-146 -18,-168 0,-198Z" fill="${k.gold}"/>
    <path d="M0,-154C9,-136 18,-126 18,-110C18,-98 10,-90 0,-90C-10,-90 -18,-98 -18,-110C-18,-126 -9,-136 0,-154Z" fill="${k.snow}"/>
    <path d="M0,-82V-62" stroke="${k.deep}" stroke-width="6" stroke-linecap="round"/>
    <path d="M-46,120V-52Q-46,-66 -32,-66H32Q46,-66 46,-52V120Z" fill="${k.snow}"/>
    <path d="M-46,62H46M-46,86H46" stroke="${k.accent}" stroke-width="10"/>
    ${seam('M-38,104V-30M38,104V-30', k.thread)}
    <path d="M-46,-52Q-46,-66 -32,-66H32Q46,-66 46,-52V-20Q46,-8 36,-8Q26,-8 26,-20V-32Q26,-40 17,-40Q8,-40 8,-32V8Q8,20 -3,20Q-14,20 -14,8V-28Q-14,-38 -22,-38Q-30,-38 -30,-28V-22Q-30,-14 -38,-14Q-46,-14 -46,-22Z" fill="${k.shade}"/>
    <rect x="-58" y="106" width="116" height="30" rx="8" fill="${k.gold}"/>
    <path d="${heart(0, 120, 8)}" fill="${k.accent}"/>
    ${sewn(`${k.id}-d`, 'M-114,132H114C114,158 80,173 0,173C-80,173 -114,158 -114,132Z', k.gold, k.goldDeep)}
    <rect x="-50" y="169" width="100" height="18" rx="7" fill="${k.goldDeep}"/>
    <circle cx="127" cy="143" r="17" fill="none" stroke="${k.gold}" stroke-width="9"/>
    </g>`;
}
