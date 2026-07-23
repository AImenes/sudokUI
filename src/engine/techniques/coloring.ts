import { Grid, UNITS, bit, sees, cellName } from '../board';
import { Step, CellDigit, ChainLink } from '../steps';
import { unitName } from './subsets';

/** on-screen hue of each parity: colour 0 renders blue, colour 1 gold */
const HUE = ['blue', 'gold'] as const;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

interface Cluster {
  cells: number[];
  color: Map<number, number>; // 0 | 1
  /** BFS spanning tree (parent -> child): why each cell has its colour */
  edges: [number, number][];
}

/** Conjugate-pair clusters for a digit, 2-colored, with their link trees. */
function clusters(g: Grid, d: number): Cluster[] {
  const mask = bit(d);
  const adj = new Map<number, Set<number>>();
  for (const unit of UNITS) {
    const uc = unit.filter((c) => g.values[c] === 0 && g.cands[c] & mask);
    if (uc.length === 2) {
      if (!adj.has(uc[0])) adj.set(uc[0], new Set());
      if (!adj.has(uc[1])) adj.set(uc[1], new Set());
      adj.get(uc[0])!.add(uc[1]);
      adj.get(uc[1])!.add(uc[0]);
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
    const edges: [number, number][] = [];
    while (queue.length) {
      const cur = queue.shift()!;
      cells.push(cur);
      for (const next of adj.get(cur)!) {
        if (!color.has(next)) {
          color.set(next, 1 - color.get(cur)!);
          visited.add(next);
          edges.push([cur, next]);
          queue.push(next);
        }
      }
    }
    if (cells.length >= 3) out.push({ cells, color, edges });
  }
  return out;
}

const treeLinks = (cl: Cluster, d: number): ChainLink[] =>
  cl.edges.map(([a, b]) => ({
    from: [{ cell: a, digit: d }],
    to: [{ cell: b, digit: d }],
    strong: true
  }));

function simpleColorsStep(cl: Cluster, d: number, eliminations: CellDigit[], reason: string): Step {
  return {
    tech: 'SIMPLE_COLORS',
    placements: [],
    eliminations,
    primary: cl.cells.filter((c) => cl.color.get(c) === 0).map((cell) => ({ cell, digit: d })),
    secondary: cl.cells.filter((c) => cl.color.get(c) === 1).map((cell) => ({ cell, digit: d })),
    links: treeLinks(cl, d),
    description: `Simple Colors on ${d}: its conjugate pairs (the solid links) are coloured blue and gold, and either every blue ${d} is true or every gold one is. ${reason}.`
  };
}

/** Simple Colors: color wrap (same color twice in a unit) and color trap
 *  (uncolored cell sees both colors). */
export function findSimpleColors(g: Grid): Step | null {
  for (let d = 1; d <= 9; d++) {
    const mask = bit(d);
    for (const cl of clusters(g, d)) {
      // color wrap
      for (let u = 0; u < 27; u++) {
        const colored = UNITS[u].filter((c) => cl.color.has(c));
        for (const col of [0, 1]) {
          const same = colored.filter((c) => cl.color.get(c) === col);
          if (same.length >= 2) {
            const elims: CellDigit[] = cl.cells
              .filter((c) => cl.color.get(c) === col)
              .map((cell) => ({ cell, digit: d }));
            return simpleColorsStep(
              cl,
              d,
              elims,
              `${cap(HUE[col])} puts ${d} twice in ${unitName(u)} (${cellName(same[0])} and ${cellName(same[1])}), so ${HUE[col]} is false: all its ${d}s are removed (circled red) and every ${HUE[1 - col]} ${d} is true`
            );
          }
        }
      }
      // color trap
      const elims: CellDigit[] = [];
      let why = '';
      for (let c = 0; c < 81; c++) {
        if (g.values[c] !== 0 || cl.color.has(c) || !(g.cands[c] & mask)) continue;
        const seen: (number | undefined)[] = [undefined, undefined];
        for (const cc of cl.cells) if (sees(c, cc)) seen[cl.color.get(cc)!] ??= cc;
        if (seen[0] !== undefined && seen[1] !== undefined) {
          elims.push({ cell: c, digit: d });
          if (!why) {
            why = `The ${d} in ${cellName(c)} sees a blue ${d} in ${cellName(seen[0])} and a gold ${d} in ${cellName(seen[1])}, so it is false either way`;
          }
        }
      }
      if (elims.length) {
        return simpleColorsStep(
          cl,
          d,
          elims,
          why + (elims.length > 1 ? `; ${elims.length} ${d}s fall this way` : '')
        );
      }
    }
  }
  return null;
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
            const bridge: ChainLink = {
              from: [{ cell: bridgeA, digit: d }],
              to: [{ cell: bridgeB, digit: d }],
              strong: false
            };
            // rule 1: colA sees both colors of cluster 2 -> colA is false.
            // colA true would kill the seen bCell, making bOther entirely
            // true, yet colA also sees a bOther cell: contradiction.
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
              return {
                tech: 'MULTI_COLORS',
                placements: [],
                eliminations: aCells.map((cell) => ({ cell, digit: d })),
                primary: bCells.map((cell) => ({ cell, digit: d })),
                secondary: bOther.map((cell) => ({ cell, digit: d })),
                fins: aOther.map((cell) => ({ cell, digit: d })),
                links: [
                  ...treeLinks(c1, d),
                  ...treeLinks(c2, d),
                  bridge,
                  {
                    from: [{ cell: bridgeA2, digit: d }],
                    to: [{ cell: bridgeB2, digit: d }],
                    strong: false
                  }
                ],
                description: `Multi Colors on ${d}: two conjugate-pair clusters of ${d}, one coloured blue and gold. If the red ${d}s were all true, ${cellName(bridgeA)} would kill the blue ${d} in ${cellName(bridgeB)}, making gold entirely true; but ${cellName(bridgeA2)} also sees the gold ${d} in ${cellName(bridgeB2)}. So the red colour is false and every purple ${d} (its partner colour) is true.`
              };
            }
            // rule 2: colA and colB cannot both be true (the bridge cells see
            // each other), so at least one of their partner colours is
            // entirely true; cells seeing both partner colours lose d
            const elims: CellDigit[] = [];
            let why = '';
            for (let c = 0; c < 81; c++) {
              if (g.values[c] !== 0 || !(g.cands[c] & mask)) continue;
              if (c1.color.has(c) || c2.color.has(c)) continue;
              const x = aOther.find((a) => sees(c, a));
              const y = bOther.find((b) => sees(c, b));
              if (x !== undefined && y !== undefined) {
                elims.push({ cell: c, digit: d });
                if (!why) {
                  why = `The ${d} in ${cellName(c)} sees the blue ${d} in ${cellName(x)} and the gold ${d} in ${cellName(y)}, so it is false either way`;
                }
              }
            }
            if (elims.length) {
              return {
                tech: 'MULTI_COLORS',
                placements: [],
                eliminations: elims,
                primary: aOther.map((cell) => ({ cell, digit: d })),
                secondary: bOther.map((cell) => ({ cell, digit: d })),
                fins: aCells.concat(bCells).map((cell) => ({ cell, digit: d })),
                links: [...treeLinks(c1, d), ...treeLinks(c2, d), bridge],
                description: `Multi Colors on ${d}: two conjugate-pair clusters of ${d}. The purple ${d}s in ${cellName(bridgeA)} and ${cellName(bridgeB)} see each other (the dashed link), so they cannot both be true, and at least one of blue and gold is entirely true. ${why}${elims.length > 1 ? `; ${elims.length} ${d}s fall this way` : ''}.`
              };
            }
          }
        }
      }
    }
  }
  return null;
}
