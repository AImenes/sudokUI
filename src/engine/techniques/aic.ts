import { Grid, UNITS, bit, digitsOf, popcount, sees, cellName } from '../board';
import { Step, CellDigit } from '../steps';

/**
 * Alternating Inference Chains (sudokuwiki.org/Alternating_Inference_Chains).
 *
 * Nodes are candidates (cell, digit). Strong links ("if OFF then ON"):
 * conjugate pairs (a digit with exactly two places in a unit) and bivalue
 * cells. Weak links ("if ON then OFF"): the same digit twice in one unit, or
 * two digits in the same cell.
 *
 * A chain that starts and ends with strong links proves that at least one of
 * its two end candidates is true, so any candidate that conflicts with BOTH
 * ends is eliminated. "Conflicts with" a candidate e in cell E means: lives
 * in E with a different digit, or is the same digit as e in a cell seeing E.
 * (Same-digit ends make this the familiar "sees both ends" rule.)
 */

const nid = (cell: number, digit: number) => cell * 9 + digit - 1;
const nCell = (id: number) => Math.floor(id / 9);
const nDigit = (id: number) => (id % 9) + 1;

interface NodeGraph {
  strong: Map<number, number[]>;
  candidates: number[]; // all node ids present in the grid
}

function buildGraph(g: Grid): NodeGraph {
  const strong = new Map<number, number[]>();
  const candidates: number[] = [];
  const add = (a: number, b: number) => {
    if (!strong.has(a)) strong.set(a, []);
    strong.get(a)!.push(b);
  };
  for (let c = 0; c < 81; c++) {
    if (g.values[c] !== 0) continue;
    const ds = digitsOf(g.cands[c]);
    for (const d of ds) candidates.push(nid(c, d));
    if (ds.length === 2) {
      add(nid(c, ds[0]), nid(c, ds[1]));
      add(nid(c, ds[1]), nid(c, ds[0]));
    }
  }
  for (const unit of UNITS) {
    for (let d = 1; d <= 9; d++) {
      const uc = unit.filter((c) => g.values[c] === 0 && g.cands[c] & bit(d));
      if (uc.length === 2) {
        add(nid(uc[0], d), nid(uc[1], d));
        add(nid(uc[1], d), nid(uc[0], d));
      }
    }
  }
  return { strong, candidates };
}

/** Node ids that conflict with (are weakly linked to) candidate `id`. */
function conflictsOf(g: Grid, id: number): Set<number> {
  const out = new Set<number>();
  const cell = nCell(id);
  const digit = nDigit(id);
  for (const d of digitsOf(g.cands[cell])) {
    if (d !== digit) out.add(nid(cell, d));
  }
  for (let c = 0; c < 81; c++) {
    if (c === cell || g.values[c] !== 0) continue;
    if (g.cands[c] & bit(digit) && sees(c, cell)) out.add(nid(c, digit));
  }
  return out;
}

export function findAic(g: Grid, maxNodes = 12): Step | null {
  const { strong, candidates } = buildGraph(g);
  if (!strong.size) return null;
  let budget = 60000;

  // weak successors of a node: same cell other digits + same digit in peers
  const weakNbrs = (id: number): number[] => {
    const cell = nCell(id);
    const digit = nDigit(id);
    const out: number[] = [];
    for (const d of digitsOf(g.cands[cell])) if (d !== digit) out.push(nid(cell, d));
    for (let c = 0; c < 81; c++) {
      if (c === cell || g.values[c] !== 0) continue;
      if (g.cands[c] & bit(digit) && sees(c, cell)) out.push(nid(c, digit));
    }
    return out;
  };

  for (const start of candidates) {
    if (!strong.has(start)) continue;
    const startConf = conflictsOf(g, start);

    const dfs = (path: number[], nextType: 'strong' | 'weak'): Step | null => {
      if (budget-- <= 0 || path.length > maxNodes) return null;
      const cur = path[path.length - 1];

      // a strong link just ended the chain (odd link count) -> evaluate
      if (nextType === 'weak' && path.length >= 4) {
        const endConf = conflictsOf(g, cur);
        const elims: CellDigit[] = [];
        for (const id of startConf) {
          if (!endConf.has(id) || path.includes(id)) continue;
          elims.push({ cell: nCell(id), digit: nDigit(id) });
        }
        if (elims.length) {
          const a = path[0];
          const b = cur;
          return {
            tech: 'AIC',
            placements: [],
            eliminations: elims,
            primary: path.map((id) => ({ cell: nCell(id), digit: nDigit(id) })),
            chainCells: path.map(nCell),
            description: `AIC: ${path
              .map((id) => `${nDigit(id)}@${cellName(nCell(id))}`)
              .join(' → ')}; at least one of ${nDigit(a)}@${cellName(nCell(a))} and ${nDigit(b)}@${cellName(nCell(b))} is true, so candidates conflicting with both are removed.`
          };
        }
      }

      const nexts = nextType === 'strong' ? (strong.get(cur) ?? []) : weakNbrs(cur);
      for (const next of nexts) {
        if (path.includes(next)) continue;
        const res = dfs([...path, next], nextType === 'strong' ? 'weak' : 'strong');
        if (res) return res;
      }
      return null;
    };

    const res = dfs([start], 'strong');
    if (res) return res;
    if (budget <= 0) return null;
  }
  return null;
}
