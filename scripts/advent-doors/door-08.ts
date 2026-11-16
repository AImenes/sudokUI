/** Door 8: a snowman. */
import { type Felt, cord, piece, sewn } from './felt';

const ball = (cx: number, cy: number, r: number): string => `M${cx - r},${cy}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0Z`;

export default function snowman(k: Felt): string {
  const coal = (x: number, y: number, r: number) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${k.deep}"/>`;
  return `<g transform="translate(0,3)">
    ${cord('M-52,-36L-150,-92M-116,-73L-128,-104M-128,-80L-158,-70', k.goldDeep, 9)}
    ${cord('M52,-36L148,-96M112,-74L120,-106M126,-83L155,-76', k.goldDeep, 9)}
    ${sewn(`${k.id}-a`, ball(0, 102, 90), k.snow, k.thread)}
    <g clip-path="url(#${k.id}-a)">${piece(ball(0, -15, 66), k.shade)}</g>
    ${sewn(`${k.id}-b`, ball(0, -24, 66), k.snow, k.thread)}
    <g clip-path="url(#${k.id}-b)">${piece(ball(0, -105, 48), k.shade)}</g>
    ${piece(ball(0, -114, 48), k.snow)}
    ${piece('M-48,-84C-20,-70 20,-70 48,-84L52,-62C22,-48 -22,-48 -52,-62Z', k.accent)}
    ${piece('M20,-58L46,-64L60,-4L48,-10L38,2Z', k.accent)}
    ${piece('M-48,-138C-48,-172 -26,-188 0,-188C26,-188 48,-172 48,-138Z', k.gold)}
    <rect x="-55" y="-150" width="110" height="20" rx="9" fill="${k.goldDeep}"/>
    <circle cx="0" cy="-188" r="12" fill="${k.snow}"/>
    ${coal(-17, -116, 6)}${coal(17, -116, 6)}
    ${piece('M-3,-106L44,-95L-3,-88Z', k.goldDeep)}
    ${coal(0, -30, 6.5)}${coal(0, -4, 6.5)}${coal(0, 60, 6.5)}${coal(0, 96, 6.5)}
    </g>`;
}
