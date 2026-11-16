/** Door 22: the paper star lamp hanging in a window, glowing. */
import { type Felt, cord, n1, piece, seam } from './felt';

/** the star's middle, in the middle of the window's glass */
const CY = 2;
const POINTS = 7;

/** a star of POINTS points about (0, CY), one of them straight up: R to the points, r to the folds between them */
function star(R: number, r: number): string {
  const p: string[] = [];
  for (let i = 0; i < 2 * POINTS; i++) {
    const t = ((i * 180) / POINTS - 90) * (Math.PI / 180);
    const q = i % 2 ? r : R;
    p.push(`${n1(q * Math.cos(t))},${n1(CY + q * Math.sin(t))}`);
  }
  return `M${p.join('L')}Z`;
}

export default function paperStar(k: Felt): string {
  // the window: its frame, the knit showing through the glass (the hole is wound the other way)
  const frame = 'M-148,-188Q-148,-196 -140,-196H140Q148,-196 148,-188V176H-148ZM-120,-168V150H120V-168Z';
  // (snow lies in the lower corners of the glass)
  // the folds of the paper: a running stitch from the middle out to every point
  let folds = '';
  for (let i = 0; i < POINTS; i++) {
    const t = ((i * 360) / POINTS - 90) * (Math.PI / 180);
    folds += `M${n1(44 * Math.cos(t))},${n1(CY + 44 * Math.sin(t))}L${n1(104 * Math.cos(t))},${n1(CY + 104 * Math.sin(t))}`;
  }
  return `<g>
    <path d="M0,-170V152M-122,${CY}H122" stroke="${k.shade}" stroke-width="14" fill="none"/>
    ${piece('M-122,152V104C-104,128 -62,146 -6,152ZM122,152V116C100,134 62,148 6,152Z', k.snow)}
    ${piece(frame, k.snow)}
    ${seam('M-134,160V-182H134V160', k.thread)}
    <rect x="-162" y="182" width="324" height="15" rx="6" fill="${k.shade}"/>
    <rect x="-164" y="166" width="328" height="22" rx="7" fill="${k.snow}"/>
    ${cord(`M0,-170V${CY - 100}`, k.goldDeep, 7)}
    <path d="${star(122, 49)}" transform="translate(0,8)" fill="${k.goldDeep}"/>
    ${piece(star(122, 49), k.gold)}
    ${seam(folds, k.goldDeep)}
    ${piece(star(52, 23), k.snow)}
    </g>`;
}
