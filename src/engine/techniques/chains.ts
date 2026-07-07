import {
  Grid,
  UNITS,
  CELL_UNITS,
  bit,
  digitsOf,
  popcount,
  sees,
  cellName,
  cellNames
} from '../board';
import { Step, CellDigit, ChainLink, alternatingLinks } from '../steps';

/**
 * Candidate-level links for a chain of bivalue cells where each cell is
 * entered on one digit and left on the other: a strong link inside every
 * cell (entry → exit) and a weak link on the shared exit digit between
 * consecutive cells. `entry` is the digit the first cell is entered on.
 */
function bivalueCellLinks(g: Grid, path: number[], entry: number): ChainLink[] {
  const nodes: CellDigit[][] = [];
  let inDigit = entry;
  for (const cell of path) {
    const outDigit = digitsOf(g.cands[cell]).find((x) => x !== inDigit)!;
    nodes.push([{ cell, digit: inDigit }], [{ cell, digit: outDigit }]);
    inDigit = outDigit;
  }
  return alternatingLinks(nodes);
}

/** Remote Pairs: chain of identical bivalue cells; both digits fall in cells
 *  seeing two opposite-parity chain cells. */
export function findRemotePair(g: Grid): Step | null {
  const byMask = new Map<number, number[]>();
  for (let c = 0; c < 81; c++) {
    if (g.values[c] === 0 && popcount(g.cands[c]) === 2) {
      const list = byMask.get(g.cands[c]) ?? [];
      list.push(c);
      byMask.set(g.cands[c], list);
    }
  }
  for (const [mask, cells] of byMask) {
    if (cells.length < 4) continue;
    const digits = digitsOf(mask);
    // connected components with 2-coloring
    const color = new Map<number, number>();
    for (const start of cells) {
      if (color.has(start)) continue;
      const component: number[] = [];
      const queue = [start];
      color.set(start, 0);
      let bipartite = true;
      while (queue.length) {
        const cur = queue.shift()!;
        component.push(cur);
        for (const next of cells) {
          if (next === cur || !sees(cur, next)) continue;
          if (!color.has(next)) {
            color.set(next, 1 - color.get(cur)!);
            queue.push(next);
          } else if (color.get(next) === color.get(cur)) {
            bipartite = false;
          }
        }
      }
      if (!bipartite || component.length < 4) continue;
      const elims: CellDigit[] = [];
      for (let c = 0; c < 81; c++) {
        if (g.values[c] !== 0 || component.includes(c)) continue;
        if (!(g.cands[c] & mask)) continue;
        const seesColor = [false, false];
        for (const cc of component) {
          if (sees(c, cc)) seesColor[color.get(cc)!] = true;
        }
        if (seesColor[0] && seesColor[1]) {
          for (const d of digitsOf(g.cands[c] & mask)) elims.push({ cell: c, digit: d });
        }
      }
      if (!elims.length) continue;
      // order the component into a simple path for the arrows; when it
      // branches (rare), fall back to highlights only
      const path = orderAsPath(component, sees);
      return {
        tech: 'REMOTE_PAIR',
        placements: [],
        eliminations: elims,
        primary: component.flatMap((cell) =>
          digits.map((digit) => ({ cell, digit }))
        ),
        links: path ? bivalueCellLinks(g, path, digits[0]) : undefined,
        description: `Remote Pair: the cells ${cellNames(component)} form a chain of ${digits.join('')} pairs; cells seeing both "colors" of the chain lose ${digits.join(' and ')}.`
      };
    }
  }
  return null;
}

/**
 * Order a connected cell set into a simple path along the `sees` relation,
 * or null when it isn't one (a branching component). Greedy walk from a
 * degree-1 endpoint.
 */
function orderAsPath(
  component: number[],
  seesFn: (a: number, b: number) => boolean
): number[] | null {
  const degree = (c: number) => component.filter((o) => o !== c && seesFn(c, o)).length;
  const start = component.find((c) => degree(c) === 1);
  if (start === undefined) return null;
  const path = [start];
  const used = new Set([start]);
  while (path.length < component.length) {
    const cur = path[path.length - 1];
    const nexts = component.filter((c) => !used.has(c) && seesFn(cur, c));
    if (nexts.length !== 1) return null;
    path.push(nexts[0]);
    used.add(nexts[0]);
  }
  return path;
}

/** X-Chain: alternating strong/weak links on one digit, strong at both ends. */
export function findXChain(g: Grid, maxLen = 9): Step | null {
  for (let d = 1; d <= 9; d++) {
    const mask = bit(d);
    const cells: number[] = [];
    for (let c = 0; c < 81; c++) if (g.values[c] === 0 && g.cands[c] & mask) cells.push(c);
    if (cells.length < 4) continue;
    // strong partner map: for each cell, cells linked by a conjugate pair
    const strong = new Map<number, Set<number>>();
    for (const c of cells) strong.set(c, new Set());
    for (const [ui, unit] of UNITS.entries()) {
      const uc = unit.filter((c) => g.values[c] === 0 && g.cands[c] & mask);
      if (uc.length === 2) {
        strong.get(uc[0])!.add(uc[1]);
        strong.get(uc[1])!.add(uc[0]);
      }
    }
    // BFS over (cell, parity): parity 0 = next link must be strong
    for (const start of cells) {
      if (strong.get(start)!.size === 0) continue;
      type State = { cell: number; parity: number; path: number[] };
      const queue: State[] = [{ cell: start, parity: 0, path: [start] }];
      while (queue.length) {
        const { cell, parity, path } = queue.shift()!;
        if (path.length > maxLen) continue;
        const nexts =
          parity === 0
            ? [...strong.get(cell)!]
            : cells.filter((c) => sees(c, cell) && !path.includes(c));
        for (const next of nexts) {
          if (path.includes(next)) continue;
          const newPath = [...path, next];
          // chain ends after a strong link with odd link count >= 3
          if (parity === 0 && newPath.length >= 4 && newPath.length % 2 === 0) {
            const elims: CellDigit[] = [];
            for (const c of cells) {
              if (newPath.includes(c)) continue;
              if (sees(c, start) && sees(c, next)) elims.push({ cell: c, digit: d });
            }
            if (elims.length) {
              return {
                tech: 'X_CHAIN',
                placements: [],
                eliminations: elims,
                primary: newPath.map((cell) => ({ cell, digit: d })),
                links: alternatingLinks(newPath.map((cell) => [{ cell, digit: d }])),
                description: `X-Chain on ${d}: ${newPath.map(cellName).join(' → ')}; one end must be ${d}, so ${d} is removed from cells seeing both ends.`
              };
            }
          }
          queue.push({ cell: next, parity: 1 - parity, path: newPath });
        }
      }
    }
  }
  return null;
}

/** XY-Chain: chain of bivalue cells; both ends carry the elimination digit. */
export function findXYChain(g: Grid, maxLen = 10): Step | null {
  const bivalue: number[] = [];
  for (let c = 0; c < 81; c++) {
    if (g.values[c] === 0 && popcount(g.cands[c]) === 2) bivalue.push(c);
  }
  if (bivalue.length < 3) return null;
  for (const start of bivalue) {
    for (const z of digitsOf(g.cands[start])) {
      // we assume start is NOT z -> start takes its other digit, which links onward
      const linkStart = digitsOf(g.cands[start]).find((x) => x !== z)!;
      type State = { cell: number; linkDigit: number; path: number[] };
      const queue: State[] = [{ cell: start, linkDigit: linkStart, path: [start] }];
      while (queue.length) {
        const { cell, linkDigit, path } = queue.shift()!;
        if (path.length > maxLen) continue;
        for (const next of bivalue) {
          if (path.includes(next) || !sees(next, cell)) continue;
          if (!(g.cands[next] & bit(linkDigit))) continue;
          const exit = digitsOf(g.cands[next]).find((x) => x !== linkDigit)!;
          const newPath = [...path, next];
          if (exit === z && newPath.length >= 3) {
            const elims: CellDigit[] = [];
            for (let c = 0; c < 81; c++) {
              if (g.values[c] !== 0 || newPath.includes(c)) continue;
              if (!(g.cands[c] & bit(z))) continue;
              if (sees(c, start) && sees(c, next)) elims.push({ cell: c, digit: z });
            }
            if (elims.length) {
              return {
                tech: 'XY_CHAIN',
                placements: [],
                eliminations: elims,
                primary: newPath.map((cell) => ({
                  cell,
                  digit: cell === start || cell === next ? z : 0
                })).filter((cd) => cd.digit !== 0),
                links: bivalueCellLinks(g, newPath, z),
                description: `XY-Chain: ${newPath.map(cellName).join(' → ')}; whichever way the chain resolves, one end is ${z}, so ${z} is removed from cells seeing both ends.`
              };
            }
          }
          queue.push({ cell: next, linkDigit: exit, path: newPath });
        }
      }
    }
  }
  return null;
}
