import { Grid, UNITS, CELL_UNITS, bit, digitsOf, popcount, sees } from '../board';
import { Step, CellDigit } from '../steps';

/** node id for (cell, digit) */
const nid = (cell: number, digit: number) => cell * 9 + digit - 1;
const nCell = (id: number) => Math.floor(id / 9);
const nDigit = (id: number) => (id % 9) + 1;

interface Cluster {
  nodes: number[];
  color: Map<number, number>; // node id -> 0 | 1
}

/**
 * Build 3D Medusa clusters: nodes are candidates (cell,digit); strong links
 * are conjugate pairs (two positions of a digit in a unit) and bivalue cells
 * (two digits in a cell). Each connected component is 2-colored.
 */
function buildClusters(g: Grid): Cluster[] {
  const adj = new Map<number, Set<number>>();
  const link = (a: number, b: number) => {
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  };
  for (const unit of UNITS) {
    for (let d = 1; d <= 9; d++) {
      const cells = unit.filter((c) => g.values[c] === 0 && g.cands[c] & bit(d));
      if (cells.length === 2) link(nid(cells[0], d), nid(cells[1], d));
    }
  }
  for (let c = 0; c < 81; c++) {
    if (g.values[c] === 0 && popcount(g.cands[c]) === 2) {
      const [d1, d2] = digitsOf(g.cands[c]);
      link(nid(c, d1), nid(c, d2));
    }
  }
  const clusters: Cluster[] = [];
  const visited = new Set<number>();
  for (const start of adj.keys()) {
    if (visited.has(start)) continue;
    const color = new Map<number, number>();
    const nodes: number[] = [];
    const queue = [start];
    color.set(start, 0);
    visited.add(start);
    while (queue.length) {
      const cur = queue.shift()!;
      nodes.push(cur);
      for (const next of adj.get(cur)!) {
        if (!color.has(next)) {
          color.set(next, 1 - color.get(cur)!);
          visited.add(next);
          queue.push(next);
        }
      }
    }
    if (nodes.length >= 4) clusters.push({ nodes, color });
  }
  return clusters;
}

/** all six elimination rules from sudokuwiki.org/3D_Medusa */
export function findMedusa3d(g: Grid): Step | null {
  for (const cl of clusters(g)) {
    const colored = (col: number) => cl.nodes.filter((n) => cl.color.get(n) === col);

    // Rules 1 & 2: a colour contradicts itself -> remove that whole colour
    for (const col of [0, 1]) {
      const nodes = colored(col);
      // rule 1: same colour twice in one cell
      const byCell = new Map<number, number>();
      let bad = false;
      for (const n of nodes) {
        byCell.set(nCell(n), (byCell.get(nCell(n)) ?? 0) + 1);
        if (byCell.get(nCell(n))! >= 2) bad = true;
      }
      // rule 2: same colour, same digit, twice in a unit
      if (!bad) {
        outer: for (let u = 0; u < 27 && !bad; u++) {
          for (let d = 1; d <= 9; d++) {
            let count = 0;
            for (const c of UNITS[u]) {
              if (cl.color.get(nid(c, d)) === col) count++;
              if (count >= 2) {
                bad = true;
                break outer;
              }
            }
          }
        }
      }
      if (bad) {
        const elims = nodes.map((n) => ({ cell: nCell(n), digit: nDigit(n) }));
        return medusaStep(cl, elims, 'a colour contradicts itself, so every candidate of that colour is removed');
      }
    }

    // Rule 3: cell holding both colours -> uncoloured candidates there go
    const elims3: CellDigit[] = [];
    for (let c = 0; c < 81; c++) {
      if (g.values[c] !== 0) continue;
      const colors = new Set<number>();
      for (const d of digitsOf(g.cands[c])) {
        const col = cl.color.get(nid(c, d));
        if (col !== undefined) colors.add(col);
      }
      if (colors.size === 2) {
        for (const d of digitsOf(g.cands[c])) {
          if (!cl.color.has(nid(c, d))) elims3.push({ cell: c, digit: d });
        }
      }
    }
    if (elims3.length) {
      return medusaStep(cl, elims3, 'cells containing both colours cannot hold any other candidate');
    }

    // Rules 4 & 5: uncoloured candidate eliminated by what it sees
    const elims45: CellDigit[] = [];
    for (let c = 0; c < 81; c++) {
      if (g.values[c] !== 0) continue;
      // colours present in this cell (for rule 5)
      const cellColors = new Set<number>();
      for (const d of digitsOf(g.cands[c])) {
        const col = cl.color.get(nid(c, d));
        if (col !== undefined) cellColors.add(col);
      }
      for (const d of digitsOf(g.cands[c])) {
        if (cl.color.has(nid(c, d))) continue;
        const seesColor = [false, false];
        for (const n of cl.nodes) {
          if (nDigit(n) === d && sees(c, nCell(n))) seesColor[cl.color.get(n)!] = true;
        }
        // rule 4: sees both colours of its own digit
        if (seesColor[0] && seesColor[1]) {
          elims45.push({ cell: c, digit: d });
          continue;
        }
        // rule 5: sees colour A of its own digit + opposite colour in its cell
        for (const A of [0, 1]) {
          if (seesColor[A] && cellColors.has(1 - A)) {
            elims45.push({ cell: c, digit: d });
            break;
          }
        }
      }
    }
    if (elims45.length) {
      return medusaStep(cl, elims45, 'candidates that see both colours (or one colour plus the opposite colour in their own cell) are removed');
    }

    // Rule 6: an uncoloured cell where every candidate sees colour A ->
    // colour A would empty the cell, so colour A is false
    for (const A of [0, 1]) {
      for (let c = 0; c < 81; c++) {
        if (g.values[c] !== 0) continue;
        const ds = digitsOf(g.cands[c]);
        if (ds.length === 0) continue;
        if (ds.some((d) => cl.color.has(nid(c, d)))) continue; // must be fully uncoloured
        const emptied = ds.every((d) =>
          cl.nodes.some((n) => nDigit(n) === d && cl.color.get(n) === A && sees(c, nCell(n)))
        );
        if (emptied) {
          const elims = colored(A).map((n) => ({ cell: nCell(n), digit: nDigit(n) }));
          return medusaStep(cl, elims, 'one colour would empty a cell entirely, so that colour is false');
        }
      }
    }
  }
  return null;
}

const clusters = buildClusters;

function medusaStep(cl: Cluster, eliminations: CellDigit[], reason: string): Step {
  return {
    tech: 'MEDUSA_3D',
    placements: [],
    eliminations,
    primary: cl.nodes
      .filter((n) => cl.color.get(n) === 0)
      .map((n) => ({ cell: nCell(n), digit: nDigit(n) })),
    secondary: cl.nodes
      .filter((n) => cl.color.get(n) === 1)
      .map((n) => ({ cell: nCell(n), digit: nDigit(n) })),
    description: `3D Medusa: colouring candidates through conjugate pairs and bivalue cells, ${reason}.`
  };
}
