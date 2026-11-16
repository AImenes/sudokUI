/** Door 6: a lantern. */
import { type Felt, heart, piece, sewn } from './felt';

export default function lantern(k: Felt): string {
  const roof = 'M-32,-132H32C46,-104 76,-80 128,-68V-54H-128V-68C-76,-80 -46,-104 -32,-132Z';
  const body = 'M-100,-38Q-100,-44 -94,-44H94Q100,-44 100,-38V128H-100Z';
  const base = 'M-120,134Q-120,124 -110,124H110Q120,124 120,134V148Q120,158 110,158H-110Q-120,158 -120,148Z';
  return `<g transform="translate(0,8)">
    <circle cx="0" cy="-174" r="22" fill="none" stroke="${k.gold}" stroke-width="9"/>
    <rect x="-18" y="-154" width="36" height="28" rx="4" fill="${k.goldDeep}"/>
    ${sewn(`${k.id}-b`, body, k.snow, k.thread)}
    <rect x="-108" y="-56" width="216" height="14" fill="${k.shade}"/>
    ${sewn(`${k.id}-r`, roof, k.snow, k.thread)}
    <rect x="-74" y="-22" width="148" height="136" rx="8" fill="${k.gold}"/>
    ${piece('M0,-10C12,10 26,22 26,40C26,56 14,66 0,66C-14,66 -26,56 -26,40C-26,22 -12,10 0,-10Z', k.goldDeep)}
    ${piece('M0,18C6,30 13,36 13,46C13,54 7,60 0,60C-7,60 -13,54 -13,46C-13,36 -6,30 0,18Z', k.snow)}
    <path d="M0,64V76" stroke="${k.deep}" stroke-width="5" stroke-linecap="round"/>
    ${piece('M-20,114V82Q-20,74 -12,74H12Q20,74 20,82V114Z', k.snow)}
    <rect x="-90" y="156" width="180" height="26" rx="7" fill="${k.goldDeep}"/>
    ${sewn(`${k.id}-f`, base, k.gold, k.goldDeep)}
    ${piece(heart(0, 141, 9), k.accent)}
    </g>`;
}
