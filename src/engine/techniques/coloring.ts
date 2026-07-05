import { Grid, UNITS, bit, sees, cellNames } from '../board';
import { Step, CellDigit } from '../steps';

interface Cluster {
  cells: number[];
  color: Map<number, number>; // 0 | 1
}

/** Conjugate-pair clusters for a digit, 2-colored. */
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
    if (cells.length >= 3) out.push({ cells, color });
  }
  return out;
}

/** Simple Colors: color wrap (same color twice in a unit) and color trap
 *  (uncolored cell sees both colors). */
export function findSimpleColors(g: Grid): Step | null {
  for (let d = 1; d <= 9; d++) {
    const mask = bit(d);
    for (const cl of clusters(g, d)) {
      // color wrap
      for (const unit of UNITS) {
        const colored = unit.filter((c) => cl.color.has(c));
        for (const col of [0, 1]) {
          const same = colored.filter((c) => cl.color.get(c) === col);
          if (same.length >= 2) {
            const elims: CellDigit[] = cl.cells
              .filter((c) => cl.color.get(c) === col)
              .map((cell) => ({ cell, digit: d }));
            return {
              tech: 'SIMPLE_COLORS',
              placements: [],
              eliminations: elims,
              primary: cl.cells
                .filter((c) => cl.color.get(c) === 1 - col)
                .map((cell) => ({ cell, digit: d })),
              secondary: same.map((cell) => ({ cell, digit: d })),
              description: `Simple Colors (wrap) on ${d}: two cells of the same color share a unit (${cellNames(same)}), so that whole color is false.`
            };
          }
        }
      }
      // color trap
      const elims: CellDigit[] = [];
      for (let c = 0; c < 81; c++) {
        if (g.values[c] !== 0 || cl.color.has(c) || !(g.cands[c] & mask)) continue;
        const seesColor = [false, false];
        for (const cc of cl.cells) if (sees(c, cc)) seesColor[cl.color.get(cc)!] = true;
        if (seesColor[0] && seesColor[1]) elims.push({ cell: c, digit: d });
      }
      if (elims.length) {
        return {
          tech: 'SIMPLE_COLORS',
          placements: [],
          eliminations: elims,
          primary: cl.cells
            .filter((c) => cl.color.get(c) === 0)
            .map((cell) => ({ cell, digit: d })),
          secondary: cl.cells
            .filter((c) => cl.color.get(c) === 1)
            .map((cell) => ({ cell, digit: d })),
          description: `Simple Colors (trap) on ${d}: cells seeing both colors of the conjugate chain cannot be ${d}.`
        };
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
            const aSeesB = aCells.some((a) => bCells.some((b) => sees(a, b)));
            if (!aSeesB) continue;
            const bOther = c2.cells.filter((c) => c2.color.get(c) === 1 - colB);
            // rule 1: colA sees both colors of cluster 2 -> colA is false
            const aSeesBOther = aCells.some((a) => bOther.some((b) => sees(a, b)));
            if (aSeesBOther) {
              return {
                tech: 'MULTI_COLORS',
                placements: [],
                eliminations: aCells.map((cell) => ({ cell, digit: d })),
                primary: bCells
                  .concat(bOther)
                  .map((cell) => ({ cell, digit: d })),
                description: `Multi Colors on ${d}: one color of a cluster sees both colors of another cluster, so it must be false.`
              };
            }
            // rule 2: A~B weakly linked -> notA or notB true is wrong... rather:
            // since A and B cannot both be true, cells seeing both A' and B' lose d
            const aOther = c1.cells.filter((c) => c1.color.get(c) === 1 - colA);
            const elims: CellDigit[] = [];
            for (let c = 0; c < 81; c++) {
              if (g.values[c] !== 0 || !(g.cands[c] & mask)) continue;
              if (c1.color.has(c) || c2.color.has(c)) continue;
              if (
                aOther.some((a) => sees(c, a)) &&
                bOther.some((b) => sees(c, b))
              ) {
                elims.push({ cell: c, digit: d });
              }
            }
            if (elims.length) {
              return {
                tech: 'MULTI_COLORS',
                placements: [],
                eliminations: elims,
                primary: aOther.map((cell) => ({ cell, digit: d })),
                secondary: bOther.map((cell) => ({ cell, digit: d })),
                description: `Multi Colors on ${d}: two cluster colors exclude each other, so at least one of the opposite colors is true; cells seeing both lose ${d}.`
              };
            }
          }
        }
      }
    }
  }
  return null;
}
