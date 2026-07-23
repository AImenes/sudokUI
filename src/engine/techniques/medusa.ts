import { Grid, UNITS, bit, digitsOf, popcount, sees, cellName } from '../board';
import { Step, CellDigit, ChainLink } from '../steps';
import { unitName } from './subsets';

/** node id for (cell, digit) */
const nid = (cell: number, digit: number) => cell * 9 + digit - 1;
const nCell = (id: number) => Math.floor(id / 9);
const nDigit = (id: number) => (id % 9) + 1;
const cd = (id: number): CellDigit => ({ cell: nCell(id), digit: nDigit(id) });

/** on-screen hue of each parity: colour 0 renders blue, colour 1 gold */
const HUE = ['blue', 'gold'] as const;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

interface Cluster {
  nodes: number[];
  color: Map<number, number>; // node id -> 0 | 1
  /** BFS spanning tree (parent -> child): why each node has its colour */
  edges: [number, number][];
}

/**
 * Build 3D Medusa clusters: nodes are candidates (cell,digit); strong links
 * are conjugate pairs (two positions of a digit in a unit) and bivalue cells
 * (two digits in a cell). Each connected component is 2-colored; the BFS
 * spanning tree is kept so the colouring can be drawn as links.
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
    const edges: [number, number][] = [];
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
          edges.push([cur, next]);
          queue.push(next);
        }
      }
    }
    if (nodes.length >= 4) clusters.push({ nodes, color, edges });
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
      const tail = `so ${HUE[col]} is false: all its candidates are removed (circled red) and every ${HUE[1 - col]} candidate is true`;
      // rule 1: same colour twice in one cell
      const byCell = new Map<number, number[]>();
      for (const n of nodes) {
        const ds = byCell.get(nCell(n)) ?? [];
        ds.push(nDigit(n));
        byCell.set(nCell(n), ds);
      }
      for (const [cell, ds] of byCell) {
        if (ds.length >= 2) {
          return medusaStep(
            cl,
            nodes.map(cd),
            `${cap(HUE[col])} colours both ${ds[0]} and ${ds[1]} in ${cellName(cell)}, ${tail}`
          );
        }
      }
      // rule 2: same colour, same digit, twice in a unit
      for (let u = 0; u < 27; u++) {
        for (let d = 1; d <= 9; d++) {
          const twice = UNITS[u].filter((c) => cl.color.get(nid(c, d)) === col);
          if (twice.length >= 2) {
            return medusaStep(
              cl,
              nodes.map(cd),
              `${cap(HUE[col])} puts ${d} twice in ${unitName(u)} (${cellName(twice[0])} and ${cellName(twice[1])}), ${tail}`
            );
          }
        }
      }
    }

    // Rule 3: cell holding both colours -> uncoloured candidates there go
    const elims3: CellDigit[] = [];
    let why3 = '';
    for (let c = 0; c < 81; c++) {
      if (g.values[c] !== 0) continue;
      const colorDigit: (number | undefined)[] = [undefined, undefined];
      for (const d of digitsOf(g.cands[c])) {
        const col = cl.color.get(nid(c, d));
        if (col !== undefined) colorDigit[col] = d;
      }
      if (colorDigit[0] === undefined || colorDigit[1] === undefined) continue;
      const before = elims3.length;
      for (const d of digitsOf(g.cands[c])) {
        if (!cl.color.has(nid(c, d))) elims3.push({ cell: c, digit: d });
      }
      if (elims3.length > before && !why3) {
        why3 = `${cellName(c)} holds both a blue ${colorDigit[0]} and a gold ${colorDigit[1]}; one of those two is true, so the cell's other candidates are removed`;
      }
    }
    if (elims3.length) {
      const cellsHit = new Set(elims3.map((e) => e.cell)).size;
      return medusaStep(
        cl,
        elims3,
        why3 + (cellsHit > 1 ? ` (${cellsHit} cells are decided this way)` : '')
      );
    }

    // Rules 4 & 5: uncoloured candidate eliminated by what it sees
    const elims45: CellDigit[] = [];
    let why45 = '';
    for (let c = 0; c < 81; c++) {
      if (g.values[c] !== 0) continue;
      // one representative coloured digit of each colour in this cell (rule 5)
      const colorDigit: (number | undefined)[] = [undefined, undefined];
      for (const d of digitsOf(g.cands[c])) {
        const col = cl.color.get(nid(c, d));
        if (col !== undefined) colorDigit[col] = d;
      }
      for (const d of digitsOf(g.cands[c])) {
        if (cl.color.has(nid(c, d))) continue;
        const seen: (number | undefined)[] = [undefined, undefined];
        for (const n of cl.nodes) {
          if (nDigit(n) === d && sees(c, nCell(n))) seen[cl.color.get(n)!] ??= nCell(n);
        }
        // rule 4: sees both colours of its own digit
        if (seen[0] !== undefined && seen[1] !== undefined) {
          elims45.push({ cell: c, digit: d });
          if (!why45) {
            why45 = `The ${d} in ${cellName(c)} sees a blue ${d} in ${cellName(seen[0])} and a gold ${d} in ${cellName(seen[1])}, so it is false either way`;
          }
          continue;
        }
        // rule 5: sees colour A of its own digit + opposite colour in its cell
        for (const A of [0, 1]) {
          if (seen[A] !== undefined && colorDigit[1 - A] !== undefined) {
            elims45.push({ cell: c, digit: d });
            if (!why45) {
              why45 = `The ${d} in ${cellName(c)} sees a ${HUE[A]} ${d} in ${cellName(seen[A]!)} while its own cell holds a ${HUE[1 - A]} ${colorDigit[1 - A]}, so whichever colour is true removes it`;
            }
            break;
          }
        }
      }
    }
    if (elims45.length) {
      return medusaStep(
        cl,
        elims45,
        why45 + (elims45.length > 1 ? `; ${elims45.length} candidates fall this way` : '')
      );
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
          return medusaStep(
            cl,
            colored(A).map(cd),
            `If ${HUE[A]} were true, ${cellName(c)} would lose every one of its candidates (${ds.join(', ')}), so ${HUE[A]} is false: all its candidates are removed (circled red) and every ${HUE[1 - A]} candidate is true`
          );
        }
      }
    }
  }
  return null;
}

const clusters = buildClusters;

function medusaStep(cl: Cluster, eliminations: CellDigit[], reason: string): Step {
  const links: ChainLink[] = cl.edges.map(([a, b]) => ({
    from: [cd(a)],
    to: [cd(b)],
    strong: true
  }));
  return {
    tech: 'MEDUSA_3D',
    placements: [],
    eliminations,
    primary: cl.nodes.filter((n) => cl.color.get(n) === 0).map(cd),
    secondary: cl.nodes.filter((n) => cl.color.get(n) === 1).map(cd),
    links,
    description: `3D Medusa: candidates joined by conjugate pairs and bivalue cells (the solid links) are coloured blue and gold, and either every blue candidate is true or every gold one is. ${reason}.`
  };
}
