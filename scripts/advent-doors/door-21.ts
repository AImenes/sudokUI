/** Door 21: a snow crystal: six arms, each with two pairs of side branches, cut like paper. */
import { type Felt, n1, piece, seam } from './felt';

/** a pointed blade from (0, -from) out to (0, -to), w half its width, drawn pointing up */
const blade = (from: number, to: number, w: number, point: number): string => `M${-w},${-from}V${-(to - point)}L0,${-to}L${w},${-(to - point)}V${-from}Z`;

/** a regular hexagon about the middle, a corner on every arm */
function hexagon(r: number): string {
  const p: string[] = [];
  for (let i = 0; i < 6; i++) {
    const t = ((i * 60 - 90) * Math.PI) / 180;
    p.push(`${n1(r * Math.cos(t))},${n1(r * Math.sin(t))}`);
  }
  return `M${p.join('L')}Z`;
}

export default function snowCrystal(k: Felt): string {
  // a side branch: a shorter blade that leaves the arm at r, leaning outwards
  const branch = (r: number, len: number, w: number, side: 1 | -1) => `<path d="${blade(-6, len, w, w * 1.6)}" transform="translate(0,${-r}) rotate(${side * 56})"/>`;
  const arm = `<path d="${blade(0, 182, 15, 34)}"/>${branch(84, 68, 12, 1)}${branch(84, 68, 12, -1)}${branch(130, 46, 10.5, 1)}${branch(130, 46, 10.5, -1)}`;
  const turns = [0, 60, 120, 180, 240, 300];
  return `<g>
    <g fill="${k.snow}">${turns.map((a) => `<g transform="rotate(${a})">${arm}</g>`).join('')}</g>
    ${piece(hexagon(52), k.snow)}
    ${turns.map((a) => `<g transform="rotate(${a})">${seam('M0,-56V-150', k.thread)}</g>`).join('')}
    <g fill="${k.gold}">${turns.map((a) => `<path d="M0,-26L14,-54L0,-84L-14,-54Z" transform="rotate(${a + 30})"/>`).join('')}</g>
    ${piece(hexagon(31), k.gold)}
    <circle cx="0" cy="0" r="11" fill="${k.accent}"/>
    </g>`;
}
