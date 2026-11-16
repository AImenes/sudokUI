/** Door 5: skis and poles. */
import { type Felt, cord, piece, seam } from './felt';

/** one ski seen from above, its tip up: a wooden ski with a pointed tip */
const SKI = 'M-23,194Q-23,200 -17,200H17Q23,200 23,194V-122C23,-156 12,-184 0,-206C-12,-184 -23,-156 -23,-122Z';
/** how far the skis and the poles lean */
const LEAN = 29;
const POLE = 50;

function ski(k: Felt): string {
  return `${piece(SKI, k.snow)}
    ${seam('M0,186V-108', k.thread)}
    <path d="M-23,-128H23" stroke="${k.accent}" stroke-width="14"/>
    <rect x="-27" y="-72" width="54" height="20" rx="5" fill="${k.goldDeep}"/>`;
}

function pole(k: Felt): string {
  return `${cord('M0,158V-176', k.gold, 11)}
    ${cord('M0,-130V-176', k.goldDeep, 16)}
    <circle cx="0" cy="118" r="25" fill="none" stroke="${k.gold}" stroke-width="8"/>`;
}

export default function skis(k: Felt): string {
  return `<g transform="translate(0,-2)">
    <g transform="rotate(${-POLE})">${pole(k)}</g>
    <g transform="rotate(${POLE})">${pole(k)}</g>
    <clipPath id="${k.id}-u"><path d="${SKI}" transform="rotate(${-LEAN})"/></clipPath>
    <g transform="rotate(${-LEAN})">${ski(k)}</g>
    <g clip-path="url(#${k.id}-u)"><path d="${SKI}" transform="translate(2,3) rotate(${LEAN})" fill="${k.shade}" stroke="${k.shade}" stroke-width="12"/></g>
    <g transform="rotate(${LEAN})">${ski(k)}</g>
    </g>`;
}
