import { Grid, UNITS, bit, sees, cellName } from '../board';
import { Step, CellDigit, ChainLink, ColourCluster } from '../steps';
import { tr, unitName } from '../text';
import { spanningTies, tieLinks, weakTie, nearest, firstParity, shades } from './colourTree';

// A colouring says its parity (docs/hint-drawing-colouring.md): each
// cluster's two colours are two shades of one hue, purple for the cluster
// every hint has and orange for Multi Colors' second, and dark is the
// colour the argument tries first. A sentence names each shade whole,
// never as a hole, so every language can write it its own way.

interface Cluster {
  cells: number[];
  /** the colour the search gave each cell, 0 or 1: which is dark is the step's to say */
  color: Map<number, number>;
  /** its conjugate pairs, the strong relations its ties are drawn from */
  pairs: [number, number][];
}

/** Conjugate-pair clusters for a digit, 2-colored. */
function clusters(g: Grid, d: number): Cluster[] {
  const mask = bit(d);
  const adj = new Map<number, Set<number>>();
  const pairs: [number, number][] = [];
  for (const unit of UNITS) {
    const uc = unit.filter((c) => g.values[c] === 0 && g.cands[c] & mask);
    if (uc.length === 2) {
      if (!adj.has(uc[0])) adj.set(uc[0], new Set());
      if (!adj.has(uc[1])) adj.set(uc[1], new Set());
      adj.get(uc[0])!.add(uc[1]);
      adj.get(uc[1])!.add(uc[0]);
      pairs.push([uc[0], uc[1]]);
    }
  }
  const out: Cluster[] = [];
  const visited = new Set<number>();
  for (const start of adj.keys()) {
    if (visited.has(start)) continue;
    const color = new Map<number, number>();
    const queue = [start];
    color.set(start, 0);
    visited.add(start);
    const cells: number[] = [];
    while (queue.length) {
      const cur = queue.shift()!;
      cells.push(cur);
      for (const next of adj.get(cur)!) {
        if (!color.has(next)) {
          color.set(next, 1 - color.get(cur)!);
          visited.add(next);
          queue.push(next);
        }
      }
    }
    if (cells.length >= 3) out.push({ cells, color, pairs: pairs.filter(([a]) => color.has(a)) });
  }
  return out;
}

/** the candidate of digit d in a cell */
const at = (d: number) => (cell: number): CellDigit => ({ cell, digit: d });

/** a cluster's two shades, dark the colour given */
const shadesOf = (cl: Cluster, d: number, dark: number): ColourCluster => shades(cl.cells.map(at(d)), (x) => cl.color.get(x.cell)!, dark);

/** a cluster's ties along its shortest drawn tree, the first with its frame's sentence */
function clusterTies(cl: Cluster, d: number, marks: CellDigit[], text: string): ChainLink[] {
  const relations = cl.pairs.map(([a, b]): [CellDigit, CellDigit] => [at(d)(a), at(d)(b)]);
  return tieLinks(spanningTies(cl.cells.map(at(d)), relations, marks), text);
}

/** the removals after the first, which the walk draws only at its conclusion */
function more(n: number, d: number): string {
  if (n <= 0) return '';
  return n === 1 ? tr`; 1 more ${d} falls the same way` : tr`; ${n} more ${d}s fall the same way`;
}

function simpleColorsStep(
  cl: Cluster,
  d: number,
  rule: 'trap' | 'wrap',
  dark: number,
  eliminations: CellDigit[],
  reason: string,
  argument: ChainLink[]
): Step {
  const cluster = shadesOf(cl, d, dark);
  const marks = [...cluster.dark, ...cluster.light, ...eliminations];
  return {
    tech: 'SIMPLE_COLORS',
    placements: [],
    eliminations,
    links: [
      ...clusterTies(
        cl,
        d,
        marks,
        tr`Each line joins the only two ${d}s of a house: exactly one of them is true, so they take opposite shades. Either every dark purple ${d} is true, or every light purple one is.`
      ),
      ...argument
    ],
    truth: 'parity',
    colouring: { rule, clusters: [cluster], ...(rule === 'wrap' ? { darkFalse: 0 as const } : {}) },
    description: tr`Simple Colors on ${d}: where a row, column or box has only two ${d}s, they take opposite shades of purple, so either every dark purple ${d} is true or every light purple one is. ${reason}.`
  };
}

/** Simple Colors: color wrap (same color twice in a unit) and color trap
 *  (uncolored cell sees both colors). */
export function findSimpleColors(g: Grid): Step | null {
  for (let d = 1; d <= 9; d++) {
    const mask = bit(d);
    for (const cl of clusters(g, d)) {
      // color wrap: the colour twice in a house is dark, and false
      for (let u = 0; u < 27; u++) {
        const colored = UNITS[u].filter((c) => cl.color.has(c));
        for (const col of [0, 1]) {
          const same = colored.filter((c) => cl.color.get(c) === col);
          if (same.length >= 2) {
            const elims: CellDigit[] = cl.cells.filter((c) => cl.color.get(c) === col).map(at(d));
            const unit = unitName(u);
            const a = cellName(same[0]);
            const b = cellName(same[1]);
            return simpleColorsStep(
              cl,
              d,
              'wrap',
              col,
              elims,
              tr`Dark purple puts ${d} twice in ${unit} (${a} and ${b}), so dark purple is false: every dark purple ${d} is removed, and every light purple ${d} is true`,
              [
                weakTie(
                  [at(d)(same[0])],
                  [at(d)(same[1])],
                  tr`Dark purple puts ${d} in both ${a} and ${b} of ${unit} (the dashed line). A digit appears once per house, so dark purple cannot be true.`
                )
              ]
            );
          }
        }
      }
      // color trap: dark is the colour of the cluster's first candidate,
      // and the first removal's witnesses are the nearest of each shade
      const dark = firstParity(cl.cells.map(at(d)), (x) => cl.color.get(x.cell)!);
      const elims: CellDigit[] = [];
      let first: { c: number; x: number; y: number } | null = null;
      for (let c = 0; c < 81; c++) {
        if (g.values[c] !== 0 || cl.color.has(c) || !(g.cands[c] & mask)) continue;
        const seen: number[][] = [[], []];
        for (const cc of cl.cells) if (sees(c, cc)) seen[cl.color.get(cc)!].push(cc);
        if (seen[0].length && seen[1].length) {
          elims.push({ cell: c, digit: d });
          first ??= { c, x: nearest(at(d)(c), seen[dark].map(at(d))).cell, y: nearest(at(d)(c), seen[1 - dark].map(at(d))).cell };
        }
      }
      if (first) {
        const tail = more(elims.length - 1, d);
        const target = cellName(first.c);
        const x = cellName(first.x);
        const y = cellName(first.y);
        return simpleColorsStep(
          cl,
          d,
          'trap',
          dark,
          elims,
          tr`The ${d} in ${target} sees a dark purple ${d} in ${x} and a light purple ${d} in ${y}, so it is false either way` + tail,
          [
            weakTie([at(d)(first.x)], [at(d)(first.c)], tr`If dark purple is true, the ${d} in ${x} is true, and the ${d} in ${target} goes.`),
            weakTie(
              [at(d)(first.y)],
              [at(d)(first.c)],
              tr`If light purple is true, the ${d} in ${y} is true, and the ${d} in ${target} goes. Either way it is false` + tail + '.'
            )
          ]
        );
      }
    }
  }
  return null;
}

/**
 * A Multi Colors step: the cluster the bridge reaches in purple (cluster
 * 0), the cluster it leaves in orange (cluster 1), each with its ties, then
 * the argument
 */
function multiColorsStep(
  d: number,
  reached: Cluster,
  left: Cluster,
  purple: ColourCluster,
  orange: ColourCluster,
  eliminations: CellDigit[],
  argument: ChainLink[],
  description: string,
  proven: boolean
): Step {
  const marks = [...purple.dark, ...purple.light, ...orange.dark, ...orange.light, ...eliminations];
  return {
    tech: 'MULTI_COLORS',
    placements: [],
    eliminations,
    links: [
      ...clusterTies(
        reached,
        d,
        marks,
        tr`Each line joins the only two ${d}s of a house: exactly one of them is true, so they take opposite shades. Either every dark purple ${d} is true, or every light purple one is.`
      ),
      ...clusterTies(left, d, marks, tr`Another cluster of ${d}s, shaded the same way in orange: either every dark orange ${d} is true, or every light orange one is.`),
      ...argument
    ],
    truth: 'parity',
    colouring: { rule: proven ? 'seesBoth' : 'bridge', clusters: [purple, orange], ...(proven ? { darkFalse: 1 as const } : {}) },
    description
  };
}

/** Multi Colors: interactions between two clusters of the same digit. */
export function findMultiColors(g: Grid): Step | null {
  for (let d = 1; d <= 9; d++) {
    const mask = bit(d);
    const cls = clusters(g, d);
    for (let i = 0; i < cls.length; i++) {
      for (let j = 0; j < cls.length; j++) {
        if (i === j) continue;
        const c1 = cls[i];
        const c2 = cls[j];
        for (const colA of [0, 1]) {
          const aCells = c1.cells.filter((c) => c1.color.get(c) === colA);
          for (const colB of [0, 1]) {
            const bCells = c2.cells.filter((c) => c2.color.get(c) === colB);
            // the weak bridge: one cell of colour A sees one of colour B
            let bridgeA = -1;
            let bridgeB = -1;
            for (const a of aCells) {
              for (const b of bCells) {
                if (sees(a, b)) {
                  bridgeA = a;
                  bridgeB = b;
                  break;
                }
              }
              if (bridgeA >= 0) break;
            }
            if (bridgeA < 0) continue;
            const aOther = c1.cells.filter((c) => c1.color.get(c) === 1 - colA);
            const bOther = c2.cells.filter((c) => c2.color.get(c) === 1 - colB);
            // the bridge's ends are dark: B of the cluster it reaches, in
            // purple, and A of the cluster it leaves, in orange
            const purple = shadesOf(c2, d, colB);
            const orange = shadesOf(c1, d, colA);
            const A = cellName(bridgeA);
            const B = cellName(bridgeB);
            const intro = tr`Multi Colors on ${d}: two clusters of ${d}s are shaded, one purple and one orange; in each, where a row, column or box has only two ${d}s, they take opposite shades.`;
            // a colour sees both colours of the other cluster (HoDoKu's
            // Multi Colors 2): colA true would kill the seen bCell, making
            // bOther entirely true, yet colA also sees a bOther cell, so
            // dark orange is false and light orange true
            let bridgeA2 = -1;
            let bridgeB2 = -1;
            for (const a of aCells) {
              for (const b of bOther) {
                if (sees(a, b)) {
                  bridgeA2 = a;
                  bridgeB2 = b;
                  break;
                }
              }
              if (bridgeA2 >= 0) break;
            }
            if (bridgeA2 >= 0) {
              const A2 = cellName(bridgeA2);
              const B2 = cellName(bridgeB2);
              return multiColorsStep(
                d,
                c2,
                c1,
                purple,
                orange,
                aCells.map(at(d)),
                [
                  weakTie(
                    [at(d)(bridgeA)],
                    [at(d)(bridgeB)],
                    tr`The dark orange ${d} in ${A} sees the dark purple ${d} in ${B} (the dashed line): if dark orange were true, dark purple would be false, and light purple true.`
                  ),
                  weakTie(
                    [at(d)(bridgeA2)],
                    [at(d)(bridgeB2)],
                    bridgeA2 === bridgeA
                      ? tr`The same ${d} in ${A2} also sees the light purple ${d} in ${B2}: dark orange would make both purple shades false, and one of them must be true.`
                      : tr`The dark orange ${d} in ${A2} also sees the light purple ${d} in ${B2}: dark orange would make both purple shades false, and one of them must be true.`
                  )
                ],
                `${intro} ${tr`The dark orange ${d}s see a dark purple ${d} (${A} sees ${B}) and a light purple ${d} (${A2} sees ${B2}): if dark orange were true, neither purple shade could be, which is impossible. So dark orange is false: every dark orange ${d} is removed, and every light orange ${d} is true.`}`,
                true
              );
            }
            // the bridge (HoDoKu's Multi Colors 1): dark orange and dark
            // purple cannot both be true, so light orange or light purple
            // is; a candidate seeing both light colours is false
            const elims: CellDigit[] = [];
            let first: { c: number; x: number; y: number } | null = null;
            for (let c = 0; c < 81; c++) {
              if (g.values[c] !== 0 || !(g.cands[c] & mask)) continue;
              if (c1.color.has(c) || c2.color.has(c)) continue;
              const xs = aOther.filter((a) => sees(c, a));
              const ys = bOther.filter((b) => sees(c, b));
              if (xs.length && ys.length) {
                elims.push({ cell: c, digit: d });
                first ??= { c, x: nearest(at(d)(c), xs.map(at(d))).cell, y: nearest(at(d)(c), ys.map(at(d))).cell };
              }
            }
            if (first) {
              const tail = more(elims.length - 1, d);
              const target = cellName(first.c);
              const x = cellName(first.x);
              const y = cellName(first.y);
              return multiColorsStep(
                d,
                c2,
                c1,
                purple,
                orange,
                elims,
                [
                  weakTie(
                    [at(d)(bridgeA)],
                    [at(d)(bridgeB)],
                    tr`The dark orange ${d} in ${A} and the dark purple ${d} in ${B} see each other (the dashed line), so they cannot both be true: light orange or light purple is true.`
                  ),
                  weakTie([at(d)(first.y)], [at(d)(first.c)], tr`If light purple is true, the ${d} in ${y} is true, and the ${d} in ${target} goes.`),
                  weakTie(
                    [at(d)(first.x)],
                    [at(d)(first.c)],
                    tr`If light orange is true, the ${d} in ${x} is true, and the ${d} in ${target} goes. One of them is true, so it is false either way` + tail + '.'
                  )
                ],
                `${intro} ${tr`The dark orange ${d} in ${A} and the dark purple ${d} in ${B} see each other, so they cannot both be true: light orange or light purple is true.`} ${
                  tr`The ${d} in ${target} sees a light purple ${d} in ${y} and a light orange ${d} in ${x}, so it is false either way` + tail
                }.`,
                false
              );
            }
          }
        }
      }
    }
  }
  return null;
}
