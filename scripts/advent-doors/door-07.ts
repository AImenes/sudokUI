/** Door 7: a gingerbread house. */
import { type Felt, cord, heart, n1, piece, sewn } from './felt';

/** the roof seen from the gable: two slabs of icing meeting at the ridge, their lower edge in scallops */
function roof(): string {
  const n = 4;
  const [ex, ey] = [138, 28]; // where the underside starts, at the eave
  const [px, py] = [0, -136]; // where it ends, under the ridge
  const [sx, sy] = [(px - ex) / n, (py - ey) / n];
  let right = '';
  let left = '';
  for (let i = 0; i < n; i++) {
    // right slab: from the eave up to the ridge; left slab: from the ridge down to the eave
    const [mx, my] = [ex + sx * (i + 0.5) - 11, ey + sy * (i + 0.5) + 9];
    right += `Q${n1(mx)},${n1(my)} ${n1(ex + sx * (i + 1))},${n1(ey + sy * (i + 1))}`;
    const j = n - 1 - i;
    const [lx, ly] = [-(ex + sx * (j + 0.5) - 11), ey + sy * (j + 0.5) + 9];
    left += `Q${n1(lx)},${n1(ly)} ${n1(-(ex + sx * j))},${n1(ey + sy * j)}`;
  }
  return `M0,-196L156,-8Q166,6 152,16L${ex},${ey}${right}${left}L-152,16Q-166,6 -156,-8Z`;
}

export default function gingerbreadHouse(k: Felt): string {
  const wall = 'M-112,178V-8L0,-146L112,-8V178Z';
  const r = roof();
  const pane = (x: number) =>
    `<rect x="${x - 22}" y="86" width="44" height="46" rx="7" fill="${k.snow}"/><path d="M${x},86v46M${x - 22},109h44" stroke="${k.goldDeep}" stroke-width="6"/>`;
  return `<g transform="translate(0,0)">
    <rect x="64" y="-168" width="40" height="90" fill="${k.goldDeep}"/>
    ${piece('M56,-166Q54,-186 84,-186Q114,-186 112,-166Q112,-156 100,-156H68Q56,-156 56,-166Z', k.snow)}
    ${sewn(`${k.id}-w`, wall, k.gold, k.goldDeep)}
    ${cord('M-84,10q10.5,-13 21,0t21,0 21,0 21,0 21,0 21,0 21,0 21,0', k.snow, 7)}
    ${piece(heart(0, -66, 24), k.accent)}
    ${piece('M-30,178V98C-30,74 -16,60 0,60C16,60 30,74 30,98V178Z', k.goldDeep)}
    ${cord('M-30,174V98C-30,74 -16,60 0,60C16,60 30,74 30,98V174', k.snow, 7)}
    <circle cx="14" cy="124" r="6" fill="${k.snow}"/>
    ${pane(-72)}${pane(72)}
    <path d="${r}" transform="translate(0,9)" fill="${k.goldDeep}"/>
    ${sewn(`${k.id}-r`, r, k.snow, k.thread)}
    ${piece('M-162,196C-152,172 -122,166 -92,172H92C122,166 150,172 160,196Z', k.snow)}
    </g>`;
}
