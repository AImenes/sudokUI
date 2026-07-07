import { Grid, UNITS, bit, sees, rowOf, colOf, cellNames } from '../board';
import { Step, CellDigit, alternatingLinks } from '../steps';

/** node path -> candidate sets for arrow drawing */
const nodeCds = (nodes: GNode[], path: number[], d: number): CellDigit[][] =>
  path.map((n) => nodes[n].cells.map((cell) => ({ cell, digit: d })));

/**
 * Grouped X-Cycles (sudokuwiki.org/Grouped_X_Cycles): X-Cycles where a node
 * may be a GROUP — the 2–3 candidates of a digit in one box∕line
 * intersection, treated as a unit ("one of these cells is the digit").
 *
 * Links between disjoint nodes A, B:
 * - strong: some unit's candidates are exactly A ∪ B (¬A ⇒ B);
 * - weak: every cell of A sees every cell of B (A ⇒ ¬B).
 *
 * Loop rules, discontinuity anchored at the search start:
 * - Rule 1 (continuous, perfect alternation): along each weak link exactly
 *   one endpoint is true → the digit falls from outside cells seeing all
 *   cells of both endpoints.
 * - Rule 2 (two strong links at the start): the start node is true — a
 *   single cell is placed; a group confines the digit, so it falls from
 *   every cell seeing all group cells.
 * - Rule 3 (two weak links at the start): the start node is false — the
 *   digit falls from every cell of the start node. (For single cells this
 *   duplicates X-Chain, which runs earlier; groups are the new value.)
 */

interface GNode {
  cells: number[];
}

export function findGroupedXCycles(g: Grid, maxLen = 10): Step | null {
  for (let d = 1; d <= 9; d++) {
    const mask = bit(d);
    const has = (c: number) => g.values[c] === 0 && (g.cands[c] & mask) !== 0;
    const candCells: number[] = [];
    for (let c = 0; c < 81; c++) if (has(c)) candCells.push(c);
    if (candCells.length < 5) continue;

    // nodes: single cells + box∕line segments of 2-3 cells
    const nodes: GNode[] = candCells.map((c) => ({ cells: [c] }));
    for (let b = 0; b < 9; b++) {
      const inBox = UNITS[18 + b].filter(has);
      for (const lineOf of [rowOf, colOf]) {
        const byLine = new Map<number, number[]>();
        for (const c of inBox) {
          const l = lineOf(c);
          if (!byLine.has(l)) byLine.set(l, []);
          byLine.get(l)!.push(c);
        }
        for (const seg of byLine.values()) {
          if (seg.length >= 2) nodes.push({ cells: seg });
        }
      }
    }

    const disjoint = (a: GNode, b: GNode) => !a.cells.some((c) => b.cells.includes(c));
    const weakLinked = (a: GNode, b: GNode) =>
      disjoint(a, b) && a.cells.every((ca) => b.cells.every((cb) => sees(ca, cb)));

    // strong links: a unit's candidates split exactly into two disjoint nodes
    const strong = new Map<number, Set<number>>();
    const addStrong = (i: number, j: number) => {
      if (!strong.has(i)) strong.set(i, new Set());
      if (!strong.has(j)) strong.set(j, new Set());
      strong.get(i)!.add(j);
      strong.get(j)!.add(i);
    };
    for (const unit of UNITS) {
      const uc = unit.filter(has);
      if (uc.length < 2) continue;
      const inUnit: number[] = [];
      for (let n = 0; n < nodes.length; n++) {
        if (nodes[n].cells.every((c) => unit.includes(c))) inUnit.push(n);
      }
      for (let x = 0; x < inUnit.length; x++) {
        for (let y = x + 1; y < inUnit.length; y++) {
          const A = nodes[inUnit[x]];
          const B = nodes[inUnit[y]];
          if (!disjoint(A, B)) continue;
          if (A.cells.length + B.cells.length !== uc.length) continue;
          addStrong(inUnit[x], inUnit[y]);
        }
      }
    }
    if (!strong.size) continue;

    let budget = 25000;
    const pathHasCellOverlap = (path: number[], n: number) =>
      path.some((p) => !disjoint(nodes[p], nodes[n]));

    const dfs = (
      path: number[],
      nextType: 'strong' | 'weak',
      firstWeak: boolean
    ): Step | null => {
      if (budget-- <= 0 || path.length > maxLen) return null;
      const cur = path[path.length - 1];
      const start = path[0];

      if (path.length >= 3) {
        const lastWasStrong = nextType === 'weak';
        if (!firstWeak) {
          // rules 1 & 2 (first link strong)
          if (!lastWasStrong && strong.get(cur)?.has(start)) {
            const step = rule2(g, d, nodes, path);
            if (step) return step;
          }
          if (lastWasStrong && weakLinked(nodes[cur], nodes[start]) && path.length % 2 === 0) {
            const step = rule1(g, d, nodes, path);
            if (step) return step;
          }
        } else if (lastWasStrong && weakLinked(nodes[cur], nodes[start]) && path.length % 2 === 1) {
          // rule 3 (first link weak, weak closure): start node is false
          const startCells = nodes[start].cells;
          if (startCells.length >= 2) {
            return {
              tech: 'GROUPED_X_CYCLES',
              placements: [],
              eliminations: startCells.map((cell) => ({ cell, digit: d })),
              primary: path.flatMap((n) => nodes[n].cells.map((cell) => ({ cell, digit: d }))),
              // rule 3 paths start with a WEAK link (inverted alternation)
              // and also close weak
              links: [
                ...alternatingLinks(nodeCds(nodes, path, d)).map((l) => ({
                  ...l,
                  strong: !l.strong
                })),
                {
                  from: nodes[path[path.length - 1]].cells.map((cell) => ({ cell, digit: d })),
                  to: nodes[path[0]].cells.map((cell) => ({ cell, digit: d })),
                  strong: false
                }
              ],
              description: `Grouped X-Cycle on ${d}: the loop closes with two weak links at the group ${cellNames(startCells)}, so none of those cells can be ${d}.`
            };
          }
        }
      }

      const nexts: number[] = [];
      if (nextType === 'strong') {
        for (const n of strong.get(cur) ?? []) nexts.push(n);
      } else {
        for (let n = 0; n < nodes.length; n++) {
          if (n !== cur && weakLinked(nodes[cur], nodes[n])) nexts.push(n);
        }
      }
      for (const next of nexts) {
        if (path.includes(next) || pathHasCellOverlap(path, next)) continue;
        const res = dfs([...path, next], nextType === 'strong' ? 'weak' : 'strong', firstWeak);
        if (res) return res;
      }
      return null;
    };

    for (let start = 0; start < nodes.length; start++) {
      if (strong.has(start)) {
        const res = dfs([start], 'strong', false);
        if (res) return res;
      }
      // rule 3 pays off only for groups (single cells are X-Chain territory)
      if (nodes[start].cells.length >= 2) {
        const res = dfs([start], 'weak', true);
        if (res) return res;
      }
    }
  }
  return null;
}

function rule2(g: Grid, d: number, nodes: GNode[], path: number[]): Step | null {
  const start = nodes[path[0]];
  const inPath = new Set(path.flatMap((n) => nodes[n].cells));
  if (start.cells.length === 1) {
    return {
      tech: 'GROUPED_X_CYCLES',
      placements: [{ cell: start.cells[0], digit: d }],
      eliminations: [],
      primary: path.flatMap((n) => nodes[n].cells.map((cell) => ({ cell, digit: d }))),
      links: alternatingLinks(nodeCds(nodes, path, d), 'strong'),
      description: `Grouped X-Cycle on ${d}: the loop closes with two strong links at ${cellNames(start.cells)}, forcing it to be ${d}.`
    };
  }
  // group is true: the digit falls from cells seeing all group cells
  const elims: CellDigit[] = [];
  for (let c = 0; c < 81; c++) {
    if (g.values[c] !== 0 || inPath.has(c)) continue;
    if (!(g.cands[c] & bit(d))) continue;
    if (start.cells.every((sc) => sees(c, sc))) elims.push({ cell: c, digit: d });
  }
  if (!elims.length) return null;
  return {
    tech: 'GROUPED_X_CYCLES',
    placements: [],
    eliminations: elims,
    primary: path.flatMap((n) => nodes[n].cells.map((cell) => ({ cell, digit: d }))),
    links: alternatingLinks(nodeCds(nodes, path, d), 'strong'),
    description: `Grouped X-Cycle on ${d}: two strong links meet at the group ${cellNames(start.cells)}, so ${d} lives there and falls from every cell seeing the whole group.`
  };
}

function rule1(g: Grid, d: number, nodes: GNode[], path: number[]): Step | null {
  const inPath = new Set(path.flatMap((n) => nodes[n].cells));
  const elims: CellDigit[] = [];
  const seen = new Set<number>();
  // links alternate strong, weak, ...; weak links sit at even indices plus the closure
  for (let i = 1; i < path.length; i += 2) {
    const A = nodes[path[i]];
    const B = nodes[path[(i + 1) % path.length]];
    for (let c = 0; c < 81; c++) {
      if (g.values[c] !== 0 || inPath.has(c) || seen.has(c)) continue;
      if (!(g.cands[c] & bit(d))) continue;
      if (A.cells.every((a) => sees(c, a)) && B.cells.every((b) => sees(c, b))) {
        seen.add(c);
        elims.push({ cell: c, digit: d });
      }
    }
  }
  if (!elims.length) return null;
  return {
    tech: 'GROUPED_X_CYCLES',
    placements: [],
    eliminations: elims,
    primary: path.flatMap((n) => nodes[n].cells.map((cell) => ({ cell, digit: d }))),
    links: alternatingLinks(nodeCds(nodes, path, d), 'weak'),
    description: `Grouped X-Cycle on ${d}: a continuous loop through ${path.length} nodes (groups included); along each weak link one side is ${d}, so ${d} falls from outside cells seeing both sides.`
  };
}
